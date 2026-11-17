import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Entry point for the hosted (online) version of the system.
 *
 * It runs the same API and user interface as the desktop application, but as
 * a normal Node.js service on a Linux server behind a reverse proxy (Caddy)
 * that provides HTTPS. See docs/HOSTING.md.
 *
 * Settings come from environment variables, normally the file named in
 * SRIYA_ENV_FILE (default: <project>/.env). Required: DB_HOST, DB_USER,
 * DB_PASSWORD, DB_NAME, JWT_SECRET.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = process.env.SRIYA_ENV_FILE || path.join(projectRoot, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

process.env.SRIYA_MODE = 'web';

const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing required settings: ${missing.join(', ')}. Add them to ${envFile}.`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const staticDir = path.join(projectRoot, 'client', 'dist');
if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
  console.error('The user interface is not built. Run "npm run build:client" first.');
  process.exit(1);
}

const { startServer } = await import('./index.js');

const server = await startServer({
  dataDir: process.env.SRIYA_DATA_DIR || path.join(projectRoot, '.data'),
  staticDir,
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT) || 4600,
}).catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});

/** systemd sends SIGTERM on stop and restart; finish open requests and close the database cleanly. */
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  });
}
