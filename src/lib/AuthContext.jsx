import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { store } from '@/api/storeClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await store.auth.me();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
      if (error.status !== 401) setAuthError(error);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => { checkUserAuth(); }, [checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    await store.auth.logout();
    setUser(null);
    if (shouldRedirect) window.location.assign('/');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoadingAuth, authChecked, authError, logout, checkUserAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};
