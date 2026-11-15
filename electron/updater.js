import { app, ipcMain } from 'electron';
import log from 'electron-log/main.js';
import electronUpdater from 'electron-updater';

/**
 * Automatic updates from GitHub Releases.
 *
 * Updates are checked shortly after start-up and every few hours while the
 * internet is available. A found update downloads in the background and is
 * installed when the user clicks "Restart and update" or the next time the
 * application is closed. Being offline is normal for the shop and is not
 * reported as an error on screen.
 */

const { autoUpdater } = electronUpdater;

const CHECK_DELAY_MS = 15 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

const OFFLINE_PATTERN = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ERR_INTERNET_DISCONNECTED|net::ERR_/i;

let status = { state: 'idle', version: null, progress: 0, message: null, checkedAt: null };

export function initUpdater(getWindow) {
  const publish = (patch) => {
    status = { ...status, ...patch };
    getWindow()?.webContents.send('updater:status', status);
  };

  ipcMain.handle('updater:status', () => ({ ...status, currentVersion: app.getVersion(), enabled: app.isPackaged }));
  ipcMain.handle('updater:check', () => check(publish, { manual: true }));
  ipcMain.handle('updater:install', () => {
    if (status.state === 'downloaded') autoUpdater.quitAndInstall(false, true);
  });

  if (!app.isPackaged) {
    status = { ...status, state: 'disabled', message: 'Updates are only available in the installed application.' };
    return;
  }

  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => publish({ state: 'checking', message: null }));
  autoUpdater.on('update-available', (info) => publish({ state: 'downloading', version: info.version, progress: 0 }));
  autoUpdater.on('update-not-available', () =>
    publish({ state: 'up-to-date', checkedAt: new Date().toISOString(), message: null }),
  );
  autoUpdater.on('download-progress', (p) => publish({ state: 'downloading', progress: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => publish({ state: 'downloaded', version: info.version, progress: 100 }));
  autoUpdater.on('error', (error) => {
    const offline = OFFLINE_PATTERN.test(error?.message ?? '');
    log.warn(`Update check failed${offline ? ' (offline)' : ''}: ${error?.message}`);
    publish({
      state: offline ? 'offline' : 'error',
      message: offline ? 'No internet connection.' : 'Could not check for updates. Please try again later.',
    });
  });

  setTimeout(() => check(publish), CHECK_DELAY_MS);
  setInterval(() => check(publish), CHECK_INTERVAL_MS).unref();
}

async function check(publish, { manual = false } = {}) {
  if (!app.isPackaged) return status;
  if (status.state === 'downloading' || status.state === 'downloaded') return status;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    if (manual) publish({ state: 'error', message: error.message });
  }
  return status;
}
