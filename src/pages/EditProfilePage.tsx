import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Button } from "../components/ui/Button";
import { AuthField } from "../components/layout/AuthLayout";
import { useAuth } from "../store/AuthContext";
import { useDelivery } from "../store/DeliveryContext";
import { MapLocationPicker } from "../components/features/MapLocationPicker";
import { updateCustomerProfile } from "../services/authService";

/**
 * Returns true when the authenticated user logged in via Firebase Phone Auth.
 * Phone-login users have a synthetic Supabase email ending in @shreehari-phone.internal
 * and/or auth_provider = "firebase_phone" in their user_metadata.
 */
function detectPhoneLogin(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): boolean {
  if (!user) return false;
  if (user.user_metadata?.auth_provider === "firebase_phone") return true;
  if (user.email?.endsWith("@shreehari-phone.internal")) return true;
  return false;
}

export default function EditProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const { savedLocation, saveLocation } = useDelivery();
  const navigate = useNavigate();

  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Determine login method — drives which field is locked
  const isPhoneLogin = detectPhoneLogin(user);

  // The identity fields that are locked (pre-populated from auth, never editable by user)
  const lockedMobile = profile?.mobile || String(user?.user_metadata?.mobile || "");
  const lockedEmail = profile?.email || user?.email || "";

  const [fullName, setFullName] = useState(() => profile?.fullName || String(user?.user_metadata?.full_name || ""));

  // email: for email-login → read-only (pre-filled); for phone-login → editable contact field
  const [email, setEmail] = useState(() =>
    isPhoneLogin
      ? (profile?.email && !profile.email.endsWith("@shreehari-phone.internal") ? profile.email : "")
      : (profile?.email || user?.email || "")
  );

  // mobile: for phone-login → read-only (pre-filled); for email-login → editable contact field
  const [mobile, setMobile] = useState(() =>
    isPhoneLogin
      ? lockedMobile
      : (profile?.mobile || String(user?.user_metadata?.mobile || ""))
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile || user) {
      setFullName((prev) => prev || profile?.fullName || String(user?.user_metadata?.full_name || ""));
      // Only auto-fill editable fields for the relevant login method
      if (!isPhoneLogin) {
        setEmail((prev) => prev || profile?.email || user?.email || "");
        setMobile((prev) => prev || profile?.mobile || String(user?.user_metadata?.mobile || ""));
      }
    }
  }, [profile, user, isPhoneLogin]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    let result;
    if (isPhoneLogin) {
      // Phone login: mobile is the locked login identity, email is the editable contact field
      result = await updateCustomerProfile({
        fullName,
        email: email.trim(),
        mobile: lockedMobile, // always send the locked login mobile — never changes
        isPhoneLogin: true,
      });
    } else {
      // Email login: email is the locked login identity, mobile is the editable contact field
      result = await updateCustomerProfile({
        fullName,
        email: lockedEmail, // always use the auth email — never changes
        mobile,
      });
    }

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await refreshProfile();
    setSuccess("Your profile has been updated.");
    setTimeout(() => navigate("/profile"), 700);
  };

  return (
    <>
      {showLocationPicker && (
        <MapLocationPicker
          initialLat={savedLocation?.lat}
          initialLng={savedLocation?.lng}
          onConfirm={async (result) => {
            await saveLocation(result);
            setShowLocationPicker(false);
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
      <Header onSearchOpen={() => navigate("/search")} />
      <main className="pb-24 max-w-lg mx-auto px-4 pt-5">
        <h1 className="text-xl font-black text-[#111111] mb-1">Edit Profile</h1>
        <p className="text-sm text-[#666666] mb-5">Update your name and contact details.</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm p-4 sm:p-5 flex flex-col gap-3.5" noValidate>
          <AuthField
            id="edit-name"
            label="Full Name"
            value={fullName}
            onChange={(v) => { setFullName(v); setError(""); }}
            placeholder="Your full name"
            autoComplete="name"
          />

          {/* Email field — locked (Read Only) for email-login users, editable for phone-login users */}
          <AuthField
            id="edit-email"
            label="Email Address"
            type="email"
            value={isPhoneLogin ? email : lockedEmail}
            onChange={isPhoneLogin ? (v) => { setEmail(v); setError(""); } : () => {}}
            placeholder="your@email.com"
            autoComplete="email"
            disabled={!isPhoneLogin}
            helperText={
              !isPhoneLogin
                ? "Email address cannot be changed — it is your login identity."
                : email === ""
                ? "Optionally add a contact email address."
                : undefined
            }
          />

          {/* Mobile field — locked (Read Only) for phone-login users, editable for email-login users */}
          <AuthField
            id="edit-mobile"
            label="Mobile Number"
            type="tel"
            inputMode="tel"
            maxLength={10}
            value={isPhoneLogin ? lockedMobile : mobile}
            onChange={isPhoneLogin ? () => {} : (v) => { setMobile(v.replace(/\D/g, "")); setError(""); }}
            placeholder="10-digit mobile number"
            autoComplete="tel"
            disabled={isPhoneLogin}
            helperText={
              isPhoneLogin
                ? "Mobile number cannot be changed — it is your login identity."
                : undefined
            }
          />

          {/* Location field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#555555] flex items-center justify-between">
              <span>Delivery Location</span>
              {savedLocation && (
                <span className="text-[10px] font-bold text-[#087A43] bg-[#EAF8F0] px-2 py-0.5 rounded-full">
                  Serviceable
                </span>
              )}
            </label>
            <div className="flex items-center justify-between p-3.5 border-2 border-[#EAEAEA] rounded-[12px] bg-white gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111111] truncate">
                  {savedLocation ? (
                    savedLocation.formattedAddress ||
                    `${savedLocation.area || savedLocation.city || "Coimbatore"} - ${savedLocation.pincode}`
                  ) : (
                    "Not added"
                  )}
                </p>
                {savedLocation?.pincode && (
                  <p className="text-xs text-[#666666] mt-0.5">
                    Coimbatore - {savedLocation.pincode}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowLocationPicker(true)}
                className="px-3 py-1.5 rounded-full bg-[#F5FCF8] border border-[#B9E8CE] text-[#00A651] text-xs font-bold hover:bg-[#EAF8F0] transition-colors shrink-0 cursor-pointer"
              >
                {savedLocation ? "Change" : "Add Location"}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[#EA4335] text-xs font-semibold bg-red-50 border border-red-100 rounded-[12px] px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-[#087A43] text-xs font-semibold bg-[#EAF8F0] border border-[#B9E8CE] rounded-[12px] px-3 py-2">
              {success}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            Save Changes
          </Button>
          <Button type="button" variant="ghost" size="md" fullWidth onClick={() => navigate("/profile")}>
            Cancel
          </Button>
        </form>

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </>
  );
}
