import { useState, useEffect } from "react";
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

  const [step, setStep] = useState<"form" | "otp">("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(false);

  // Check URL params / hash or location.state for OAuth error or cancellation on return from Google
  useEffect(() => {
    const stateErr = (location.state as { error?: string } | null)?.error;
    if (stateErr) {
      setErrors({ form: stateErr });
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
      setErrors({ form: decodeURIComponent(errorDesc.replace(/\+/g, " ")) });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("shreehari_auth_redirect");
      }
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.search, location.hash, location.pathname, location.state]);

  // If already authenticated or just returned from Google OAuth, proceed to target
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      fullName: validateName(fullName) || undefined,
      email: validateRequiredEmail(email) || undefined,
      password: validatePassword(password) || undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) || undefined,
    };
    if (Object.values(next).some(Boolean)) {
      setErrors(next);
      return;
    }
    setLoading(true);
    setErrors({});
    const result = await registerCustomer({ fullName, email, password, confirmPassword });
    setLoading(false);

    if (result.error) {
      setErrors({ form: result.error });
      return;
    }

    if (result.needsEmailVerification) {
      setStep("otp");
      return;
    }

    // Direct login if confirmations disabled
    navigate(targetPath === "/signup" ? "/" : targetPath, { replace: true });
  };

  const handleVerifiedSuccess = () => {
    navigate(targetPath === "/signup" ? "/" : targetPath, { replace: true });
  };

  return (
    <AuthLayout
      title={step === "form" ? "Create Account" : "Verify Your Email"}
      subtitle={
        step === "form"
          ? "Join Shree Hari Keerai for fresh, doorstep delivery."
          : `Enter the code sent to ${email}`
      }
    >
      <AnimatePresence mode="wait">
        {step === "form" ? (
          <motion.div
            key="signup-form"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
              <AuthField
                id="signup-name"
                label="Full Name"
                value={fullName}
                onChange={(v) => {
                  setFullName(v);
                  setErrors((e) => ({ ...e, fullName: undefined, form: undefined }));
                }}
                error={errors.fullName}
                placeholder="e.g. Raj Kumar"
                autoComplete="name"
              />
              <AuthField
                id="signup-email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  setErrors((e) => ({ ...e, email: undefined, form: undefined }));
                }}
                error={errors.email}
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
                  setErrors((e) => ({ ...e, password: undefined, form: undefined }));
                }}
                error={errors.password}
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
                  setErrors((e) => ({ ...e, confirmPassword: undefined, form: undefined }));
                }}
                error={errors.confirmPassword}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />

              {errors.form && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2.5"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{errors.form}</span>
                </motion.p>
              )}

              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                Create Account
              </Button>
            </form>

            <GoogleAuthButton
              targetPath={targetPath}
              onError={(err) => setErrors({ form: err })}
            />

            <p className="text-sm text-[#666666] text-center pt-2">
              Already have an account?{" "}
              <Link
                to="/login"
                state={{ from: location.state?.from || from }}
                className="font-bold text-[#00A651] hover:underline"
              >
                Login
              </Link>
            </p>
          </motion.div>
        ) : (
          <EmailOtpVerification
            key="signup-otp"
            email={email}
            onSuccess={handleVerifiedSuccess}
            onChangeEmail={() => {
              setStep("form");
              setErrors({});
            }}
            submitButtonText="Verify & Continue"
          />
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
