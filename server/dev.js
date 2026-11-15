import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The .env file is loaded here rather than with Node's --env-file flag, because
// that flag combined with --watch restarts the process in a loop on Windows.
try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch {
  // No .env file: defaults and the setup screen are used.
}

const { startServer } = await import('./index.js');

/** Development entry point: runs the API without Electron. The Vite dev server proxies /api here. */
startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
