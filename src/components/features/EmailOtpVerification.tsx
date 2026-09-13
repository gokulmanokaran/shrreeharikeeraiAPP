import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Button } from "../ui/Button";
import { verifyEmailOtp, resendEmailOtp } from "../../services/authService";

interface EmailOtpVerificationProps {
  email: string;
  onSuccess: () => void;
  onChangeEmail: () => void;
  submitButtonText?: string;
  initialWarning?: string;
}

export function EmailOtpVerification({
  email,
  onSuccess,
  onChangeEmail,
  submitButtonText = "Verify & Continue",
  initialWarning,
}: EmailOtpVerificationProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [warning, setWarning] = useState(initialWarning || "");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for OTP resend (60 seconds to respect Supabase rate limit)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (resendTimer > 0) {
      setCanResend(false);
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto focus first OTP input on mount
  useEffect(() => {
    const t = setTimeout(() => {
      otpInputsRef.current[0]?.focus();
    }, 250);
    return () => clearTimeout(t);
  }, []);

  const handleVerify = async (codeOverride?: string) => {
    const code = codeOverride || otp.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError("");
    setInfoMessage("");
    setWarning("");

    const res = await verifyEmailOtp(email, code);
    setLoading(false);

    if (!res.success) {
      setError(
        res.error ||
          "Incorrect or expired code. Please check your email and try again."
      );
      // Clear OTP boxes on error so user can re-enter
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 50);
      return;
    }

    onSuccess();
  };

  const handleResend = async () => {
    if (!canResend || resending) return;

    setResending(true);
    setError("");
    setInfoMessage("");
    setWarning("");

    const res = await resendEmailOtp(email);
    setResending(false);

    if (!res.success) {
      setError(res.error || "Could not resend code. Please try again.");
      return;
    }

    setInfoMessage("A new verification code has been sent. Please check your inbox and spam folder.");
    setResendTimer(60);
    setCanResend(false);
    setOtp(["", "", "", "", "", ""]);
    setTimeout(() => otpInputsRef.current[0]?.focus(), 50);
  };

  const handleOtpChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);
    setError("");

    if (char && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    if (char && index === 5) {
      const fullCode = newOtp.join("");
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pasted.length, 5);
    otpInputsRef.current[nextIndex]?.focus();

    if (pasted.length === 6) {
      handleVerify(pasted);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      <button
        type="button"
        onClick={onChangeEmail}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00A651] hover:underline cursor-pointer"
      >
        <ArrowLeft size={14} />
        Change email
      </button>

      {/* Sent-to banner */}
      <div className="bg-[#F5FCF8] border border-[#B9E8CE]/60 rounded-[12px] p-3 text-xs text-[#087A43]">
        <p className="font-semibold">
          Verification code sent to{" "}
          <span className="font-black text-[#111111]">{email}</span>
        </p>
        <p className="text-[11px] text-[#555555] mt-1 leading-relaxed">
          A 6-digit code was sent to your inbox. It can take{" "}
          <strong>1–3 minutes</strong> to arrive.{" "}
          <strong>Check your spam / junk folder</strong> if you don't see it.
        </p>
      </div>

      {/* Warning (e.g. rate-limit on resend during signup of existing unconfirmed user) */}
      <AnimatePresence>
        {warning && (
          <motion.div
            key="warning"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-[12px] p-2.5 flex items-start gap-2 text-xs text-amber-800"
          >
            <Info size={14} className="shrink-0 mt-0.5 text-amber-500" />
            <span className="font-medium">{warning}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success message after resend */}
      <AnimatePresence>
        {infoMessage && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-[#EAF8F0] border border-[#B9E8CE] rounded-[12px] p-2.5 flex items-center gap-2 text-xs font-semibold text-[#087A43]"
          >
            <CheckCircle2 size={15} className="shrink-0 text-[#00A651]" />
            <span>{infoMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6-Digit OTP Inputs */}
      <div className="flex justify-between gap-2 py-1">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              otpInputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value)}
            onKeyDown={(e) => handleOtpKeyDown(index, e)}
            onPaste={handleOtpPaste}
            aria-label={`Digit ${index + 1}`}
            className={`w-11 h-13 text-center text-lg font-black rounded-[12px] border-2 transition-all focus:outline-none ${
              digit
                ? "border-[#00A651] bg-[#EAF8F0]/30 text-[#00A651]"
                : error
                ? "border-[#EA4335] bg-red-50/30 text-[#111111]"
                : "border-[#EAEAEA] focus:border-[#00A651] text-[#111111]"
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
            className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2"
          >
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </motion.p>
        )}
      </AnimatePresence>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={loading}
        onClick={() => handleVerify()}
      >
        {submitButtonText}
      </Button>

      {/* Resend row */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-[#777777]">Didn't receive the code?</span>
        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-bold text-[#00A651] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
            {resending ? "Sending…" : "Resend Code"}
          </button>
        ) : (
          <span className="text-[#999999] font-medium">
            Resend in{" "}
            <span className="font-bold text-[#111111]">{resendTimer}s</span>
          </span>
        )}
      </div>

      {/* Spam folder tip */}
      <p className="text-[10px] text-[#AAAAAA] text-center leading-relaxed">
        Can't find the email? Check your <strong>spam</strong> or{" "}
        <strong>junk</strong> folder. The code expires in{" "}
        <strong>60 minutes</strong>.
      </p>
    </motion.div>
  );
}
