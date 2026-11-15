import { useEffect, useState } from 'react';
import { Download, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/index.js';

/** Subscribes to update status from the desktop app (no-op in a plain browser). */
export function useUpdateStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    const updates = window.desktop?.updates;
    if (!updates) return undefined;
    updates
      .getStatus()
      .then(setStatus)
      .catch(() => {});
    return updates.onStatus((next) => setStatus((prev) => ({ ...prev, ...next })));
  }, []);
  return status;
}

/**
 * Thin banner shown to everyone while an update downloads and when it is
 * ready, so the shop can restart at a convenient moment with one click.
 */
export function UpdateBanner() {
  const status = useUpdateStatus();
  if (!status) return null;

  if (status.state === 'downloading') {
    return (
      <div className="banner banner-info">
        <Download size={16} />
        <span>
          Downloading update {status.version ? `v${status.version}` : ''}…{' '}
          {status.progress ? `${status.progress}%` : ''}
        </span>
      </div>
    );
  }

  if (status.state === 'downloaded') {
    return (
      <div className="banner banner-success">
        <RotateCw size={16} />
        <span>
          <strong>Update v{status.version} is ready.</strong> It installs automatically when the app is closed, or
          restart now (takes about a minute).
        </span>
        <Button size="sm" variant="primary" onClick={() => window.desktop.updates.install()}>
          Restart and update
        </Button>
      </div>
    );
  }
  return null;
}
