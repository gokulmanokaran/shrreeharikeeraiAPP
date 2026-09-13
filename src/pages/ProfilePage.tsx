import { useNavigate } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Button } from "../components/ui/Button";
import { useAuth } from "../store/AuthContext";
import { Mail, Phone, UserRound, LogOut, Pencil } from "lucide-react";

export default function ProfilePage() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();

  const fullName = profile?.fullName || String(user?.user_metadata?.full_name || "");
  const email = profile?.email || user?.email || "";
  const mobile = profile?.mobile || String(user?.user_metadata?.mobile || "");

  const userInitial = (
    fullName.trim()?.[0] ||
    user?.email?.trim()?.[0] ||
    "U"
  ).toUpperCase();

  return (
    <>
      <Header onSearchOpen={() => navigate("/search")} />
      <main className="pb-24 max-w-lg mx-auto px-4 pt-5">
        <h1 className="text-xl font-black text-[#111111] mb-1">My Profile</h1>
        <p className="text-sm text-[#666666] mb-5">Your account details for orders and delivery.</p>

        <div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden mb-5">
          <div className="bg-[#F5FCF8] px-5 py-4 flex items-center justify-between border-b border-[#EAEAEA]">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00A651] to-[#008743] text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-[#111111] truncate">{fullName || "Customer"}</p>
                <p className="text-xs text-[#087A43] font-semibold">Shree Hari Keerai Member</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/profile/edit")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#B9E8CE] hover:border-[#00A651] text-[#00A651] text-xs font-bold shadow-2xs hover:bg-[#EAF8F0] transition-all cursor-pointer shrink-0"
              aria-label="Edit Profile"
            >
              <Pencil size={13} />
              <span>Edit</span>
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3.5">
              <UserRound size={18} className="text-[#00A651] mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-[#888888] uppercase tracking-wide">Full Name</p>
                <p className="text-sm font-semibold text-[#111111]">{fullName || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <Mail size={18} className="text-[#00A651] mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-[#888888] uppercase tracking-wide">Email</p>
                <p className="text-sm font-semibold text-[#111111] break-all">{email || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <Phone size={18} className="text-[#00A651] mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-[#888888] uppercase tracking-wide">Mobile Number</p>
                <p className="text-sm font-semibold text-[#111111]">{mobile ? `+91 ${mobile}` : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<Pencil size={17} />}
            onClick={() => navigate("/profile/edit")}
          >
            Edit Profile
          </Button>
          <Button
            variant="ghost"
            size="md"
            fullWidth
            className="text-[#EA4335] hover:bg-red-50 font-bold border border-red-100"
            icon={<LogOut size={16} />}
            onClick={async () => {
              await logout();
              navigate("/", { replace: true });
            }}
          >
            Sign Out
          </Button>
        </div>

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </>
  );
}
