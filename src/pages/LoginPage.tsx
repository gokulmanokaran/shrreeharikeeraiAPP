import React, { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Mail, Phone, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { EmailOtpVerification } from "../components/features/EmailOtpVerification";
import { GoogleAuthButton } from "../components/features/GoogleAuthButton";
import {
  loginCustomer,
  sendPhoneLoginOtp,
  verifyPhoneLoginOtp,
  resendPhoneLoginOtp,
} from "../services/authService";
import { useAuth } from "../store/AuthContext";
import { validatePassword, validateRequiredEmail } from "../utils/validation";

const RESEND_COOLDOWN = 60;
const EXPIRY_SECONDS = 120;
const MAX_ATTEMPTS = 3;

// ── Inline Phone OTP panel (no new component file needed) ────────────────────
function PhoneOtpPanel({
  phone,
  onSuccess,
  onBack,
}: {
  phone: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [expiryTimer, setExpiryTimer] = useState(EXPIRY_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const attemptsRef = useRef(MAX_ATTEMPTS);
  const blockedRef = useRef(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first box
  useEffect(() => {
    const t = setTimeout(() => inputsRef.current[0]?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  // Resend countdown
  useEffect(() => {
    setCanResend(false);
    const iv = setInterval(() => {
      setResendTimer((p) => {
        if (p <= 1) { setCanResend(true); clearInterval(iv); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [info]); // restart on each resend

  // Expiry countdown
  useEffect(() => {
    const iv = setInterval(() => {
      setExpiryTimer((p) => {
        if (p <= 1) {
          clearInterval(iv);
          if (!blockedRef.current) {
            setError("OTP has expired. Please click Resend.");
            setOtp(["", "", "", "", "", ""]);
          }
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [info]); // restart on each resend

  const handleVerify = async (codeOverride?: string) => {
    if (blockedRef.current || expiryTimer <= 0) return;
    const code = codeOverride || otp.join("");
    if (code.length !== 6) { setError("Please enter the complete 6-digit OTP."); return; }

    setVerifying(true);
    setError("");
    const res = await verifyPhoneLoginOtp(phone, code);
    setVerifying(false);

    if (!res.error) { onSuccess(); return; }

    const left = attemptsRef.current - 1;
    attemptsRef.current = left;
    if (left <= 0) {
      blockedRef.current = true;
      setError("Too many incorrect attempts. Please resend a new OTP.");
      setOtp(["", "", "", "", "", ""]);
      return;
    }
    setError(`${res.error} (${left} attempt${left === 1 ? "" : "s"} left)`);
    setOtp(["", "", "", "", "", ""]);
    setTimeout(() => inputsRef.current[0]?.focus(), 50);
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setError("");
    blockedRef.current = false;
    attemptsRef.current = MAX_ATTEMPTS;
    setOtp(["", "", "", "", "", ""]);
    setResendTimer(RESEND_COOLDOWN);
    setExpiryTimer(EXPIRY_SECONDS);
    setCanResend(false);

    const res = await resendPhoneLoginOtp(phone);
    setResending(false);
    if (res.error) { setError(res.error); return; }
    setInfo("new"); // trigger timer restart
    setTimeout(() => inputsRef.current[0]?.focus(), 200);
  };

  const handleChange = (i: number, val: string) => {
    const ch = val.replace(/\D/g, "").slice(-1);
    const n = [...otp]; n[i] = ch; setOtp(n); setError("");
    if (ch && i < 5) inputsRef.current[i + 1]?.focus();
    if (ch && i === 5 && n.join("").length === 6) handleVerify(n.join(""));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!p) return;
    const n = Array.from({ length: 6 }, (_, i) => p[i] || "");
    setOtp(n);
    inputsRef.current[Math.min(p.length, 5)]?.focus();
    if (p.length === 6) handleVerify(p);
  };

  const maskedPhone = `+91 ${phone.slice(0, 2)}****${phone.slice(-4)}`;
  const expiryMin = Math.floor(expiryTimer / 60);
  const expirySec = expiryTimer % 60;

  return (
    <motion.div
      key="phone-otp"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00A651] hover:underline cursor-pointer"
      >
        <ArrowLeft size={14} />
        Change number
      </button>

      <div className="bg-[#F5FCF8] border border-[#B9E8CE]/60 rounded-[12px] p-3 text-xs text-[#087A43]">
        <p className="font-semibold">
          OTP sent to <span className="font-black text-[#111111]">{maskedPhone}</span>
        </p>
        <p className="text-[11px] text-[#555555] mt-0.5">
          Enter the 6-digit code from your SMS.
          {expiryTimer > 0 && (
            <span className={`ml-1.5 font-bold ${expiryTimer <= 30 ? "text-[#EA4335]" : "text-[#087A43]"}`}>
              Expires in {expiryMin > 0 ? `${expiryMin}m ` : ""}
              {String(expirySec).padStart(2, "0")}s
            </span>
          )}
        </p>
      </div>

      {/* 6-digit OTP boxes */}
      <div className="flex justify-between gap-2 py-1">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={blockedRef.current || expiryTimer <= 0}
            aria-label={`OTP digit ${i + 1}`}
            className={`w-11 h-13 text-center text-lg font-black rounded-[12px] border-2 transition-all focus:outline-none disabled:opacity-40 ${
              digit
                ? "border-[#00A651] bg-[#EAF8F0]/30 text-[#00A651]"
                : error
                ? "border-[#EA4335] bg-red-50/30 text-[#111111]"
                : "border-[#EAEAEA] focus:border-[#00A651] text-[#111111]"
            }`}
          />
        ))}
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2.5"
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </motion.p>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={verifying}
        disabled={blockedRef.current || expiryTimer <= 0 || otp.join("").length < 6}
        onClick={() => handleVerify()}
      >
        {verifying ? "Verifying…" : "Verify & Sign In"}
      </Button>

      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-[#777777]">Didn't receive the OTP?</span>
        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-bold text-[#00A651] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
            {resending ? "Sending…" : "Resend OTP"}
          </button>
        ) : (
          <span className="text-[#999999] font-medium">
            Resend in <span className="font-bold text-[#111111]">{resendTimer}s</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Login Page ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, initializing } = useAuth();
  const from =
    (location.state as { from?: { pathname?: string } | string } | null)?.from;
  const targetPath = typeof from === "string" ? from : from?.pathname || "/";

  // Mode: email login or phone login
  const [mode, setMode] = useState<"email" | "phone">("email");

  // Email login state
  const [emailStep, setEmailStep] = useState<"login" | "otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailErrors, setEmailErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [emailLoading, setEmailLoading] = useState(false);

  // Phone login state
  const [phoneStep, setPhoneStep] = useState<"enter" | "sending" | "otp">("enter");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneSending, setPhoneSending] = useState(false);

  // Check location state / URL for OAuth errors
  useEffect(() => {
    const stateErr = (location.state as { error?: string } | null)?.error;
    if (stateErr) { setEmailErrors({ form: stateErr }); return; }

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
      if (typeof window !== "undefined") sessionStorage.removeItem("shreehari_auth_redirect");
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.search, location.hash, location.pathname, location.state]);

  // Redirect if already authenticated
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
    if (res.needsEmailVerification) { setEmailStep("otp"); return; }
    if (res.error) { setEmailErrors({ form: res.error }); return; }
    navigate(targetPath === "/login" ? "/" : targetPath, { replace: true });
  };

  const handleSendPhoneOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setPhoneError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    setPhoneSending(true);
    setPhoneError("");
    const res = await sendPhoneLoginOtp(digits);
    setPhoneSending(false);
    if (res.error) { setPhoneError(res.error); return; }
    setPhoneStep("otp");
  };

  const handlePhoneSuccess = () => {
    navigate(targetPath === "/login" ? "/" : targetPath, { replace: true });
  };

  // ── Tab UI helpers ─────────────────────────────────────────────────────────
  const tabBase =
    "flex-1 h-10 rounded-[10px] text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer";
  const tabActive = "bg-[#00A651] text-white shadow-sm";
  const tabInactive = "text-[#666666] hover:bg-gray-100";

  // Determine title/subtitle based on current state
  const getTitle = () => {
    if (mode === "phone") {
      if (phoneStep === "otp") return "Verify OTP";
      return "Welcome Back";
    }
    if (emailStep === "otp") return "Verify Your Email";
    return "Welcome Back";
  };
  const getSubtitle = () => {
    if (mode === "phone") {
      if (phoneStep === "otp") return `Enter the code sent to +91 ${phone.slice(0, 2)}****${phone.slice(-4)}`;
      return "Log in with your mobile number";
    }
    if (emailStep === "otp") return `Enter the code sent to ${email}`;
    return "Log in with your email and password";
  };

  return (
    <AuthLayout title={getTitle()} subtitle={getSubtitle()}>
      <AnimatePresence mode="wait">

        {/* ── Email OTP verification step ─────────────────────────────────── */}
        {mode === "email" && emailStep === "otp" ? (
          <EmailOtpVerification
            key="email-otp"
            email={email}
            onSuccess={() => navigate(targetPath === "/login" ? "/" : targetPath, { replace: true })}
            onChangeEmail={() => { setEmailStep("login"); setEmailErrors({}); }}
            submitButtonText="Verify & Sign In"
          />
        ) : mode === "phone" && phoneStep === "otp" ? (

          /* ── Phone OTP verification step ──────────────────────────────────── */
          <PhoneOtpPanel
            key="phone-otp"
            phone={phone.replace(/\D/g, "")}
            onSuccess={handlePhoneSuccess}
            onBack={() => setPhoneStep("enter")}
          />
        ) : (

          /* ── Main login form ──────────────────────────────────────────────── */
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
                onClick={() => { setMode("email"); setEmailErrors({}); }}
                id="tab-email-login"
              >
                <Mail size={14} />
                Email
              </button>
              <button
                type="button"
                className={`${tabBase} ${mode === "phone" ? tabActive : tabInactive}`}
                onClick={() => { setMode("phone"); setPhoneError(""); setPhoneStep("enter"); }}
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
                      setEmailErrors((p) => ({ ...p, email: undefined, form: undefined }));
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
                        setEmailErrors((p) => ({ ...p, password: undefined, form: undefined }));
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
                    loading={phoneSending}
                    disabled={phone.replace(/\D/g, "").length < 10}
                    onClick={handleSendPhoneOtp}
                    id="send-phone-otp-btn"
                  >
                    {phoneSending ? "Sending OTP…" : "Send OTP"}
                  </Button>

                  <p className="text-[11px] text-[#888888] text-center">
                    An OTP will be sent to your registered mobile number via SMS.
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
                  Sign Up
                </Link>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
