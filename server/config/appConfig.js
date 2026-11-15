import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Application configuration that must exist before the database is reachable
 * (database connection details, token secret, HTTP port).
 *
 * The file lives in the data directory, which is the Electron "userData"
 * folder in production and "<project>/.data" during development. Keeping it
 * outside the installation folder means updates never overwrite it.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const DEFAULT_CONFIG = Object.freeze({
  port: 4600,
  db: {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'sriya_pos',
  },
});

let dataDir = null;
let cached = null;

export function getDataDir() {
  if (!dataDir) {
    dataDir = process.env.SRIYA_DATA_DIR || path.join(projectRoot, '.data');
  }
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

export function setDataDir(dir) {
  dataDir = dir;
  cached = null;
}

const configPath = () => path.join(getDataDir(), 'config.json');

/** Environment variables override the file, which is convenient for development. */
function applyEnvironmentOverrides(config) {
  const env = process.env;
  return {
    ...config,
    port: env.PORT ? Number(env.PORT) : config.port,
    db: {
      host: env.DB_HOST ?? config.db.host,
      port: env.DB_PORT ? Number(env.DB_PORT) : config.db.port,
      user: env.DB_USER ?? config.db.user,
      password: env.DB_PASSWORD ?? config.db.password,
      database: env.DB_NAME ?? config.db.database,
    },
  };
}

function readConfigFile() {
  const file = configPath();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // A corrupted file is kept aside so the operator can inspect it.
    fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
    return null;
  }
}

function writeConfigFile(config) {
  const file = configPath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/** Returns the effective configuration, creating the file on first run. */
export function getConfig() {
  if (cached) return cached;

  let stored = readConfigFile();
  if (!stored) {
    stored = {
      ...DEFAULT_CONFIG,
      jwtSecret: crypto.randomBytes(48).toString('hex'),
      dbConfigured: false,
    };
    writeConfigFile(stored);
  }
  if (!stored.jwtSecret) {
    stored.jwtSecret = crypto.randomBytes(48).toString('hex');
    writeConfigFile(stored);
  }

  const merged = { ...DEFAULT_CONFIG, ...stored, db: { ...DEFAULT_CONFIG.db, ...stored.db } };
  const hasEnvDb = Boolean(process.env.DB_HOST || process.env.DB_USER || process.env.DB_PASSWORD);
  cached = applyEnvironmentOverrides({ ...merged, dbConfigured: merged.dbConfigured || hasEnvDb });
  return cached;
}

/** Persists new database settings entered on the setup screen. */
export function saveDatabaseConfig(db) {
  const stored = readConfigFile() ?? { ...DEFAULT_CONFIG };
  writeConfigFile({ ...stored, db, dbConfigured: true });
  cached = null;
  return getConfig();
}

export const paths = {
  projectRoot,
  logs: () => path.join(getDataDir(), 'logs'),
  defaultBackups: () => path.join(getDataDir(), 'backups'),
};
