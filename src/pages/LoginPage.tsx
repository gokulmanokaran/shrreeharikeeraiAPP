import React, { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Mail, Phone } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { EmailOtpVerification } from "../components/features/EmailOtpVerification";
import { PhoneOtpVerification } from "../components/features/PhoneOtpVerification";
import { GoogleAuthButton } from "../components/features/GoogleAuthButton";
import { loginCustomer } from "../services/authService";
import { completePhoneLogin, isValidIndianPhone } from "../services/phoneOtpService";
import { useAuth } from "../store/AuthContext";
import { validatePassword, validateRequiredEmail } from "../utils/validation";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, initializing } = useAuth();
  const from =
    (location.state as { from?: { pathname?: string } | string } | null)?.from;
  const targetPath = typeof from === "string" ? from : from?.pathname || "/";

  // Mode: "email" | "phone"
  const [mode, setMode] = useState<"email" | "phone">("email");

  // Email login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailErrors, setEmailErrors] = useState<Record<string, string | undefined>>({});
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailStep, setEmailStep] = useState<"login" | "otp">("login");

  // Phone login state (100% Firebase OTP, zero Twilio)
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter" | "otp">("enter");
  const [phoneCompleting, setPhoneCompleting] = useState(false);

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

  const handleSendPhoneOtp = () => {
    const digits = phone.replace(/\D/g, "");
    if (!isValidIndianPhone(digits)) {
      setPhoneError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    setPhoneError("");
    setPhoneStep("otp");
  };

  const handlePhoneOtpSuccess = async (verifiedPhone: string) => {
    setPhoneCompleting(true);
    setPhoneError("");
    const res = await completePhoneLogin(verifiedPhone);
    setPhoneCompleting(false);

    if (res.error) {
      setPhoneError(res.error);
      setPhoneStep("enter");
      return;
    }

    navigate(targetPath === "/login" ? "/" : targetPath, { replace: true });
  };

  // ── Tab UI styling ─────────────────────────────────────────────────────────
  const tabBase =
    "flex-1 h-10 rounded-[10px] text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer";
  const tabActive = "bg-[#00A651] text-white shadow-sm";
  const tabInactive = "text-[#666666] hover:bg-gray-100";

  const getTitle = () => {
    if (mode === "phone" && phoneStep === "otp") return "Verify Mobile OTP";
    if (mode === "email" && emailStep === "otp") return "Verify Your Email";
    return "Welcome Back";
  };

  const getSubtitle = () => {
    if (mode === "phone" && phoneStep === "otp") {
      return `Enter the 6-digit code sent to +91 ${phone.slice(0, 2)}****${phone.slice(-4)}`;
    }
    if (mode === "phone") return "Log in with your mobile number via OTP";
    if (emailStep === "otp") return `Enter the code sent to ${email}`;
    return "Log in to your Shree Hari Keerai account";
  };

  return (
    <AuthLayout title={getTitle()} subtitle={getSubtitle()}>
      <AnimatePresence mode="wait">
        {/* Email OTP verification step */}
        {mode === "email" && emailStep === "otp" ? (
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
        ) : mode === "phone" && phoneStep === "otp" ? (
          /* Phone OTP verification step via Firebase */
          <motion.div
            key="phone-otp"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.18 }}
          >
            {phoneCompleting ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-[#00A651]">
                <div className="w-8 h-8 border-3 border-[#00A651] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-[#111111]">Signing you into Shree Hari Keerai…</p>
              </div>
            ) : (
              <PhoneOtpVerification
                phone={phone.replace(/\D/g, "")}
                title="Login Verification"
                submitButtonText="Verify & Sign In"
                containerId="login-phone-recaptcha"
                onSuccess={handlePhoneOtpSuccess}
                onCancel={() => setPhoneStep("enter")}
              />
            )}
          </motion.div>
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
            {/* Mode tabs */}
            <div className="flex gap-1.5 bg-[#F5F5F5] p-1 rounded-[12px]">
              <button
                type="button"
                className={`${tabBase} ${mode === "email" ? tabActive : tabInactive}`}
                onClick={() => {
                  setMode("email");
                  setEmailErrors({});
                }}
                id="tab-email-login"
              >
                <Mail size={14} />
                Email
              </button>
              <button
                type="button"
                className={`${tabBase} ${mode === "phone" ? tabActive : tabInactive}`}
                onClick={() => {
                  setMode("phone");
                  setPhoneError("");
                  setPhoneStep("enter");
                }}
                id="tab-phone-login"
              >
                <Phone size={14} />
                Mobile OTP
              </button>
            </div>

            <AnimatePresence mode="wait">
              {/* Email login form */}
              {mode === "email" && (
                <motion.form
                  key="email-form"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
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
              )}

              {/* Phone login form */}
              {mode === "phone" && (
                <motion.div
                  key="phone-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3.5"
                >
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-phone" className="text-xs font-bold text-[#555555]">
                      Mobile Number
                    </label>
                    <div className="flex items-center h-12 border-2 rounded-[12px] overflow-hidden transition-colors focus-within:border-[#00A651] border-[#EAEAEA] bg-white">
                      <span className="pl-4 pr-2 text-sm font-bold text-[#555555] border-r border-[#EAEAEA] h-full flex items-center">
                        +91
                      </span>
                      <input
                        id="login-phone"
                        type="tel"
                        inputMode="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value.replace(/\D/g, ""));
                          setPhoneError("");
                        }}
                        placeholder="10-digit mobile number"
                        autoComplete="tel"
                        className="flex-1 h-full px-3 text-sm font-medium focus:outline-none bg-transparent"
                      />
                    </div>
                    {phoneError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2.5"
                      >
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{phoneError}</span>
                      </motion.p>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={phone.replace(/\D/g, "").length < 10}
                    onClick={handleSendPhoneOtp}
                    id="send-phone-otp-btn"
                  >
                    Send OTP via SMS
                  </Button>

                  <p className="text-[11px] text-[#888888] text-center">
                    A 6-digit OTP will be sent to your mobile number via Firebase SMS.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Google OAuth — always shown on main form */}
            <GoogleAuthButton
              targetPath={targetPath}
              onError={(err) => setEmailErrors({ form: err })}
            />

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
