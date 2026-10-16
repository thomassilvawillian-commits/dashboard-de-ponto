import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { get, onSessionExpired, post } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  company: { name: string; timezone: string } | null;
  loading: boolean;
  needsSetup: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<AuthState['company']>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await get('/auth/me');
      setUser(me.user);
      setCompany(me.company);
      setNeedsSetup(false);
    } catch {
      setUser(null);
      const s = await get('/auth/setup').catch(() => ({ needsSetup: false, companyName: '' }));
      setNeedsSetup(s.needsSetup);
      setCompany(s.companyName ? { name: s.companyName, timezone: '' } : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => onSessionExpired(() => setUser(null)), []);

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, company, loading, needsSetup, refresh, logout }}>{children}</Ctx.Provider>;
}

export const isManager = (u: User | null) => !!u && (u.role === 'ADMIN' || u.role === 'GESTOR');
