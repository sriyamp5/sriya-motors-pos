const { contextBridge, ipcRenderer } = require('electron');

/**
 * The only bridge between the web interface and the operating system.
 * The page detects the desktop app through `window.desktop`; when it is
 * missing (plain browser during development) the UI falls back gracefully.
 */
contextBridge.exposeInMainWorld('desktop', {
  getInfo: () => ipcRenderer.invoke('app:info'),

  listPrinters: () => ipcRenderer.invoke('printer:list'),
  print: (options) => ipcRenderer.invoke('printer:print', options),

  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  selectBackupFile: () => ipcRenderer.invoke('dialog:select-backup'),
  openPath: (target) => ipcRenderer.invoke('shell:open-path', target),

  updates: {
    getStatus: () => ipcRenderer.invoke('updater:status'),
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('updater:status', listener);
      return () => ipcRenderer.removeListener('updater:status', listener);
    },
  },
});
