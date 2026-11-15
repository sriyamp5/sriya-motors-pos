import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, AUTH_EXPIRED_EVENT } from '@/api/client.js';
import { useToast } from './ToastContext.jsx';
import { ROLES } from '@shared/constants.js';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user. The token lives in session storage, so closing
 * the application signs the user out while a page refresh does not.
 */
export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get('/auth/me')
      .then(({ user: me }) => setUser(me))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    const onExpired = (event) => {
      signOut();
      toast.warning('Signed out', event.detail);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [signOut, toast]);

  const signIn = useCallback(async (credentials) => {
    const { token, user: signedIn } = await api.post('/auth/login', credentials);
    tokenStore.set(token);
    setUser(signedIn);
    return signedIn;
  }, []);

  const changePassword = useCallback(async (values) => {
    const { token, user: updated } = await api.post('/auth/change-password', values);
    tokenStore.set(token);
    setUser(updated);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === ROLES.ADMIN,
      signIn,
      signOut,
      changePassword,
    }),
    [user, loading, signIn, signOut, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
