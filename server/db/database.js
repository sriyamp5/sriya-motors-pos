import mysql from 'mysql2/promise';
import { getConfig } from '../config/appConfig.js';
import { logger } from '../core/logger.js';
import { serviceUnavailable } from '../core/errors.js';

/**
 * MySQL connection management.
 *
 * The application never assumes the database is available: on a shop laptop
 * MySQL may still be starting after Windows boots. The server therefore
 * starts immediately and connects in the background, retrying until the
 * database responds. The current state is exposed so the UI can show a
 * friendly "connecting" or "setup" screen instead of failing.
 */

export const DB_STATUS = Object.freeze({
  CONNECTING: 'connecting',
  READY: 'ready',
  NOT_CONFIGURED: 'not_configured',
  ERROR: 'error',
});

const RETRY_DELAY_MS = 4000;

/** Errors that will not go away by retrying; the operator must fix settings. */
const FATAL_CONNECTION_CODES = new Set([
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_NOT_SUPPORTED_AUTH_MODE',
  'ENOTFOUND',
]);

let pool = null;
let retryTimer = null;
let initGeneration = 0;

const state = {
  status: DB_STATUS.CONNECTING,
  message: 'Connecting to the database...',
  errorCode: null,
  attempts: 0,
};

export const getDbState = () => ({ ...state });

function setState(patch) {
  Object.assign(state, patch);
}

function friendlyConnectionMessage(error) {
  switch (error.code) {
    case 'ECONNREFUSED':
      return 'MySQL is not running yet. Waiting for the MySQL service to start...';
    case 'ER_ACCESS_DENIED_ERROR':
      return 'The database user name or password is incorrect.';
    case 'ENOTFOUND':
      return 'The database host could not be found.';
    case 'ETIMEDOUT':
      return 'The database did not respond in time.';
    default:
      return `Database error: ${error.message}`;
  }
}

const baseConnectionOptions = (db) => ({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  charset: 'utf8mb4',
  timezone: 'local',
  dateStrings: true,
  decimalNumbers: true,
  connectTimeout: 10000,
});

/** Opens a short-lived connection to verify settings and create the schema. */
export async function testConnection(db, { createDatabase = false } = {}) {
  const connection = await mysql.createConnection(baseConnectionOptions(db));
  try {
    const [rows] = await connection.query('SELECT VERSION() AS version');
    if (createDatabase) {
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    }
    return rows[0].version;
  } finally {
    await connection.end();
  }
}

/** Creates a dedicated connection that may run several statements at once (migrations, restore). */
export function createMultiStatementConnection() {
  const { db } = getConfig();
  return mysql.createConnection({
    ...baseConnectionOptions(db),
    database: db.database,
    multipleStatements: true,
  });
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  try {
    await current.end();
  } catch (error) {
    logger.warn('Error while closing database pool', error);
  }
}

/**
 * Connects to MySQL, creates the database if needed and runs the supplied
 * start-up steps (migrations, seeding). Retries on transient failures.
 */
export async function initDatabase(onConnected) {
  clearTimeout(retryTimer);
  const generation = ++initGeneration;
  const config = getConfig();

  if (!config.dbConfigured) {
    setState({
      status: DB_STATUS.NOT_CONFIGURED,
      message: 'The database connection has not been set up yet.',
      errorCode: null,
    });
    return;
  }

  setState({ status: DB_STATUS.CONNECTING, message: 'Connecting to the database...', errorCode: null });

  try {
    state.attempts += 1;
    const version = await testConnection(config.db, { createDatabase: true });

    await closePool();
    pool = mysql.createPool({
      ...baseConnectionOptions(config.db),
      database: config.db.database,
      connectionLimit: 10,
      waitForConnections: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    if (generation !== initGeneration) return;
    await onConnected?.();

    setState({ status: DB_STATUS.READY, message: `Connected to MySQL ${version}`, errorCode: null, attempts: 0 });
    logger.info(`Database ready (MySQL ${version}, schema "${config.db.database}")`);
  } catch (error) {
    if (generation !== initGeneration) return;
    const fatal = FATAL_CONNECTION_CODES.has(error.code);
    setState({
      status: fatal ? DB_STATUS.ERROR : DB_STATUS.CONNECTING,
      message: friendlyConnectionMessage(error),
      errorCode: error.code ?? 'UNKNOWN',
    });

    if (state.attempts === 1 || state.attempts % 15 === 0 || fatal) {
      logger.error(`Database initialisation failed (attempt ${state.attempts})`, error);
    }
    if (!fatal) {
      retryTimer = setTimeout(() => initDatabase(onConnected), RETRY_DELAY_MS);
    }
  }
}

function requirePool() {
  if (!pool || state.status !== DB_STATUS.READY) {
    // During initialisation the pool exists before status becomes READY.
    if (pool && state.status === DB_STATUS.CONNECTING) return pool;
    throw serviceUnavailable('The database is not available. Please wait a moment and try again.', 'DB_UNAVAILABLE');
  }
  return pool;
}

/** Runs a query and returns the rows (or the result header for writes). */
export async function query(sql, params = []) {
  const [rows] = await requirePool().query(sql, params);
  return rows;
}

/** Returns the first row or null. */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

/**
 * Executes work inside a transaction. The callback receives a connection
 * whose `query` resolves to rows directly, mirroring the module helpers.
 */
export async function transaction(work) {
  const connection = await requirePool().getConnection();
  const tx = {
    query: async (sql, params = []) => (await connection.query(sql, params))[0],
    queryOne: async (sql, params = []) => (await connection.query(sql, params))[0][0] ?? null,
  };
  try {
    await connection.beginTransaction();
    const result = await work(tx);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Transaction rollback failed', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** Detects lost connections at runtime and restarts the connection loop. */
export function isConnectionError(error) {
  return ['PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(error?.code);
}

export async function shutdownDatabase() {
  clearTimeout(retryTimer);
  initGeneration += 1;
  await closePool();
}
