import { BrowserWindow } from 'electron';
import log from 'electron-log/main.js';

/**
 * Prints an HTML document (the receipt) through a hidden window.
 * With `silent` the job goes straight to the selected printer without a
 * dialog, which is what a busy counter needs. The paper size is taken from
 * the printer driver (80 mm roll for thermal printers).
 */
export async function printHtml({ html, printerName, silent }) {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false },
  });

  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await new Promise((resolve) => {
      window.webContents.print(
        {
          silent: Boolean(silent),
          deviceName: printerName || undefined,
          printBackground: true,
          margins: { marginType: 'none' },
        },
        (success, failureReason) => {
          if (!success && failureReason !== 'cancelled') log.warn(`Printing failed: ${failureReason}`);
          resolve({ success, reason: success ? null : failureReason });
        },
      );
    });
  } catch (error) {
    log.error('Printing error', error);
    return { success: false, reason: error.message };
  } finally {
    // Give the spooler a moment to receive the job before the window is destroyed.
    setTimeout(() => window.destroy(), 1500);
  }
}
