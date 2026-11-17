import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { DB_UNAVAILABLE_EVENT } from '@/api/client.js';
import { setServerInfo } from '@/lib/runtime.js';
import { Button } from '@/components/ui/index.js';
import { DatabaseSetupPage } from './DatabaseSetupPage.jsx';
import logo from '@/assets/logo.jpg';

const POLL_MS = 3000;

async function fetchStatus() {
  const response = await fetch('/api/system/status', { cache: 'no-store' });
  if (!response.ok) throw new Error('Status request failed');
  return response.json();
}

/**
 * Shows the application only when the database is ready. Until then it
 * displays a friendly "starting" screen (e.g. MySQL still booting after the
 * laptop was switched on) or the first-time database setup form.
 */
export function SystemGate({ children }) {
  const [status, setStatus] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const timer = useRef(null);

  const check = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      const next = await fetchStatus();
      setServerInfo(next);
      setStatus(next);
      if (next.database.status !== 'ready') timer.current = setTimeout(check, POLL_MS);
    } catch {
      // In a browser with no internet the hosted server cannot be reached at all.
      const message = navigator.onLine
        ? 'Starting the POS service...'
        : 'No internet connection. The system will open as soon as the connection is back.';
      // Keep an open system on screen; the connection banner explains the problem there.
      setStatus((prev) =>
        prev?.database?.status === 'ready'
          ? prev
          : { ...prev, database: { ...prev?.database, status: 'connecting', message } },
      );
      timer.current = setTimeout(check, POLL_MS);
    }
  }, []);

  useEffect(() => {
    check();
    const onUnavailable = () => check();
    window.addEventListener(DB_UNAVAILABLE_EVENT, onUnavailable);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener(DB_UNAVAILABLE_EVENT, onUnavailable);
    };
  }, [check]);

  const db = status?.database;
  if (db?.status === 'ready') return children;

  if (db?.needsSetup || showSetup) {
    return (
      <DatabaseSetupPage
        status={db}
        onConnected={() => {
          setShowSetup(false);
          check();
        }}
        onCancel={db?.needsSetup ? undefined : () => setShowSetup(false)}
      />
    );
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: 440, padding: 32, textAlign: 'center' }}>
        <img src={logo} alt="Sriya Motors" style={{ width: 150, margin: '0 auto 18px', borderRadius: 12 }} />
        <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
          <Loader2 size={20} className="spin" style={{ color: 'var(--primary-text)' }} />
          <h2>Starting the system</h2>
        </div>
        <p className="muted mt-2">{db?.message ?? 'Please wait...'}</p>
        {db?.attempts > 3 && (
          <div className="stack mt-3">
            <p className="small muted">
              <Database size={13} style={{ verticalAlign: -2 }} /> If this takes more than a minute, make sure the MySQL
              service is running, or check the database settings.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Button icon={RefreshCw} onClick={check}>
                Try again
              </Button>
              <Button variant="ghost" icon={Settings2} onClick={() => setShowSetup(true)}>
                Database settings
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
