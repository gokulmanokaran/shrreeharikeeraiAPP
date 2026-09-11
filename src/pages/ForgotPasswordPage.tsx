import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { requestPasswordReset } from "../services/authService";
import { validateRequiredEmail } from "../utils/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const emailErr = validateRequiredEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    setLoading(true);
    setError("");
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter the email on your account and we'll send a reset link."
    >
      {sent ? (
        <div className="bg-[#EAF8F0] border border-[#B9E8CE] rounded-[14px] p-4 text-sm text-[#087A43] font-medium">
          If an account exists for this email, a password reset link has been sent. Please check your inbox.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
          <AuthField
            id="forgot-email"
            label="Email"
            type="email"
            value={email}
            onChange={(v) => { setEmail(v); setError(""); }}
            error={error}
            placeholder="your@email.com"
            autoComplete="email"
          />
          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            Send Reset Link
          </Button>
        </form>
      )}
      <p className="text-sm text-[#666666] text-center mt-5">
        <Link to="/login" className="font-bold text-[#00A651] hover:underline">
          Back to Login
        </Link>
      </p>
    </AuthLayout>
  );
}
