import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Button } from "../components/ui/Button";
import { AuthField } from "../components/layout/AuthLayout";
import { updateCustomerPassword } from "../services/authService";
import { useAuth } from "../store/AuthContext";

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const result = await updateCustomerPassword(password, confirmPassword);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setSuccess("Password updated successfully.");
  };

  return (
    <>
      <Header onSearchOpen={() => navigate("/search")} />
      <main className="pb-24 max-w-lg mx-auto px-4 pt-5">
        <h1 className="text-xl font-black text-[#111111] mb-1">Account Settings</h1>
        <p className="text-sm text-[#666666] mb-5">Change your password or sign out of this device.</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm p-4 sm:p-5 flex flex-col gap-3.5 mb-4" noValidate>
          <h2 className="text-sm font-bold text-[#111111]">Change Password</h2>
          <AuthField
            id="settings-password"
            label="New Password"
            type="password"
            value={password}
            onChange={(v) => { setPassword(v); setError(""); }}
            placeholder="Minimum 6 characters"
            autoComplete="new-password"
          />
          <AuthField
            id="settings-confirm"
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(v) => { setConfirmPassword(v); setError(""); }}
            error={error}
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />
          {success && (
            <p className="text-[#087A43] text-xs font-semibold bg-[#EAF8F0] border border-[#B9E8CE] rounded-[12px] px-3 py-2">
              {success}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            Update Password
          </Button>
        </form>

        <Button
          variant="danger"
          size="lg"
          fullWidth
          onClick={async () => {
            await logout();
            navigate("/", { replace: true });
          }}
        >
          Logout
        </Button>

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </>
  );
}
