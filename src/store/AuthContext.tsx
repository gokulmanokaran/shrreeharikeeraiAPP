import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";
import {
  fetchProfile,
  logoutCustomer,
  type CustomerProfile,
} from "../services/authService";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: CustomerProfile | null;
  initializing: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function metaFromUser(user: User | null) {
  if (!user) return { email: "", fullName: "", mobile: "" };
  return {
    email: user.email || "",
    fullName: String(
      user.user_metadata?.full_name || user.user_metadata?.name || ""
    ),
    mobile: String(user.user_metadata?.mobile || ""),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  const loadProfile = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setProfile(null);
      return;
    }
    const next = await fetchProfile(nextUser.id, metaFromUser(nextUser));
    setProfile(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    if (!supabase) {
      setInitializing(false);
      return;
    }

    // Hydrate existing session from Supabase on mount
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          loadProfile(data.session.user).finally(() => {
            if (!cancelled) setInitializing(false);
          });
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setInitializing(false);
        }
      })
      .catch(() => {
        if (!cancelled) setInitializing(false);
      });

    // Listen to all auth state changes (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED, etc.)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      if (nextSession) {
        setSession(nextSession);
        setUser(nextSession.user);
        loadProfile(nextSession.user);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem("shreehari_orders");
            localStorage.removeItem("shreehari_latest_order");
            localStorage.removeItem("shreehari_guest_details");
            localStorage.removeItem("shreehari_pending_order");
            localStorage.removeItem("shreehari_submitted_order_ids");
            sessionStorage.removeItem("shreehari_pending_order");
          }
        } catch {}
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const logout = useCallback(async () => {
    await logoutCustomer();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const latestUser = data?.user ?? user;
    if (latestUser) {
      setUser(latestUser);
      await loadProfile(latestUser);
    }
  }, [user, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      initializing,
      refreshProfile,
      logout,
    }),
    [user, session, profile, initializing, refreshProfile, loadProfile, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
