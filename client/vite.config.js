import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: clientRoot,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.join(clientRoot, 'src'),
      '@shared': path.join(clientRoot, '..', 'shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:4600',
    },
    fs: { allow: [path.join(clientRoot, '..')] },
  },
  build: {
    outDir: path.join(clientRoot, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
