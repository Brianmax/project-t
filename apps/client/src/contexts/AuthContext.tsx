import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { setAccessToken, setRefreshCallback } from '../lib/api';

interface AuthUser {
  sub: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtPayload(token: string): AuthUser {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64)) as AuthUser;
}

const API_BASE = 'http://localhost:3001';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyToken = useCallback((token: string) => {
    setToken(token);
    setAccessToken(token);
    setUser(decodeJwtPayload(token));
  }, []);

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string };
      applyToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    }
  }, [applyToken]);

  useEffect(() => {
    setRefreshCallback(silentRefresh);
    silentRefresh().finally(() => setIsLoading(false));
  }, [silentRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.text();
      try {
        const json = JSON.parse(body) as { message?: string };
        throw new Error(json.message || 'Login failed');
      } catch {
        throw new Error(body || 'Login failed');
      }
    }
    const data = (await res.json()) as { accessToken: string };
    applyToken(data.accessToken);
  }, [applyToken]);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || 'Registration failed');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
    } catch {
      // ignore network errors on logout
    }
    setToken(null);
    setAccessToken(null);
    setUser(null);
  }, [accessToken]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
