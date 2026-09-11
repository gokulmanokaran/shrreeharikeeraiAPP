import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AdminSession } from "../types";
import { getStoredSession, authenticateAdmin, clearSession } from "../services/api";

interface AuthContextValue {
  session: AdminSession | null;
  isAuthenticated: boolean;
  login: (pinOrPassword: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(() => getStoredSession());

  useEffect(() => {
    const existing = getStoredSession();
    if (existing) {
      setSession(existing);
    }
  }, []);

  const login = useCallback(async (pinOrPassword: string) => {
    const s = await authenticateAdmin(pinOrPassword);
    setSession(s);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: Boolean(session && session.token),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
