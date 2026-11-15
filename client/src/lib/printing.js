/**
 * Prints an HTML document. In the desktop app it goes through Electron
 * (optionally silently to the configured receipt printer); in a browser it
 * opens the standard print dialog from a hidden frame.
 *
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function printDocument(html, { printerName, silent } = {}) {
  if (window.desktop?.print) {
    return window.desktop.print({ html, printerName, silent });
  }
  return printWithFrame(html);
}

function printWithFrame(html) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(frame);
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        resolve({ success: true });
      } catch (error) {
        resolve({ success: false, reason: error.message });
      } finally {
        setTimeout(() => frame.remove(), 2000);
      }
    };
    frame.srcdoc = html;
  });
}
