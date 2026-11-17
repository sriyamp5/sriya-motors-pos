/**
 * Where the user interface is running, as reported by the server on start-up:
 *
 * - "desktop": inside the installed Electron application on the shop laptop
 *   (the server runs on the same computer, works without internet).
 * - "web": the hosted online version opened in a browser (needs internet).
 *
 * SystemGate stores the status before any page is shown, so every component
 * below it can read these values synchronously.
 */

let serverInfo = { mode: window.desktop ? 'desktop' : 'web', version: null };

export function setServerInfo(status) {
  serverInfo = { mode: status?.mode ?? serverInfo.mode, version: status?.version ?? serverInfo.version };
}

/** True for the hosted website, where the internet connection matters. */
export const isOnlineVersion = () => serverInfo.mode === 'web' && !window.desktop;

export const serverVersion = () => serverInfo.version;
