import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import log from 'electron-log/main.js';
import { initUpdater } from './updater.js';
import { printHtml } from './printing.js';

/**
 * Desktop shell. It runs the API server inside the Electron process and
 * shows the user interface in a window, so the shop only has to double-click
 * one icon. The database itself is the locally installed MySQL service.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));
const devUrl = process.env.ELECTRON_DEV_URL;

log.initialize();
log.transports.file.level = 'info';
Object.assign(console, log.functions);

let mainWindow = null;
let server = null;

// Only one copy of the POS may run; a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(start);
}

/** Installed app keeps data in the Windows user profile; development uses the project folder and .env. */
function resolveDataDir() {
  if (app.isPackaged) return app.getPath('userData');
  try {
    process.loadEnvFile(path.join(dirname, '..', '.env'));
  } catch {
    // No .env file: defaults and the setup screen are used.
  }
  return path.join(dirname, '..', '.data');
}

async function start() {
  Menu.setApplicationMenu(null);
  const dataDir = resolveDataDir();
  process.env.SRIYA_DATA_DIR = dataDir;

  try {
    const { startServer } = await import('../server/index.js');
    server = await startServer({
      dataDir,
      staticDir: path.join(app.getAppPath(), 'client', 'dist'),
    });
  } catch (error) {
    log.error('Server failed to start', error);
    dialog.showErrorBox(
      'Sriya Motors POS',
      `The application could not start.\n\n${error.message}\n\nPlease restart the computer. If the problem continues, contact support.`,
    );
    app.quit();
    return;
  }

  registerIpcHandlers();
  createWindow();
  initUpdater(() => mainWindow);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    title: 'Sriya Motors POS',
    icon: path.join(dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.loadURL(devUrl ?? `http://127.0.0.1:${server.port}`);

  // Links to external sites open in the default browser, never inside the POS window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Recover automatically if the page crashes or stops responding.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Renderer process gone', details);
    if (details.reason !== 'clean-exit') mainWindow.reload();
  });
  mainWindow.on('unresponsive', () => log.warn('Window became unresponsive'));

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.reload();
      event.preventDefault();
    } else if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    dataDir: app.getPath('userData'),
    logsDir: log.transports.file.getFile().path,
  }));

  ipcMain.handle('printer:list', async () => {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault }));
  });

  ipcMain.handle('printer:print', (_event, { html, printerName, silent }) => printHtml({ html, printerName, silent }));

  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:select-backup', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Sriya Motors backup', extensions: ['gz'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('shell:open-path', (_event, target) => shell.openPath(target));
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', async (event) => {
  if (!server) return;
  event.preventDefault();
  const closing = server;
  server = null;
  try {
    await closing.close();
  } catch (error) {
    log.error('Error during shutdown', error);
  }
  app.quit();
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception in main process', error);
});
