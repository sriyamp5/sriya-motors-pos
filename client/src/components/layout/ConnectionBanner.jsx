import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { NETWORK_ERROR_EVENT, NETWORK_OK_EVENT } from '@/api/client.js';
import { isOnlineVersion } from '@/lib/runtime.js';

/**
 * Warning shown in the online version when the internet connection is lost.
 *
 * The page stays open and the bill being prepared is kept (it is stored in
 * the browser), but nothing can be saved until the connection returns, so
 * the cashier must not hand over goods for a bill that was not completed.
 * The desktop application works without internet and never shows this.
 */
export function ConnectionBanner() {
  const [offline, setOffline] = useState(() => isOnlineVersion() && !navigator.onLine);

  useEffect(() => {
    if (!isOnlineVersion()) return undefined;
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    // The browser's own online flag reacts to a cable or Wi-Fi drop; failed
    // requests also catch the case where Wi-Fi is up but the internet is not.
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    window.addEventListener(NETWORK_ERROR_EVENT, goOffline);
    window.addEventListener(NETWORK_OK_EVENT, goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.removeEventListener(NETWORK_ERROR_EVENT, goOffline);
      window.removeEventListener(NETWORK_OK_EVENT, goOnline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="banner banner-danger" role="alert">
      <WifiOff size={16} />
      <span>
        <strong>No connection to the server.</strong> Sales cannot be saved until the internet is back. The current bill
        is kept on this screen. Do not hand over goods for a bill that was not completed.
      </span>
    </div>
  );
}
