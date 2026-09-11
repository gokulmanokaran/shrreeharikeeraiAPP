import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Shield } from "lucide-react";
import { Button } from "../ui/Button";
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  clearRecaptchaVerifier,
  OTP_EXPIRY_SECONDS,
  OTP_RESEND_COOLDOWN,
  OTP_MAX_ATTEMPTS,
  type VerifyOtpResult,
} from "../../services/phoneOtpService";
import type { ConfirmationResult } from "firebase/auth";

interface PhoneOtpVerificationProps {
  phone: string; // 10-digit mobile number
  onSuccess: (verifiedPhone: string) => void;
  onCancel: () => void;
}

const RECAPTCHA_CONTAINER_ID = "shreehari-recaptcha-container";

export function PhoneOtpVerification({
  phone,
  onSuccess,
  onCancel,
}: PhoneOtpVerificationProps) {
  const [step, setStep] = useState<"sending" | "otp">("sending");
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // Timers
  const [resendTimer, setResendTimer] = useState(OTP_RESEND_COOLDOWN);
  const [expiryTimer, setExpiryTimer] = useState(OTP_EXPIRY_SECONDS);
  const [canResend, setCanResend] = useState(false);

  // Attempt tracking
  const [attemptsLeft, setAttemptsLeft] = useState(OTP_MAX_ATTEMPTS);
  const blockedRef = useRef(false);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const sentRef = useRef(false); // prevent double-fire in StrictMode

  // ── Send OTP on mount ────────────────────────────────────────────────────
  const doSendOtp = useCallback(async () => {
    const res = await sendPhoneOtp(phone, RECAPTCHA_CONTAINER_ID);
    if (res.error) {
      setError(res.error);
      setStep("otp"); // show panel anyway so user sees the error + cancel
      return;
    }
    setConfirmationResult(res.confirmationResult!);
    setStep("otp");
    setTimeout(() => otpInputsRef.current[0]?.focus(), 200);
  }, [phone]);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    doSendOtp();

    return () => {
      clearRecaptchaVerifier();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resend countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "otp") return;
    setCanResend(false);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, infoMessage]); // restart timer on each resend too

  // ── Expiry countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "otp") return;
    const interval = setInterval(() => {
      setExpiryTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!blockedRef.current) {
            setError("OTP has expired. Please click Resend to get a new code.");
            setOtp(["", "", "", "", "", ""]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, infoMessage]); // restart on resend

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerify = async (codeOverride?: string) => {
    if (blockedRef.current) return;
    const code = codeOverride || otp.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    if (!confirmationResult) {
      setError("OTP session lost. Please resend.");
      return;
    }
    if (expiryTimer <= 0) {
      setError("OTP has expired. Please click Resend.");
      return;
    }

    setVerifying(true);
    setError("");

    const res: VerifyOtpResult = await verifyPhoneOtp(confirmationResult, code);
    setVerifying(false);

    if (res.success) {
      onSuccess(phone);
      return;
    }

    const remaining = attemptsLeft - 1;
    setAttemptsLeft(remaining);

    if (remaining <= 0) {
      blockedRef.current = true;
      setError(
        "Too many incorrect attempts. Please resend a new OTP to try again."
      );
      setOtp(["", "", "", "", "", ""]);
      return;
    }

    setError(
      (res.error || "Incorrect OTP.") +
        ` (${remaining} attempt${remaining === 1 ? "" : "s"} left)`
    );
    setOtp(["", "", "", "", "", ""]);
    setTimeout(() => otpInputsRef.current[0]?.focus(), 50);
  };

  // ── Resend ────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!canResend || resending) return;

    setResending(true);
    setError("");
    setInfoMessage("");
    blockedRef.current = false;
    setAttemptsLeft(OTP_MAX_ATTEMPTS);

    // Reset timers first so the effects restart
    setResendTimer(OTP_RESEND_COOLDOWN);
    setExpiryTimer(OTP_EXPIRY_SECONDS);
    setCanResend(false);
    setOtp(["", "", "", "", "", ""]);

    const res = await sendPhoneOtp(phone, RECAPTCHA_CONTAINER_ID);
    setResending(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setConfirmationResult(res.confirmationResult!);
    setInfoMessage("A new OTP has been sent to your mobile.");
    setTimeout(() => otpInputsRef.current[0]?.focus(), 200);
  };

  // ── OTP input handlers ────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);
    setError("");
    if (char && index < 5) otpInputsRef.current[index + 1]?.focus();
    if (char && index === 5 && newOtp.join("").length === 6) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newOtp = Array.from({ length: 6 }, (_, i) => pasted[i] || "");
    setOtp(newOtp);
    const nextIdx = Math.min(pasted.length, 5);
    otpInputsRef.current[nextIdx]?.focus();
    if (pasted.length === 6) handleVerify(pasted);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const maskedPhone = `+91 ${phone.slice(0, 2)}****${phone.slice(-4)}`;
  const expiryMinutes = Math.floor(expiryTimer / 60);
  const expirySeconds = expiryTimer % 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="mt-3 rounded-[16px] border-2 border-[#00A651]/30 bg-[#F5FCF8] p-4 flex flex-col gap-3"
    >
      {/* Invisible reCAPTCHA anchor */}
      <div id={RECAPTCHA_CONTAINER_ID} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#00A651] flex items-center justify-center flex-shrink-0">
            <Shield size={14} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-[#111111]">Verify Mobile Number</p>
            <p className="text-[11px] text-[#087A43] font-semibold">{maskedPhone}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-[11px] font-bold text-[#999999] hover:text-[#555555] cursor-pointer"
          aria-label="Cancel OTP verification"
        >
          <ArrowLeft size={12} />
          Cancel
        </button>
      </div>

      {/* Sending state */}
      {step === "sending" && (
        <div className="flex items-center gap-2 text-xs text-[#087A43] font-semibold py-1">
          <span className="w-4 h-4 border-2 border-[#00A651] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          Sending OTP to {maskedPhone}…
        </div>
      )}

      {/* OTP entry */}
      {step === "otp" && (
        <>
          {/* Info message */}
          <AnimatePresence>
            {infoMessage && (
              <motion.div
                key="info"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-[#EAF8F0] border border-[#B9E8CE] rounded-[10px] p-2.5 flex items-center gap-2 text-xs font-semibold text-[#087A43]"
              >
                <CheckCircle2 size={14} className="shrink-0 text-[#00A651]" />
                <span>{infoMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sent-to banner */}
          {!error || infoMessage ? (
            <div className="text-[11px] text-[#555555]">
              OTP sent to <span className="font-bold text-[#111111]">{maskedPhone}</span>.
              {expiryTimer > 0 && (
                <span className={`ml-1.5 font-bold ${expiryTimer <= 30 ? "text-[#EA4335]" : "text-[#087A43]"}`}>
                  Expires in {expiryMinutes > 0 ? `${expiryMinutes}m ` : ""}
                  {String(expirySeconds).padStart(2, "0")}s
                </span>
              )}
            </div>
          ) : null}

          {/* 6-digit OTP boxes */}
          <div className="flex justify-between gap-2">
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
                disabled={blockedRef.current || expiryTimer <= 0}
                aria-label={`OTP digit ${index + 1}`}
                className={`w-11 h-12 text-center text-lg font-black rounded-[12px] border-2 transition-all focus:outline-none disabled:opacity-40 ${
                  digit
                    ? "border-[#00A651] bg-white text-[#00A651]"
                    : error
                    ? "border-[#EA4335] bg-red-50/40 text-[#111111]"
                    : "border-[#CCCCCC] bg-white focus:border-[#00A651] text-[#111111]"
                }`}
              />
            ))}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[#EA4335] text-xs font-semibold flex items-start gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2.5"
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.p>
            )}
          </AnimatePresence>

          {/* Verify button */}
          <Button
            variant="primary"
            size="md"
            fullWidth
            loading={verifying}
            disabled={
              blockedRef.current ||
              expiryTimer <= 0 ||
              otp.join("").length < 6
            }
            onClick={() => handleVerify()}
          >
            {verifying ? "Verifying…" : "Verify OTP"}
          </Button>

          {/* Resend row */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-[#777777]">Didn't receive OTP?</span>
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
                Resend in{" "}
                <span className="font-bold text-[#111111]">{resendTimer}s</span>
              </span>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
