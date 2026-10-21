import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, setToken, setUnauthorizedHandler } from "./api";
import { getItem, removeItem, setItem } from "./storage";
import type { AuthResponse, User } from "./types";

const TOKEN_KEY = "ty_token";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; faith?: string; sect?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await removeItem(TOKEN_KEY);
  }, []);

  const finishAuth = useCallback(async (res: AuthResponse) => {
    setToken(res.access_token);
    await setItem(TOKEN_KEY, res.access_token);
    setUser(res.user);
  }, []);

  // Restore session on app start
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    (async () => {
      const saved = await getItem(TOKEN_KEY);
      if (saved) {
        setToken(saved);
        try {
          setUser(await api.me());
        } catch {
          await logout();
        }
      }
      setLoading(false);
    })();
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => finishAuth(await api.login(email.trim(), password)),
      register: async (data) => finishAuth(await api.register({ ...data, email: data.email.trim() })),
      logout,
      setUser,
    }),
    [user, loading, finishAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
