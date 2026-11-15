import { Router } from 'express';
import { parse } from '../../core/validation.js';
import { badRequest, forbidden } from '../../core/errors.js';
import { databaseConfigSchema } from '../../../shared/schemas/index.js';
import { getConfig, saveDatabaseConfig } from '../../config/appConfig.js';
import { getDbState, testConnection, DB_STATUS } from '../../db/database.js';
import { reinitialiseDatabase } from './startup.js';
import { appVersion } from '../../version.js';

/**
 * Public endpoints used before anyone can sign in: health/status and the
 * first-time database setup screen.
 */
export const systemRoutes = Router();

systemRoutes.get('/status', (_req, res) => {
  const { db } = getConfig();
  const state = getDbState();
  res.json({
    appName: 'Sriya Motors POS',
    version: appVersion,
    database: {
      ...state,
      needsSetup: state.status === DB_STATUS.NOT_CONFIGURED || state.status === DB_STATUS.ERROR,
      host: db.host,
      port: db.port,
      user: db.user,
      name: db.database,
    },
  });
});

systemRoutes.post('/database', async (req, res) => {
  // Connection settings can only be changed while the database is not connected,
  // so this public endpoint cannot be used to redirect a working system.
  if (getDbState().status === DB_STATUS.READY) {
    throw forbidden('The database is already connected.');
  }
  const settings = parse(databaseConfigSchema, req.body);
  try {
    await testConnection(settings, { createDatabase: true });
  } catch (error) {
    const message =
      error.code === 'ER_ACCESS_DENIED_ERROR'
        ? 'User name or password is incorrect.'
        : error.code === 'ECONNREFUSED'
          ? 'Could not reach MySQL on this host and port. Is the MySQL service running?'
          : `Connection failed: ${error.message}`;
    throw badRequest(message);
  }
  saveDatabaseConfig(settings);
  res.json(await reinitialiseDatabase());
});

systemRoutes.post('/database/retry', async (_req, res) => {
  if (getDbState().status === DB_STATUS.READY) return res.json(getDbState());
  res.json(await reinitialiseDatabase());
});
