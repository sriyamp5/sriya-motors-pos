import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config/appConfig.js';

/**
 * Minimal file logger. One file per day under <dataDir>/logs, files older
 * than LOG_RETENTION_DAYS are removed on start-up. Output is also mirrored
 * to the console for development.
 */

const LOG_RETENTION_DAYS = 30;
const LEVELS = ['debug', 'info', 'warn', 'error'];
const minLevel = LEVELS.indexOf(process.env.LOG_LEVEL || 'info');

const today = () => new Date().toISOString().slice(0, 10);

function logFile() {
  const dir = paths.logs();
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `server-${today()}.log`);
}

function serialize(meta) {
  if (!meta) return '';
  if (meta instanceof Error) return ` ${meta.stack || meta.message}`;
  try {
    return ` ${JSON.stringify(meta, (_key, value) => (value instanceof Error ? value.stack : value))}`;
  } catch {
    return ' [unserialisable meta]';
  }
}

function write(level, message, meta) {
  if (LEVELS.indexOf(level) < minLevel) return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${serialize(meta)}`;

  const consoleMethod = level === 'debug' ? 'log' : level;
  console[consoleMethod](line);

  try {
    fs.appendFileSync(logFile(), `${line}\n`, 'utf8');
  } catch {
    // Logging must never crash the application.
  }
}

export function pruneOldLogs() {
  try {
    const dir = paths.logs();
    if (!fs.existsSync(dir)) return;
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
    }
  } catch (error) {
    write('warn', 'Could not prune old log files', error);
  }
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};
