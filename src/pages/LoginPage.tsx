import React, { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { EmailOtpVerification } from "../components/features/EmailOtpVerification";
import { GoogleAuthButton } from "../components/features/GoogleAuthButton";
import { loginCustomer } from "../services/authService";
import { useAuth } from "../store/AuthContext";
import { validatePassword, validateRequiredEmail } from "../utils/validation";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, initializing } = useAuth();
  const from =
    (location.state as { from?: { pathname?: string } | string } | null)?.from;
  const targetPath = typeof from === "string" ? from : from?.pathname || "/";

  // Email login state
  const stateEmail = (location.state as { email?: string } | null)?.email || "";
  const [email, setEmail] = useState(stateEmail);
  const [password, setPassword] = useState("");
  const [emailErrors, setEmailErrors] = useState<Record<string, string | undefined>>({});
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailStep, setEmailStep] = useState<"login" | "otp">("login");

  useEffect(() => {
    const sEmail = (location.state as { email?: string } | null)?.email;
    if (sEmail) {
      setEmail(sEmail);
    }
  }, [location.state]);

  // Check URL params / hash for OAuth error on return from Google
  useEffect(() => {
    const stateErr = (location.state as { error?: string } | null)?.error;
    if (stateErr) {
      setEmailErrors({ form: stateErr });
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const hashStr = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    const hashParams = new URLSearchParams(hashStr);

    const errorDesc =
      searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error");

    if (errorDesc) {
      setEmailErrors({ form: decodeURIComponent(errorDesc.replace(/\+/g, " ")) });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("shreehari_auth_redirect");
      }
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.search, location.hash, location.pathname, location.state]);

  // If already authenticated, redirect
  useEffect(() => {
    if (!initializing && user) {
      const saved =
        typeof window !== "undefined"
          ? sessionStorage.getItem("shreehari_auth_redirect")
          : null;
      if (saved) {
        sessionStorage.removeItem("shreehari_auth_redirect");
        navigate(saved, { replace: true });
      } else if (targetPath && targetPath !== "/login") {
        navigate(targetPath, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, initializing, targetPath, navigate]);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    const emailErr = validateRequiredEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) {
      setEmailErrors({ email: emailErr || undefined, password: passErr || undefined });
      return;
    }
    setEmailLoading(true);
    setEmailErrors({});
    const res = await loginCustomer({ email, password });
    setEmailLoading(false);
    if (res.needsEmailVerification) {
      setEmailStep("otp");
      return;
    }
    if (res.error) {
      setEmailErrors({ form: res.error });
      return;
    }
    navigate(targetPath === "/login" ? "/" : targetPath, { replace: true });
  };

  const getTitle = () => {
    if (emailStep === "otp") return "Verify Your Email";
    return "Welcome Back";
  };

  return (
    <AuthLayout title={getTitle()}>
      <AnimatePresence mode="wait">
        {/* Email OTP verification step */}
        {emailStep === "otp" ? (
          <EmailOtpVerification
            key="email-otp"
            email={email}
            onSuccess={() => navigate(targetPath === "/login" ? "/" : targetPath, { replace: true })}
            onChangeEmail={() => {
              setEmailStep("login");
              setEmailErrors({});
            }}
            submitButtonText="Verify & Sign In"
          />
        ) : (
          /* Main login form */
          <motion.div
            key="main-form"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Google OAuth */}
            <GoogleAuthButton
              targetPath={targetPath}
              onError={(err) => setEmailErrors({ form: err })}
            />

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#EAEAEA]" />
              <span className="text-xs font-semibold text-[#AAAAAA]">or</span>
              <div className="flex-1 h-px bg-[#EAEAEA]" />
            </div>

            {/* Email & Password form */}
            <motion.form
              key="email-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onSubmit={handleEmailLogin}
              className="space-y-3.5"
              noValidate
            >
              <AuthField
                id="login-email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  setEmailErrors((e) => ({ ...e, email: undefined, form: undefined }));
                }}
                error={emailErrors.email}
                placeholder="your@email.com"
                autoComplete="email"
              />

              <div className="space-y-1">
                <AuthField
                  id="login-password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    setEmailErrors((e) => ({ ...e, password: undefined, form: undefined }));
                  }}
                  error={emailErrors.password}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <div className="flex justify-end pt-0.5">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-[#00A651] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {emailErrors.form && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2.5"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{emailErrors.form}</span>
                </motion.p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={emailLoading}
              >
                Sign In
              </Button>
            </motion.form>

            <div className="pt-2 text-center">
              <p className="text-sm text-[#666666]">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  state={{ from: location.state?.from || from }}
                  className="font-bold text-[#00A651] hover:underline"
                >
                  Create Account
                </Link>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
