import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMultiStatementConnection } from './database.js';
import { logger } from '../core/logger.js';

/**
 * Applies SQL files from ./migrations in name order. Each applied file is
 * recorded in schema_migrations so it runs exactly once. Updates that need
 * schema changes simply ship a new numbered file (002_..., 003_...).
 */

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
}

export async function getPendingMigrations(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(150) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
  const [rows] = await connection.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  return { pending: listMigrationFiles().filter((name) => !applied.has(name)), appliedCount: applied.size };
}

/**
 * Runs pending migrations.
 * @param {() => Promise<void>} [beforeApply] called once before the first
 *   migration when the database already holds data (used to take a backup).
 */
export async function runMigrations(beforeApply) {
  const connection = await createMultiStatementConnection();
  try {
    const { pending, appliedCount } = await getPendingMigrations(connection);
    if (pending.length === 0) return [];

    if (appliedCount > 0 && beforeApply) await beforeApply();

    for (const name of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
      logger.info(`Applying migration ${name}`);
      try {
        await connection.query(sql);
        await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
      } catch (error) {
        logger.error(`Migration ${name} failed`, error);
        throw new Error(`Database update ${name} failed: ${error.message}`, { cause: error });
      }
    }
    return pending;
  } finally {
    await connection.end();
  }
}
