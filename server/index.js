import http from 'node:http';
import { createApp } from './app.js';
import { getConfig, setDataDir } from './config/appConfig.js';
import { logger, pruneOldLogs } from './core/logger.js';
import { startDatabase } from './modules/system/startup.js';
import { shutdownDatabase } from './db/database.js';
import { stopBackupScheduler } from './modules/backup/backupService.js';

const MAX_PORT_ATTEMPTS = 20;

/** Listens on the preferred port, moving to the next one if it is taken. */
function listen(server, preferredPort) {
  return new Promise((resolve, reject) => {
    let port = preferredPort;
    let attempts = 0;

    const tryListen = () => {
      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', onError);
        resolve(port);
      });
    };
    const onError = (error) => {
      if (error.code === 'EADDRINUSE' && attempts < MAX_PORT_ATTEMPTS) {
        attempts += 1;
        port += 1;
        tryListen();
      } else {
        reject(error);
      }
    };
    tryListen();
  });
}

/**
 * Starts the HTTP server immediately and connects to the database in the
 * background, so the user interface can always open and report the status.
 *
 * @param {object} [options]
 * @param {string} [options.dataDir]   folder for config, logs and backups
 * @param {string} [options.staticDir] built client files to serve
 * @param {number} [options.port]
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function startServer({ dataDir, staticDir, port } = {}) {
  if (dataDir) setDataDir(dataDir);
  pruneOldLogs();

  const config = getConfig();
  const server = http.createServer(createApp({ staticDir }));
  const actualPort = await listen(server, port ?? config.port);
  logger.info(`Server listening on http://127.0.0.1:${actualPort}`);

  startDatabase();

  return {
    port: actualPort,
    close: async () => {
      stopBackupScheduler();
      await new Promise((resolve) => server.close(resolve));
      await shutdownDatabase();
    },
  };
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});
