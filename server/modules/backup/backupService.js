import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { once } from 'node:events';
import mysql from 'mysql2/promise';
import { query, createMultiStatementConnection, getDbState, DB_STATUS } from '../../db/database.js';
import { getConfig, paths } from '../../config/appConfig.js';
import { logger } from '../../core/logger.js';
import { badRequest, notFound, AppError } from '../../core/errors.js';
import { getSettings, setRawSetting, getRawSetting } from '../settings/settingsService.js';

/**
 * Database backup and restore implemented in Node, so no MySQL client tools
 * are required on the shop laptop.
 *
 * Backups are gzip-compressed SQL files. If the configured backup folder
 * (for example an external drive) is not available, the default folder in
 * the application data directory is used instead so a backup is never lost.
 */

const FILE_PREFIX = 'sriya-pos-';
const FILE_SUFFIX = '.sql.gz';
const ROW_BATCH = 500;
const AUTO_BACKUP_INTERVAL_MS = 20 * 60 * 60 * 1000;
const SCHEDULER_TICK_MS = 60 * 60 * 1000;

let running = null;
let schedulerTimer = null;
let firstRunTimer = null;

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function isWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolves the folder backups are written to, falling back to the default one. */
export async function resolveBackupDir() {
  const { backupDir } = await getSettings();
  const preferred = backupDir?.trim();
  if (preferred && isWritableDir(preferred)) return { dir: preferred, usingFallback: false };
  const fallback = paths.defaultBackups();
  fs.mkdirSync(fallback, { recursive: true });
  return { dir: fallback, usingFallback: Boolean(preferred) };
}

/** JSON columns are returned as objects and must be written back as JSON text. */
function escapeValue(value) {
  if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Date)) {
    return mysql.escape(JSON.stringify(value));
  }
  return mysql.escape(value);
}

async function writeDump(filePath) {
  const { db } = getConfig();
  const gzip = zlib.createGzip({ level: 6 });
  const output = fs.createWriteStream(filePath);
  gzip.pipe(output);

  const write = async (text) => {
    if (!gzip.write(text)) await once(gzip, 'drain');
  };

  await write(`-- Sriya Motors POS backup\n-- Database: ${db.database}\n-- Created: ${new Date().toISOString()}\n\n`);
  await write('SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n');

  const tables = await query(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`);
  for (const row of tables) {
    const table = Object.values(row)[0];
    const [create] = await query(`SHOW CREATE TABLE \`${table}\``);
    await write(`DROP TABLE IF EXISTS \`${table}\`;\n${create['Create Table']};\n`);

    for (let offset = 0; ; offset += ROW_BATCH) {
      const rows = await query(`SELECT * FROM \`${table}\` LIMIT ? OFFSET ?`, [ROW_BATCH, offset]);
      if (rows.length === 0) break;
      const columns = Object.keys(rows[0])
        .map((c) => `\`${c}\``)
        .join(', ');
      const values = rows.map((r) => `(${Object.values(r).map(escapeValue).join(', ')})`).join(',\n');
      await write(`INSERT INTO \`${table}\` (${columns}) VALUES\n${values};\n`);
      if (rows.length < ROW_BATCH) break;
    }
    await write('\n');
  }
  await write('SET FOREIGN_KEY_CHECKS=1;\n');

  gzip.end();
  await once(output, 'finish');
}

function rotate(dir, keep) {
  const files = listBackupFiles(dir);
  for (const file of files.slice(keep)) {
    try {
      fs.unlinkSync(path.join(dir, file.fileName));
    } catch (error) {
      logger.warn(`Could not remove old backup ${file.fileName}`, error);
    }
  }
}

function listBackupFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { fileName: name, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Creates a backup. Concurrent requests share the same running job.
 * @param {'manual'|'auto'|'pre-update'|'pre-restore'} reason
 */
export async function createBackup(reason = 'manual') {
  if (running) return running;
  running = (async () => {
    const { dir, usingFallback } = await resolveBackupDir();
    const fileName = `${FILE_PREFIX}${timestamp()}-${reason}${FILE_SUFFIX}`;
    const filePath = path.join(dir, fileName);
    const tempPath = `${filePath}.partial`;
    try {
      await writeDump(tempPath);
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      fs.rmSync(tempPath, { force: true });
      logger.error('Backup failed', error);
      throw new AppError(500, 'BACKUP_FAILED', `Backup failed: ${error.message}`);
    }

    const { backupKeepCount } = await getSettings();
    rotate(dir, backupKeepCount);
    await setRawSetting('last_backup_at', new Date().toISOString());
    logger.info(`Backup created: ${filePath}`);
    return { fileName, dir, size: fs.statSync(filePath).size, usingFallback };
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

export async function listBackups() {
  const { dir, usingFallback } = await resolveBackupDir();
  return {
    dir,
    usingFallback,
    lastBackupAt: await getRawSetting('last_backup_at'),
    files: listBackupFiles(dir),
  };
}

/** Resolves a backup by file name inside the backup folder, or by absolute path chosen in a file dialog. */
async function resolveBackupPath({ fileName, filePath }) {
  if (filePath) {
    if (!filePath.endsWith(FILE_SUFFIX)) throw badRequest('Please select a Sriya Motors backup file (.sql.gz).');
    if (!fs.existsSync(filePath)) throw notFound('Backup file');
    return filePath;
  }
  const { dir } = await resolveBackupDir();
  const safeName = path.basename(fileName ?? '');
  const full = path.join(dir, safeName);
  if (!safeName.endsWith(FILE_SUFFIX) || !fs.existsSync(full)) throw notFound('Backup file');
  return full;
}

/**
 * Replaces the whole database with a backup. A safety backup of the current
 * data is taken first so a mistaken restore can be undone.
 */
export async function restoreBackup(source) {
  const filePath = await resolveBackupPath(source);
  const sql = zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf8');
  if (!sql.startsWith('-- Sriya Motors POS backup')) {
    throw badRequest('This file is not a Sriya Motors POS backup.');
  }

  await createBackup('pre-restore');

  const connection = await createMultiStatementConnection();
  try {
    // Statements are written one per ";\n"; values never contain raw newlines because they are escaped.
    const statements = sql.split(/;\n/).filter((s) => s.trim());
    const CHUNK = 50;
    for (let i = 0; i < statements.length; i += CHUNK) {
      await connection.query(`${statements.slice(i, i + CHUNK).join(';\n')};`);
    }
  } catch (error) {
    logger.error(`Restore from ${filePath} failed`, error);
    throw new AppError(
      500,
      'RESTORE_FAILED',
      `Restore failed: ${error.message}. Your previous data was backed up first.`,
    );
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS=1').catch(() => {});
    await connection.end();
  }
  logger.info(`Database restored from ${filePath}`);
  return { restoredFrom: path.basename(filePath) };
}

async function runScheduledBackup() {
  if (getDbState().status !== DB_STATUS.READY) return;
  try {
    const last = await getRawSetting('last_backup_at');
    if (!last || Date.now() - new Date(last).getTime() > AUTO_BACKUP_INTERVAL_MS) {
      await createBackup('auto');
    }
  } catch (error) {
    logger.error('Scheduled backup failed', error);
  }
}

/** Takes a daily automatic backup; checks once an hour while the app is open. */
export function startBackupScheduler() {
  stopBackupScheduler();
  firstRunTimer = setTimeout(runScheduledBackup, 30 * 1000);
  schedulerTimer = setInterval(runScheduledBackup, SCHEDULER_TICK_MS);
  firstRunTimer.unref?.();
  schedulerTimer.unref?.();
}

export function stopBackupScheduler() {
  clearTimeout(firstRunTimer);
  clearInterval(schedulerTimer);
}
