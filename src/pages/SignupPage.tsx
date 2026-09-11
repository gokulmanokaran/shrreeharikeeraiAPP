import React, { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Mail, Phone, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { EmailOtpVerification } from "../components/features/EmailOtpVerification";
import { PhoneOtpVerification } from "../components/features/PhoneOtpVerification";
import { GoogleAuthButton } from "../components/features/GoogleAuthButton";
import { registerCustomer } from "../services/authService";
import { completePhoneSignup, isValidIndianPhone } from "../services/phoneOtpService";
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

  // Mode: "phone" (Mobile OTP) | "email" (Email + Password)
  const [mode, setMode] = useState<"phone" | "email">("phone");

  // Common fields
  const [fullName, setFullName] = useState("");

  // ── Phone OTP Signup state ────────────────────────────────────────────────
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter" | "otp">("enter");
  const [phoneErrors, setPhoneErrors] = useState<Record<string, string | undefined>>({});
  const [phoneCompleting, setPhoneCompleting] = useState(false);

  // ── Email Signup state ────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailMobile, setEmailMobile] = useState("");
  const [emailMobileVerified, setEmailMobileVerified] = useState(false);
  const [showEmailMobileOtp, setShowEmailMobileOtp] = useState(false);
  const verifiedMobileRef = useRef("");
  const [emailErrors, setEmailErrors] = useState<Record<string, string | undefined>>({});
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailStep, setEmailStep] = useState<"form" | "otp">("form");

  // Check URL params / hash for OAuth error or cancellation on return from Google
  useEffect(() => {
    const stateErr = (location.state as { error?: string } | null)?.error;
    if (stateErr) {
      setPhoneErrors({ form: stateErr });
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
      const errDecoded = decodeURIComponent(errorDesc.replace(/\+/g, " "));
      setPhoneErrors({ form: errDecoded });
      setEmailErrors({ form: errDecoded });
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

  // ── Phone OTP Signup Handlers ─────────────────────────────────────────────
  const handleSendPhoneOtp = () => {
    const nameErr = validateName(fullName);
    const digits = phone.replace(/\D/g, "");
    const phoneInvalid = !isValidIndianPhone(digits);

    if (nameErr || phoneInvalid) {
      setPhoneErrors({
        fullName: nameErr || undefined,
        phone: phoneInvalid ? "Please enter a valid 10-digit Indian mobile number." : undefined,
      });
      return;
    }

    setPhoneErrors({});
    setPhoneStep("otp");
  };

  const handlePhoneOtpSuccess = async (verifiedPhone: string) => {
    setPhoneCompleting(true);
    setPhoneErrors({});

    const res = await completePhoneSignup({
      phone: verifiedPhone,
      fullName: fullName.trim(),
    });

    setPhoneCompleting(false);

    if (res.error) {
      setPhoneErrors({ form: res.error });
      setPhoneStep("enter");
      return;
    }

    // Successfully registered and session created in Supabase
    navigate(targetPath === "/signup" ? "/" : targetPath, { replace: true });
  };

  // ── Email Signup Handlers ─────────────────────────────────────────────────
  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      fullName: validateName(fullName) || undefined,
      email: validateRequiredEmail(email) || undefined,
      password: validatePassword(password) || undefined,
      confirmPassword: validateConfirmPassword(password, confirmPassword) || undefined,
      emailMobile:
        emailMobile && !isValidIndianPhone(emailMobile.replace(/\D/g, ""))
          ? "Please enter a valid 10-digit Indian mobile number."
          : undefined,
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
      mobile: emailMobile.replace(/\D/g, "") || undefined,
      phoneVerified: emailMobileVerified,
    });

    setEmailLoading(false);

    if (result.error) {
      setEmailErrors({ form: result.error });
      return;
    }

    if (result.needsEmailVerification) {
      setEmailStep("otp");
      return;
    }

    // Direct login if confirmations disabled
    navigate(targetPath === "/signup" ? "/" : targetPath, { replace: true });
  };

  // ── Tab UI styling ─────────────────────────────────────────────────────────
  const tabBase =
    "flex-1 h-10 rounded-[10px] text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer";
  const tabActive = "bg-[#00A651] text-white shadow-sm";
  const tabInactive = "text-[#666666] hover:bg-gray-100";

  const getTitle = () => {
    if (mode === "phone" && phoneStep === "otp") return "Verify Mobile OTP";
    if (mode === "email" && emailStep === "otp") return "Verify Your Email";
    return "Create Account";
  };

  const getSubtitle = () => {
    if (mode === "phone" && phoneStep === "otp") {
      return `Enter the 6-digit code sent to +91 ${phone.slice(0, 2)}****${phone.slice(-4)}`;
    }
    if (mode === "phone") return "Quick signup with your mobile number via OTP";
    if (emailStep === "otp") return `Enter the code sent to ${email}`;
    return "Join Shree Hari Keerai for fresh, doorstep delivery.";
  };

  return (
    <AuthLayout title={getTitle()} subtitle={getSubtitle()}>
      <AnimatePresence mode="wait">
        {/* Email OTP verification step (Supabase email flow) */}
        {mode === "email" && emailStep === "otp" ? (
          <EmailOtpVerification
            key="signup-email-otp"
            email={email}
            onSuccess={() => navigate(targetPath === "/signup" ? "/" : targetPath, { replace: true })}
            onChangeEmail={() => {
              setEmailStep("form");
              setEmailErrors({});
            }}
            submitButtonText="Verify & Continue"
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
                <p className="text-sm font-bold text-[#111111]">Creating your account and signing in…</p>
              </div>
            ) : (
              <PhoneOtpVerification
                phone={phone.replace(/\D/g, "")}
                title="Create Account Verification"
                submitButtonText="Verify & Create Account"
                containerId="signup-mobile-recaptcha"
                onSuccess={handlePhoneOtpSuccess}
                onCancel={() => setPhoneStep("enter")}
              />
            )}
          </motion.div>
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
            {/* Mode tabs */}
            <div className="flex gap-1.5 bg-[#F5F5F5] p-1 rounded-[12px]">
              <button
                type="button"
                className={`${tabBase} ${mode === "phone" ? tabActive : tabInactive}`}
                onClick={() => {
                  setMode("phone");
                  setPhoneErrors({});
                  setPhoneStep("enter");
                }}
                id="tab-phone-signup"
              >
                <Phone size={14} />
                Mobile OTP
              </button>
              <button
                type="button"
                className={`${tabBase} ${mode === "email" ? tabActive : tabInactive}`}
                onClick={() => {
                  setMode("email");
                  setEmailErrors({});
                }}
                id="tab-email-signup"
              >
                <Mail size={14} />
                Email
              </button>
            </div>

            <AnimatePresence mode="wait">
              {/* ── Mode 1: Mobile OTP Signup Form ───────────────────────────── */}
              {mode === "phone" && (
                <motion.div
                  key="phone-signup-form"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3.5"
                >
                  <AuthField
                    id="signup-phone-name"
                    label="Full Name"
                    value={fullName}
                    onChange={(v) => {
                      setFullName(v);
                      setPhoneErrors((e) => ({ ...e, fullName: undefined, form: undefined }));
                    }}
                    error={phoneErrors.fullName}
                    placeholder="e.g. Raj Kumar"
                    autoComplete="name"
                  />

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="signup-mobile" className="text-xs font-bold text-[#555555]">
                      Mobile Number
                    </label>
                    <div className="flex items-center h-12 border-2 rounded-[12px] overflow-hidden transition-colors focus-within:border-[#00A651] border-[#EAEAEA] bg-white">
                      <span className="pl-4 pr-2 text-sm font-bold text-[#555555] border-r border-[#EAEAEA] h-full flex items-center">
                        +91
                      </span>
                      <input
                        id="signup-mobile"
                        type="tel"
                        inputMode="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value.replace(/\D/g, ""));
                          setPhoneErrors((prev) => ({ ...prev, phone: undefined, form: undefined }));
                        }}
                        placeholder="10-digit mobile number"
                        autoComplete="tel"
                        className="flex-1 h-full px-3 text-sm font-medium focus:outline-none bg-transparent"
                      />
                    </div>
                    {phoneErrors.phone && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2.5"
                      >
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{phoneErrors.phone}</span>
                      </motion.p>
                    )}
                  </div>

                  {phoneErrors.form && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2.5"
                    >
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{phoneErrors.form}</span>
                    </motion.p>
                  )}

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={!fullName.trim() || phone.replace(/\D/g, "").length < 10}
                    onClick={handleSendPhoneOtp}
                    id="signup-send-otp-btn"
                  >
                    Send OTP & Create Account
                  </Button>

                  <p className="text-[11px] text-[#888888] text-center">
                    A 6-digit verification code will be sent to your mobile via Firebase SMS.
                  </p>
                </motion.div>
              )}

              {/* ── Mode 2: Email & Password Signup Form ──────────────────────── */}
              {mode === "email" && (
                <motion.form
                  key="email-signup-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
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

                  {/* Mobile number with optional inline Firebase verification */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="signup-email-mobile" className="text-xs font-bold text-[#555555]">
                        Mobile Number
                      </label>
                      {emailMobileVerified ? (
                        <span className="text-[11px] font-bold text-[#00A651] flex items-center gap-1">
                          <CheckCircle2 size={13} /> Verified
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#888888]">Required for delivery</span>
                      )}
                    </div>
                    <div className="flex items-center h-12 border-2 rounded-[12px] overflow-hidden transition-colors focus-within:border-[#00A651] border-[#EAEAEA] bg-white">
                      <span className="pl-4 pr-2 text-sm font-bold text-[#555555] border-r border-[#EAEAEA] h-full flex items-center">
                        +91
                      </span>
                      <input
                        id="signup-email-mobile"
                        type="tel"
                        inputMode="tel"
                        maxLength={10}
                        disabled={emailMobileVerified}
                        value={emailMobile}
                        onChange={(e) => {
                          setEmailMobile(e.target.value.replace(/\D/g, ""));
                          setEmailErrors((prev) => ({ ...prev, emailMobile: undefined }));
                        }}
                        placeholder="10-digit mobile number"
                        autoComplete="tel"
                        className="flex-1 h-full px-3 text-sm font-medium focus:outline-none bg-transparent disabled:text-[#888888]"
                      />
                      {/* Verify button or green checkmark */}
                      {!emailMobileVerified && emailMobile.replace(/\D/g, "").length === 10 && !showEmailMobileOtp && (
                        <button
                          type="button"
                          onClick={() => setShowEmailMobileOtp(true)}
                          className="h-full px-3 text-xs font-bold text-[#00A651] hover:bg-[#EAF8F0] transition-colors border-l border-[#EAEAEA] cursor-pointer"
                        >
                          Verify with OTP
                        </button>
                      )}
                    </div>

                    {emailErrors.emailMobile && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[#EA4335] text-xs font-semibold px-1"
                      >
                        {emailErrors.emailMobile}
                      </motion.p>
                    )}

                    {/* Inline Phone OTP verification if triggered */}
                    <AnimatePresence>
                      {showEmailMobileOtp && !emailMobileVerified && (
                        <PhoneOtpVerification
                          key={emailMobile}
                          phone={emailMobile.replace(/\D/g, "")}
                          title="Verify Mobile Number"
                          submitButtonText="Verify Mobile"
                          containerId="signup-email-mobile-recaptcha"
                          onSuccess={(verifiedPhone) => {
                            verifiedMobileRef.current = verifiedPhone;
                            setEmailMobileVerified(true);
                            setShowEmailMobileOtp(false);
                          }}
                          onCancel={() => setShowEmailMobileOtp(false)}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  <AuthField
                    id="signup-email-address"
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

                  <Button type="submit" variant="primary" size="lg" fullWidth loading={emailLoading}>
                    Create Account
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Google OAuth — shown on both tabs */}
            <GoogleAuthButton
              targetPath={targetPath}
              onError={(err) => {
                setPhoneErrors({ form: err });
                setEmailErrors({ form: err });
              }}
            />

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
