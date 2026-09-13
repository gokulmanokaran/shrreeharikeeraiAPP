import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { requestPasswordReset } from "../services/authService";
import { validateRequiredEmail } from "../utils/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const emailErr = validateRequiredEmail(email);
    if (emailErr) {
      setError(emailErr);
      setNotFound(false);
      return;
    }
    setLoading(true);
    setError("");
    setNotFound(false);

    const result = await requestPasswordReset(email);
    setLoading(false);

    if (result.notFound) {
      setNotFound(true);
      return;
    }

    if (result.error) {
      setError(result.error);
      return;
    }

    setSent(true);
  };

  return (
    <AuthLayout title="Forgot Password">
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#EAF8F0] border border-[#B9E8CE] rounded-[14px] p-4 text-center space-y-2.5"
          >
            <div className="flex items-center justify-center gap-2 text-[#087A43] font-bold text-sm">
              <CheckCircle2 size={18} className="text-[#00A651] shrink-0" />
              <span>Password reset link sent!</span>
            </div>
            <p className="text-xs text-[#087A43] leading-relaxed">
              We've sent a password reset link to{" "}
              <strong className="text-[#111111]">{email}</strong>. Please check your inbox and click the link to set a new password.
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-3.5"
            noValidate
          >
            <AuthField
              id="forgot-email"
              label="Email Address"
              type="email"
              value={email}
              onChange={(v) => {
                setEmail(v);
                setError("");
                setNotFound(false);
              }}
              error={error && !notFound ? error : undefined}
              placeholder="your@email.com"
              autoComplete="email"
            />

            {/* Account Not Found Banner with Create Account button */}
            {notFound && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 border border-amber-300 rounded-[14px] p-4 text-center space-y-2.5"
              >
                <div className="flex items-center justify-center gap-2 text-amber-900 font-bold text-sm">
                  <AlertCircle size={18} className="text-amber-600 shrink-0" />
                  <span>No account found with this email address.</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Please create an account first to start ordering.
                </p>
                <Link
                  to="/signup"
                  state={{ email }}
                  className="inline-flex items-center justify-center w-full h-11 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-sm rounded-[12px] shadow-sm transition-all"
                >
                  Create Account
                </Link>
              </motion.div>
            )}

            {/* General form error */}
            {error && !notFound && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[#EA4335] text-xs font-semibold flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-[10px] p-2.5"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </motion.p>
            )}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Send Reset Link
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="pt-2 text-center">
        <p className="text-sm text-[#666666]">
          Remember your password?{" "}
          <Link to="/login" className="font-bold text-[#00A651] hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
