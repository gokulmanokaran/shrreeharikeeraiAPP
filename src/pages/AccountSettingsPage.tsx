import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Button } from "../components/ui/Button";
import { AuthField } from "../components/layout/AuthLayout";
import { updateCustomerPassword } from "../services/authService";
import { useAuth } from "../store/AuthContext";
import { LogOut } from "lucide-react";

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <>
      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="bg-white rounded-[22px] shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-1">
                <LogOut size={22} className="text-[#EA4335]" />
              </div>
              <h2 className="text-base font-black text-[#111111]">Logout Confirmation</h2>
              <p className="text-sm text-[#555555] leading-relaxed">
                Are you sure you want to logout?
              </p>
            </div>
            <div className="flex flex-col gap-2.5 mt-1">
              <button
                id="settings-confirm-logout-btn"
                type="button"
                disabled={isLoggingOut}
                onClick={handleConfirmLogout}
                className="w-full py-3 rounded-[14px] bg-[#EA4335] text-white text-sm font-bold hover:bg-[#d33426] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
              >
                {isLoggingOut ? "Logging out…" : "Confirm Logout"}
              </button>
              <button
                id="settings-cancel-logout-btn"
                type="button"
                disabled={isLoggingOut}
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full py-3 rounded-[14px] bg-[#F5F5F5] text-[#333333] text-sm font-bold hover:bg-[#EAEAEA] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
          onClick={() => setShowLogoutConfirm(true)}
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
