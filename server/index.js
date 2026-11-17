import http from 'node:http';
import { createApp } from './app.js';
import { getConfig, isWebMode, setDataDir } from './config/appConfig.js';
import { logger, pruneOldLogs } from './core/logger.js';
import { startDatabase } from './modules/system/startup.js';
import { shutdownDatabase } from './db/database.js';
import { stopBackupScheduler } from './modules/backup/backupService.js';

const MAX_PORT_ATTEMPTS = 20;

/**
 * Listens on the preferred port. The desktop app moves to the next port if it
 * is taken; a hosted server must use the exact port the reverse proxy expects.
 */
function listen(server, preferredPort, host, { fixedPort = false } = {}) {
  return new Promise((resolve, reject) => {
    let port = preferredPort;
    let attempts = 0;

    const tryListen = () => {
      server.once('error', onError);
      server.listen(port, host, () => {
        server.off('error', onError);
        resolve(port);
      });
    };
    const onError = (error) => {
      if (error.code === 'EADDRINUSE' && !fixedPort && attempts < MAX_PORT_ATTEMPTS) {
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
 * @param {string} [options.host]      address to listen on (always local by default)
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function startServer({ dataDir, staticDir, port, host = '127.0.0.1' } = {}) {
  if (dataDir) setDataDir(dataDir);
  pruneOldLogs();

  const config = getConfig();
  const server = http.createServer(createApp({ staticDir }));
  const actualPort = await listen(server, port ?? config.port, host, { fixedPort: isWebMode() });
  logger.info(`Server listening on http://${host}:${actualPort}${isWebMode() ? ' (web mode)' : ''}`);

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
