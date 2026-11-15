import { initDatabase, getDbState, DB_STATUS } from '../../db/database.js';
import { runMigrations } from '../../db/migrator.js';
import { seedBaseData } from '../../db/seed.js';
import { createBackup, startBackupScheduler } from '../backup/backupService.js';
import { logger } from '../../core/logger.js';

/**
 * Steps executed every time a database connection is established:
 * apply pending schema updates (after taking a safety backup), make sure
 * base data exists and start the automatic backup schedule.
 */
async function onDatabaseConnected() {
  const applied = await runMigrations(async () => {
    logger.info('Database update pending, creating a safety backup first');
    await createBackup('pre-update');
  });
  if (applied.length) logger.info(`Applied ${applied.length} database update(s): ${applied.join(', ')}`);

  await seedBaseData();
  startBackupScheduler();
}

export function startDatabase() {
  return initDatabase(onDatabaseConnected);
}

/** Re-runs start-up steps, e.g. after new connection settings or a restore. */
export async function reinitialiseDatabase() {
  await initDatabase(onDatabaseConnected);
  return getDbState();
}

export const isDatabaseReady = () => getDbState().status === DB_STATUS.READY;
