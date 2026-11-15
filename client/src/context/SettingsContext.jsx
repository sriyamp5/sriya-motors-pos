import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client.js';
import { useAuth } from './AuthContext.jsx';

const SettingsContext = createContext(null);

const FALLBACK = {
  shopName: 'Sriya Motors (Pvt) Ltd',
  shopAddress: '',
  shopPhone: '',
  shopEmail: '',
  receiptFooter: '',
  receiptPrinter: '',
  silentPrint: false,
};

/** Shop details needed on every screen (receipt header, printer). */
export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(FALLBACK);

  const reload = useCallback(async () => {
    try {
      setSettings({ ...FALLBACK, ...(await api.get('/settings/public')) });
    } catch {
      // Keep the previous values; printing still works with defaults.
    }
  }, []);

  useEffect(() => {
    if (user && !user.mustChangePassword) reload();
  }, [user, reload]);

  const value = useMemo(() => ({ settings, reload }), [settings, reload]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useShopSettings = () => useContext(SettingsContext);
