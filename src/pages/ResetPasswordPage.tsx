import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { getSupabaseClient } from "../lib/supabase";
import { updateCustomerPassword } from "../services/authService";
import { validateConfirmPassword, validatePassword } from "../utils/validation";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check URL params / hash on mount for errors (e.g. expired link) or PKCE code
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hashStr = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    const hashParams = new URLSearchParams(hashStr);

    const errorDesc =
      searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error");

    if (errorDesc) {
      setLinkError(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
      window.history.replaceState({}, document.title, location.pathname);
      return;
    }

    const code = searchParams.get("code");
    if (code) {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.auth.getSession().then((sessionRes) => {
          if (!sessionRes.data?.session) {
            supabase.auth.exchangeCodeForSession(code).catch((err: unknown) => {
              console.warn("[ResetPassword] exchangeCode error:", err);
            });
          }
        });
      }
    }
  }, [location.search, location.hash, location.pathname]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const passErr = validatePassword(password);
    const confirmErr = validateConfirmPassword(password, confirmPassword);
    if (passErr || confirmErr) {
      setError(passErr || confirmErr || "");
      return;
    }

    setLoading(true);
    setError("");

    const result = await updateCustomerPassword(password, confirmPassword);
    setLoading(false);

    if (result.error) {
      if (/expired|invalid|token/i.test(result.error)) {
        setLinkError("Your password reset link has expired or is invalid. Please request a new one.");
      } else if (/session missing|not authenticated|no session/i.test(result.error)) {
        setLinkError("No active password reset session found. Please request a new reset link.");
      } else {
        setError(result.error);
      }
      return;
    }

    // Sign out from recovery session so user can log in cleanly with their new password
    try {
      const supabase = getSupabaseClient();
      if (supabase) await supabase.auth.signOut();
    } catch {}

    setSuccess(true);
  };

  return (
    <AuthLayout title={success ? "Password Updated" : "Set New Password"}>
      <AnimatePresence mode="wait">
        {/* Link Error / Expired Banner */}
        {linkError ? (
          <motion.div
            key="link-error"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 border border-amber-300 rounded-[14px] p-4 text-center space-y-3"
          >
            <div className="flex items-center justify-center gap-2 text-amber-900 font-bold text-sm">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <span>Password Reset Link Expired</span>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              {linkError}
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center w-full h-11 bg-[#00A651] hover:bg-[#008f45] text-white font-bold text-sm rounded-[12px] shadow-sm transition-all"
            >
              Request New Reset Link
            </Link>
          </motion.div>
        ) : success ? (
          /* Success Screen */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#EAF8F0] border border-[#B9E8CE] rounded-[14px] p-5 text-center space-y-3"
          >
            <div className="flex items-center justify-center gap-2 text-[#087A43] font-bold text-sm">
              <CheckCircle2 size={20} className="text-[#00A651] shrink-0" />
              <span>Password Updated Successfully!</span>
            </div>
            <p className="text-xs text-[#087A43] leading-relaxed">
              Your password has been changed. You can now log in to your account with your new password.
            </p>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate("/login", { replace: true })}
            >
              Go to Login
            </Button>
          </motion.div>
        ) : (
          /* Password Form */
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-3.5"
            noValidate
          >
            <AuthField
              id="reset-password"
              label="New Password"
              type="password"
              value={password}
              onChange={(v) => {
                setPassword(v);
                setError("");
              }}
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
            />
            <AuthField
              id="reset-confirm"
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v);
                setError("");
              }}
              error={error}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />

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

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Update Password
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      {!success && !linkError && (
        <div className="pt-2 text-center">
          <p className="text-sm text-[#666666]">
            Remember your password?{" "}
            <Link to="/login" className="font-bold text-[#00A651] hover:underline">
              Back to Login
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
