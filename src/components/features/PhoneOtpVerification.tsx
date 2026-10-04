/**
 * PhoneOtpVerification
 * ─────────────────────
 * Invisible reCAPTCHA attached directly to the "Send OTP" button.
 * Users never see a captcha puzzle — reCAPTCHA runs silently in background.
 *
 * Dev / localhost  → appVerificationDisabledForTesting = true (set in firebase.ts)
 *                    → zero reCAPTCHA, OTP goes out immediately
 * Production       → invisible reCAPTCHA, silent, no user interaction
 */

import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { Button } from "../ui/Button";
import { AuthField } from "../layout/AuthLayout";
import { getFirebaseAuth } from "../../lib/firebase";
import { syncFirebasePhoneUser } from "../../services/phoneAuthService";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function validatePhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "Mobile number is required.";
  if (digits.length < 10) return "Enter a valid 10-digit mobile number.";
  if (digits.length === 10 && !/^[6-9]/.test(digits))
    return "Enter a valid Indian mobile number (starts with 6–9).";
  return undefined;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PhoneOtpVerificationProps {
  onSuccess: () => void;
  onBack: () => void;
}

const IS_DEV =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

type PhoneStep = "enter_phone" | "enter_otp";

export function PhoneOtpVerification({ onSuccess, onBack }: PhoneOtpVerificationProps) {
  // Stable unique IDs for the button (required by RecaptchaVerifier)
  const sendBtnId   = useId().replace(/:/g, ""); // e.g. "r0" — no colons allowed in DOM id
  const resendBtnId = useId().replace(/:/g, "");

  const [step, setStep] = useState<PhoneStep>("enter_phone");

  const [phone,      setPhone]      = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [sending,    setSending]    = useState(false);

  const [otp,       setOtp]       = useState(["", "", "", "", "", ""]);
  const [otpError,  setOtpError]  = useState("");
  const [verifying, setVerifying] = useState(false);
  const [infoMsg,   setInfoMsg]   = useState("");

  const [resendTimer, setResendTimer] = useState(60);
  const [canResend,   setCanResend]   = useState(false);
  const [resending,   setResending]   = useState(false);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef     = useRef<RecaptchaVerifier | null>(null);
  const otpInputsRef    = useRef<(HTMLInputElement | null)[]>([]);

  // ── Build ApplicationVerifier ────────────────────────────────────────────
  //
  // localhost (IS_DEV):
  //   appVerificationDisabledForTesting = true → Firebase ignores the token.
  //   We return a dummy verifier that instantly resolves — zero reCAPTCHA.
  //
  // production:
  //   Real invisible RecaptchaVerifier — silent, no puzzle for users.
  //
  const buildVerifier = useCallback((buttonId: string) => {
    // Clean up any existing verifier first
    try { verifierRef.current?.clear(); } catch { /* ignore */ }
    verifierRef.current = null;

    if (IS_DEV) {
      // Dummy ApplicationVerifier — Firebase accepts this when testing is disabled
      return {
        type: "recaptcha" as const,
        verify: () => Promise.resolve("dev-test-token"),
      };
    }

    // Production: attach invisible reCAPTCHA to the button element
    const auth = getFirebaseAuth();
    const el   = document.getElementById(buttonId);
    if (!el) return null;

    const v = new RecaptchaVerifier(auth, el, {
      size: "invisible",
      callback: () => { /* reCAPTCHA solved silently */ },
      "expired-callback": () => {
        try { v.clear(); } catch { /* ignore */ }
        verifierRef.current = null;
      },
    });

    verifierRef.current = v;
    return v;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { verifierRef.current?.clear(); } catch { /* ignore */ }
      verifierRef.current = null;
    };
  }, []);

  // ── Resend countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "enter_otp") return;
    if (resendTimer <= 0) { setCanResend(true); return; }
    setCanResend(false);
    const id = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { setCanResend(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendTimer, step]);

  // Auto-focus first OTP box
  useEffect(() => {
    if (step === "enter_otp")
      setTimeout(() => otpInputsRef.current[0]?.focus(), 250);
  }, [step]);

  // ── Error code → human message ────────────────────────────────────────────
  function firebaseErrMsg(err: any): string {
    const code: string = err?.code || "";
    if (code === "auth/billing-not-enabled")
      return "Firebase billing not enabled. Upgrade your Firebase project to Blaze plan (free tier) to send SMS OTPs.";
    if (code === "auth/operation-not-allowed")
      return "Phone sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method → Phone.";
    if (code === "auth/invalid-phone-number")
      return "Invalid phone number. Enter a valid 10-digit Indian mobile number.";
    if (code === "auth/too-many-requests") {
      if (IS_DEV)
        return "Rate limited on this real number. For local testing, use a TEST number from Firebase Console → Authentication → Phone → Test numbers. Example: +91 9999999999 / OTP: 123456";
      return "Too many OTP requests. Please wait a few minutes and try again.";
    }
    if (code === "auth/captcha-check-failed" || code === "auth/invalid-app-credential")
      return "reCAPTCHA check failed. Please refresh the page and try again.";
    if (code === "auth/quota-exceeded")
      return "Daily SMS quota exceeded. Please try again tomorrow or switch to email login.";
    if (code === "auth/invalid-verification-code")
      return "Incorrect OTP. Please check the SMS and try again.";
    if (code === "auth/code-expired")
      return "OTP has expired. Please request a new one.";
    return `Error: ${code || err?.message || "Unknown error. Please try again."}`;
  }

  // ── Step 1: Send OTP — bound to Send OTP button ───────────────────────────
  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const err = validatePhone(phone);
    if (err) { setPhoneError(err); return; }

    setSending(true);
    setPhoneError(undefined);

    try {
      const phoneE164 = toE164(phone);
      const auth      = getFirebaseAuth();

      // Build invisible verifier attached to the "Send OTP" button
      const verifier  = buildVerifier(`send-otp-btn-${sendBtnId}`);
      if (!verifier) throw new Error("Could not initialize reCAPTCHA. Please refresh and try again.");

      // signInWithPhoneNumber triggers invisible reCAPTCHA automatically
      const result = await signInWithPhoneNumber(auth, phoneE164, verifier);
      confirmationRef.current = result;
      setStep("enter_otp");
      setResendTimer(60);
      setCanResend(false);
    } catch (err: any) {
      console.error("[PhoneOTP] send error:", err?.code, err?.message);
      // Clear verifier so fresh one is built on next attempt
      try { verifierRef.current?.clear(); } catch { /* ignore */ }
      verifierRef.current = null;
      setPhoneError(firebaseErrMsg(err));
    } finally {
      setSending(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerify = async (codeOverride?: string) => {
    const code = codeOverride ?? otp.join("");
    if (code.length !== 6) { setOtpError("Please enter the complete 6-digit OTP."); return; }
    if (!confirmationRef.current) { setOtpError("Session expired. Please go back and re-send the OTP."); return; }

    setVerifying(true);
    setOtpError("");

    try {
      const credential   = await confirmationRef.current.confirm(code);
      const firebaseUser = credential.user;

      const syncResult = await syncFirebasePhoneUser({
        firebaseUid:  firebaseUser.uid,
        phoneNumber:  firebaseUser.phoneNumber ?? toE164(phone),
      });

      if (syncResult.error) {
        setOtpError(syncResult.error);
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpInputsRef.current[0]?.focus(), 50);
        return;
      }

      onSuccess();
    } catch (err: any) {
      console.error("[PhoneOTP] verify error:", err?.code, err?.message);
      setOtpError(firebaseErrMsg(err));
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 50);
    } finally {
      setVerifying(false);
    }
  };

  // ── Resend OTP — new verifier attached to Resend button ───────────────────
  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setOtpError("");
    setInfoMsg("");

    try {
      const phoneE164 = toE164(phone);
      const auth      = getFirebaseAuth();
      const verifier  = buildVerifier(`resend-otp-btn-${resendBtnId}`);
      if (!verifier) throw new Error("Could not initialize reCAPTCHA.");

      const result = await signInWithPhoneNumber(auth, phoneE164, verifier);
      confirmationRef.current = result;
      setInfoMsg("A new OTP has been sent to your mobile number.");
      setResendTimer(60);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 50);
    } catch (err: any) {
      console.error("[PhoneOTP] resend error:", err?.code, err?.message);
      try { verifierRef.current?.clear(); } catch { /* ignore */ }
      verifierRef.current = null;
      setOtpError(firebaseErrMsg(err));
    } finally {
      setResending(false);
    }
  };

  // ── OTP input handlers ────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = char;
    setOtp(next);
    setOtpError("");
    if (char && index < 5) otpInputsRef.current[index + 1]?.focus();
    if (char && index === 5 && next.join("").length === 6) handleVerify(next.join(""));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0)
      otpInputsRef.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
    setOtp(next);
    otpInputsRef.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) handleVerify(pasted);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      {/* Back */}
      <button
        type="button"
        onClick={step === "enter_otp" ? () => setStep("enter_phone") : onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00A651] hover:underline cursor-pointer"
      >
        <ArrowLeft size={14} />
        {step === "enter_otp" ? "Change number" : "Back to login"}
      </button>

      <AnimatePresence mode="wait">

        {/* ── Step 1: Enter phone number ──────────────────────────────────── */}
        {step === "enter_phone" && (
          <motion.form
            key="phone-step"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
            onSubmit={handleSendOtp}
            className="space-y-4"
            noValidate
          >
            {/* Info banner */}
            <div className="flex items-center gap-2 bg-[#F5FCF8] border border-[#B9E8CE]/60 rounded-[12px] p-3">
              <Smartphone size={16} className="text-[#00A651] shrink-0" />
              <p className="text-xs text-[#087A43] font-medium leading-snug">
                Enter your mobile number. OTP will be sent via SMS — no captcha required.
              </p>
            </div>

            <AuthField
              id="phone-number-input"
              label="Mobile Number"
              type="tel"
              value={phone}
              onChange={(v) => { setPhone(v); setPhoneError(undefined); }}
              error={phoneError}
              placeholder="9876543210"
              autoComplete="tel"
              inputMode="numeric"
              maxLength={13}
              helperText="+91 added automatically for Indian numbers"
            />

            {/*
              RecaptchaVerifier is attached to THIS button element by id.
              size="invisible" → reCAPTCHA runs silently on click, no puzzle shown.
              The button id must exist in the DOM before RecaptchaVerifier.render() is called.
            */}
            <button
              id={`send-otp-btn-${sendBtnId}`}
              type="submit"
              disabled={sending}
              className={`w-full h-12 rounded-[14px] text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                sending
                  ? "bg-[#00A651]/70 cursor-not-allowed text-white"
                  : "bg-[#00A651] hover:bg-[#009444] active:scale-[0.98] text-white shadow-sm"
              }`}
            >
              {sending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Sending OTP…
                </>
              ) : (
                "Send OTP"
              )}
            </button>
          </motion.form>
        )}

        {/* ── Step 2: Enter 6-digit OTP ───────────────────────────────────── */}
        {step === "enter_otp" && (
          <motion.div
            key="otp-step"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Sent-to banner */}
            <div className="bg-[#F5FCF8] border border-[#B9E8CE]/60 rounded-[12px] p-3 text-xs text-[#087A43]">
              <p className="font-semibold">
                OTP sent to{" "}
                <span className="font-black text-[#111111]">
                  +91 {phone.replace(/\D/g, "").slice(-10)}
                </span>
              </p>
              <p className="text-[11px] text-[#555555] mt-1 leading-relaxed">
                Enter the 6-digit code from the SMS. May take{" "}
                <strong>up to 30 seconds</strong>.
              </p>
            </div>

            {/* Resend success */}
            <AnimatePresence>
              {infoMsg && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-[#EAF8F0] border border-[#B9E8CE] rounded-[12px] p-2.5 flex items-center gap-2 text-xs font-semibold text-[#087A43]"
                >
                  <CheckCircle2 size={15} className="shrink-0 text-[#00A651]" />
                  <span>{infoMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 6-digit OTP input boxes */}
            <div className="flex justify-between gap-2 py-1">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputsRef.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={handleOtpPaste}
                  aria-label={`OTP digit ${index + 1}`}
                  className={`w-11 h-13 text-center text-lg font-black rounded-[12px] border-2 transition-all focus:outline-none ${
                    digit
                      ? "border-[#00A651] bg-[#EAF8F0]/30 text-[#00A651]"
                      : otpError
                      ? "border-[#EA4335] bg-red-50/30 text-[#111111]"
                      : "border-[#EAEAEA] focus:border-[#00A651] text-[#111111]"
                  }`}
                />
              ))}
            </div>

            {/* Error */}
            <AnimatePresence>
              {otpError && (
                <motion.p
                  key="otp-err"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{otpError}</span>
                </motion.p>
              )}
            </AnimatePresence>

            {/* Verify button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={verifying}
              onClick={() => handleVerify()}
            >
              Verify & Sign In
            </Button>

            {/* Resend row — verifier attached to Resend button */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[#777777]">Didn't receive the OTP?</span>
              {canResend ? (
                <button
                  id={`resend-otp-btn-${resendBtnId}`}
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
                  Resend in{" "}
                  <span className="font-bold text-[#111111]">{resendTimer}s</span>
                </span>
              )}
            </div>

            <p className="text-[10px] text-[#AAAAAA] text-center leading-relaxed">
              OTP expires in <strong>10 minutes</strong>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
