import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { AuthField, AuthLayout } from "../components/layout/AuthLayout";
import { updateCustomerPassword } from "../services/authService";
import { validateConfirmPassword, validatePassword } from "../utils/validation";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError(result.error);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <AuthLayout title="Set New Password" subtitle="Choose a new password for your account.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        <AuthField
          id="reset-password"
          label="New Password"
          type="password"
          value={password}
          onChange={(v) => { setPassword(v); setError(""); }}
          placeholder="Minimum 6 characters"
          autoComplete="new-password"
        />
        <AuthField
          id="reset-confirm"
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(v) => { setConfirmPassword(v); setError(""); }}
          error={error}
          placeholder="Re-enter your password"
          autoComplete="new-password"
        />
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          Update Password
        </Button>
      </form>
      <p className="text-sm text-[#666666] text-center mt-5">
        <Link to="/login" className="font-bold text-[#00A651] hover:underline">
          Back to Login
        </Link>
      </p>
    </AuthLayout>
  );
}
