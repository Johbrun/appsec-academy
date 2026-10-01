import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, setUnauthorizedHandler } from '../lib/api';
import { flushPending } from '../lib/flush';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'teacher';
}

export interface CohortInfo {
  id: number;
  name: string;
  teacher: string;
  joinedAt: number;
}

type Status = 'loading' | 'in' | 'out' | 'unreachable';

interface Ctx {
  status: Status;
  user: User | null;
  cohorts: CohortInfo[];
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Relit le compte et les promos depuis le serveur. */
  refresh: () => Promise<void>;
  setName: (name: string) => Promise<void>;
}

const SessionContext = createContext<Ctx | null>(null);

interface Me { user: User; cohorts: CohortInfo[] }

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [cohorts, setCohorts] = useState<CohortInfo[]>([]);

  const apply = useCallback((me: Me | null) => {
    setUser(me?.user ?? null);
    setCohorts(me?.cohorts ?? []);
    setStatus(me ? 'in' : 'out');
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await api<Me>('/me'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) apply(null);
      else if (e instanceof ApiError && e.status === 0) setStatus('unreachable');
      else throw e;
    }
  }, [apply]);

  useEffect(() => { refresh().catch(() => setStatus('unreachable')); }, [refresh]);

  // Une session qui expire pendant qu'on joue ramène à la page de connexion, sans perdre la page en cours.
  useEffect(() => {
    setUnauthorizedHandler(() => apply(null));
    return () => setUnauthorizedHandler(null);
  }, [apply]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
    await refresh().catch(() => apply({ user: r.user, cohorts: [] }));
  }, [refresh, apply]);

  const signup = useCallback(async (email: string, name: string, password: string) => {
    const r = await api<{ user: User }>('/auth/signup', { method: 'POST', body: { email, name, password } });
    apply({ user: r.user, cohorts: [] });
  }, [apply]);

  const logout = useCallback(async () => {
    await flushPending();
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* la session est de toute façon abandonnée côté client */ }
    apply(null);
  }, [apply]);

  const setName = useCallback(async (name: string) => {
    const r = await api<{ user: User }>('/me', { method: 'PATCH', body: { name } });
    setUser(r.user);
  }, []);

  const value = useMemo(
    () => ({ status, user, cohorts, login, signup, logout, refresh, setName }),
    [status, user, cohorts, login, signup, logout, refresh, setName],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession hors du SessionProvider');
  return ctx;
}

/** Pour les composants qui ne s'affichent qu'une fois connecté. */
export function useUser(): User {
  const { user } = useSession();
  if (!user) throw new Error('useUser sans session');
  return user;
}
