import React, { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { EmailOtpVerification } from "../components/features/EmailOtpVerification";
import { GoogleAuthButton } from "../components/features/GoogleAuthButton";
import { registerCustomer } from "../services/authService";
import { useAuth } from "../store/AuthContext";
import {
  validateConfirmPassword,
  validateName,
  validatePassword,
  validateRequiredEmail,
} from "../utils/validation";

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, initializing } = useAuth();
  const from =
    (location.state as { from?: { pathname?: string } | string } | null)?.from;
  const targetPath = typeof from === "string" ? from : from?.pathname || "/";

  // Email Signup state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(
    () => (location.state as { email?: string } | null)?.email || ""
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailErrors, setEmailErrors] = useState<Record<string, string | undefined>>({});
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailStep, setEmailStep] = useState<"form" | "otp">("form");
  const [otpWarning, setOtpWarning] = useState<string | undefined>();

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
      } else if (targetPath && targetPath !== "/signup") {
        navigate(targetPath, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, initializing, targetPath, navigate]);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailAlreadyExists(false);
    const next = {
      fullName: validateName(fullName) || undefined,
      email: validateRequiredEmail(email) || undefined,
      password: validatePassword(password) || undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) || undefined,
    };

    if (Object.values(next).some(Boolean)) {
      setEmailErrors(next);
      return;
    }

    setEmailLoading(true);
    setEmailErrors({});

    const result = await registerCustomer({
      fullName,
      email,
      password,
      confirmPassword,
    });

    setEmailLoading(false);

    if (result.emailAlreadyExists || (result.error && /already exists/i.test(result.error))) {
      setEmailAlreadyExists(true);
      setEmailErrors({ form: result.error || "An account already exists with this email address. Please log in instead." });
      return;
    }

    if (result.error) {
      setEmailErrors({ form: result.error });
      return;
    }

    if (result.needsEmailVerification) {
      setOtpWarning(result.warning);
      setEmailStep("otp");
      return;
    }

    // Direct login if confirmations disabled
    navigate(targetPath === "/signup" ? "/" : targetPath, { replace: true });
  };

  const getTitle = () => {
    if (emailStep === "otp") return "Verify Your Email";
    return "Create Account";
  };

  return (
    <AuthLayout title={getTitle()}>
      <AnimatePresence mode="wait">
        {/* Email OTP verification step (Supabase email flow) */}
        {emailStep === "otp" ? (
          <EmailOtpVerification
            key="signup-email-otp"
            email={email}
            initialWarning={otpWarning}
            onSuccess={() => navigate(targetPath === "/signup" ? "/" : targetPath, { replace: true })}
            onChangeEmail={() => {
              setEmailStep("form");
              setEmailErrors({});
              setOtpWarning(undefined);
            }}
            submitButtonText="Verify & Continue"
          />
        ) : (
          /* Main signup form */
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
              <span className="text-xs font-semibold text-[#AAAAAA]">or sign up with email</span>
              <div className="flex-1 h-px bg-[#EAEAEA]" />
            </div>

            {/* Email & Password Signup Form */}
            <motion.form
              key="email-signup-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onSubmit={handleEmailSubmit}
              className="space-y-3.5"
              noValidate
            >
              <AuthField
                id="signup-email-name"
                label="Full Name"
                value={fullName}
                onChange={(v) => {
                  setFullName(v);
                  setEmailErrors((e) => ({ ...e, fullName: undefined, form: undefined }));
                }}
                error={emailErrors.fullName}
                placeholder="e.g. Raj Kumar"
                autoComplete="name"
              />

              <AuthField
                id="signup-email-address"
                label="Email Address"
                type="email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  setEmailAlreadyExists(false);
                  setEmailErrors((e) => ({ ...e, email: undefined, form: undefined }));
                }}
                error={emailErrors.email}
                placeholder="your@email.com"
                autoComplete="email"
              />

              <AuthField
                id="signup-password"
                label="Password"
                type="password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setEmailErrors((e) => ({ ...e, password: undefined, form: undefined }));
                }}
                error={emailErrors.password}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
              />

              <AuthField
                id="signup-confirm"
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(v) => {
                  setConfirmPassword(v);
                  setEmailErrors((e) => ({ ...e, confirmPassword: undefined, form: undefined }));
                }}
                error={emailErrors.confirmPassword}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />

              {emailAlreadyExists ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-300 rounded-[14px] p-4 text-center space-y-2.5"
                >
                  <div className="flex items-center justify-center gap-2 text-amber-900 font-bold text-sm">
                    <AlertCircle size={18} className="text-amber-600 shrink-0" />
                    <span>An account already exists with this email address. Please log in instead.</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    Your account is already registered. Sign in with your password or use Google.
                  </p>
                  <Link
                    to="/login"
                    state={{ email, from: location.state?.from || from }}
                    className="inline-flex items-center justify-center w-full h-11 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-sm rounded-[12px] shadow-sm transition-all"
                  >
                    Go to Login
                  </Link>
                </motion.div>
              ) : emailErrors.form ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2.5"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{emailErrors.form}</span>
                </motion.p>
              ) : null}

              <Button type="submit" variant="primary" size="lg" fullWidth loading={emailLoading}>
                Create Account
              </Button>
            </motion.form>

            <div className="pt-2 text-center">
              <p className="text-sm text-[#666666]">
                Already have an account?{" "}
                <Link
                  to="/login"
                  state={{ from: location.state?.from || from }}
                  className="font-bold text-[#00A651] hover:underline"
                >
                  Login
                </Link>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
