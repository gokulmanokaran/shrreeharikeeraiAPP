import { useState, useEffect } from "react";
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

  const [step, setStep] = useState<"login" | "otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  // Check location state, URL params, or hash for OAuth error or cancellation
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
      } else if (targetPath && targetPath !== "/login") {
        navigate(targetPath, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, initializing, targetPath, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    const emailErr = validateRequiredEmail(email);
    const passErr = validatePassword(password);

    if (emailErr || passErr) {
      setErrors({
        email: emailErr || undefined,
        password: passErr || undefined,
      });
      return;
    }

    setLoading(true);
    setErrors({});

    const res = await loginCustomer({ email, password });
    setLoading(false);

    if (res.needsEmailVerification) {
      setStep("otp");
      return;
    }

    if (res.error) {
      setErrors({ form: res.error });
      return;
    }

    navigate(targetPath === "/login" ? "/" : targetPath, { replace: true });
  };

  const handleVerifiedSuccess = () => {
    navigate(targetPath === "/login" ? "/" : targetPath, { replace: true });
  };

  return (
    <AuthLayout
      title={step === "login" ? "Welcome Back" : "Verify Your Email"}
      subtitle={
        step === "login"
          ? "Log in with your email and password"
          : `Enter the code sent to ${email}`
      }
    >
      <AnimatePresence mode="wait">
        {step === "login" ? (
          <motion.div
            key="login-form"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <form onSubmit={handleLogin} className="space-y-3.5" noValidate>
              <AuthField
                id="login-email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  setErrors((prev) => ({ ...prev, email: undefined, form: undefined }));
                }}
                error={errors.email}
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
                    setErrors((prev) => ({ ...prev, password: undefined, form: undefined }));
                  }}
                  error={errors.password}
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

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
              >
                Sign In
              </Button>
            </form>

            <GoogleAuthButton
              targetPath={targetPath}
              onError={(err) => setErrors({ form: err })}
            />

            <div className="pt-2 text-center">
              <p className="text-sm text-[#666666]">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  state={{ from: location.state?.from || from }}
                  className="font-bold text-[#00A651] hover:underline"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </motion.div>
        ) : (
          <EmailOtpVerification
            key="otp-step"
            email={email}
            onSuccess={handleVerifiedSuccess}
            onChangeEmail={() => {
              setStep("login");
              setErrors({});
            }}
            submitButtonText="Verify & Sign In"
          />
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
