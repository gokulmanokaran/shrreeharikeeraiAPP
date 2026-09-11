import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSupabaseClient } from "../lib/supabase";
import { fetchProfile } from "../services/authService";
import { useAuth } from "../store/AuthContext";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile } = useAuth();
  const [statusMessage, setStatusMessage] = useState("Completing Google sign in...");
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const supabase = getSupabaseClient();
    if (!supabase) {
      navigate("/login", { replace: true });
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const hashStr = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    const hashParams = new URLSearchParams(hashStr);

    // 1. Check for OAuth error or cancellation
    const errorDesc =
      searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error");

    if (errorDesc) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("shreehari_auth_redirect");
      }
      navigate("/login", {
        replace: true,
        state: { error: decodeURIComponent(errorDesc.replace(/\+/g, " ")) },
      });
      return;
    }

    // 2. Helper to finalize login and navigate to saved redirect or home
    const finalizeLogin = async (userId: string, email?: string, fullName?: string) => {
      setStatusMessage("Setting up your account...");
      try {
        await fetchProfile(userId, { email, fullName });
        await refreshProfile();
      } catch {
        /* proceed even if profile fetch fails */
      }

      const savedRedirect =
        typeof window !== "undefined"
          ? sessionStorage.getItem("shreehari_auth_redirect")
          : null;

      if (savedRedirect) {
        sessionStorage.removeItem("shreehari_auth_redirect");
        navigate(savedRedirect, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    };

    // 3. Process PKCE code if present
    const code = searchParams.get("code");
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            console.warn("[AuthCallback] Error exchanging code for session:", error.message);
            // Fall back to getSession() in case already exchanged
            return supabase.auth.getSession();
          }
          return { data: { session: data.session }, error: null };
        })
        .then(({ data }) => {
          if (data?.session?.user) {
            const user = data.session.user;
            const fullName = String(
              user.user_metadata?.full_name || user.user_metadata?.name || ""
            );
            finalizeLogin(user.id, user.email, fullName);
          } else {
            navigate("/login", { replace: true });
          }
        })
        .catch((err) => {
          console.warn("[AuthCallback] Exchange code exception:", err);
          navigate("/login", { replace: true });
        });
      return;
    }

    // 4. Handle implicit hash token or existing session
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data?.session?.user) {
          const user = data.session.user;
          const fullName = String(
            user.user_metadata?.full_name || user.user_metadata?.name || ""
          );
          finalizeLogin(user.id, user.email, fullName);
        } else {
          // Listen briefly for onAuthStateChange in case session is hydrating
          const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
              sub.subscription.unsubscribe();
              const user = session.user;
              const fullName = String(
                user.user_metadata?.full_name || user.user_metadata?.name || ""
              );
              finalizeLogin(user.id, user.email, fullName);
            }
          });

          // Timeout safety
          setTimeout(() => {
            sub.subscription.unsubscribe();
            navigate("/login", { replace: true });
          }, 4500);
        }
      })
      .catch(() => {
        navigate("/login", { replace: true });
      });
  }, [location.search, location.hash, navigate, refreshProfile]);

  return (
    <div className="min-h-dvh bg-white flex flex-col items-center justify-center p-6 select-none">
      <div className="w-10 h-10 rounded-full border-3 border-[#EAF8F0] border-t-[#00A651] animate-spin mb-3" />
      <span className="text-[11px] font-bold text-[#087A43] tracking-widest uppercase mb-1">
        Shree Hari Keerai
      </span>
      <h2 className="text-base font-black text-[#111111]">{statusMessage}</h2>
      <p className="text-xs text-[#666666] mt-1">Please wait while we redirect you...</p>
    </div>
  );
}
