import { useNavigate } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Button } from "../components/ui/Button";
import { useAuth } from "../store/AuthContext";
import { Mail, Phone, User, Pencil } from "lucide-react";

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const fullName = profile?.fullName || String(user?.user_metadata?.full_name || "");
  const email = profile?.email || user?.email || "";
  const mobile = profile?.mobile || String(user?.user_metadata?.mobile || "");

  return (
    <>
      <Header onSearchOpen={() => navigate("/search")} />
      <main className="pb-24 max-w-lg mx-auto px-4 pt-5">
        <h1 className="text-xl font-black text-[#111111] mb-1">My Profile</h1>
        <p className="text-sm text-[#666666] mb-5">Your account details for orders and delivery.</p>

        <div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden">
          <div className="bg-[#F5FCF8] px-4 py-5 flex items-center gap-3 border-b border-[#EAEAEA]">
            <div className="w-12 h-12 rounded-full bg-[#00A651] text-white flex items-center justify-center">
              <User size={22} />
            </div>
            <div>
              <p className="text-base font-black text-[#111111]">{fullName || "Customer"}</p>
              <p className="text-xs text-[#087A43] font-semibold">Shree Hari Keerai Member</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <User size={16} className="text-[#00A651] mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-[#888888] uppercase tracking-wide">Full Name</p>
                <p className="text-sm font-semibold text-[#111111]">{fullName || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-[#00A651] mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-[#888888] uppercase tracking-wide">Email</p>
                <p className="text-sm font-semibold text-[#111111] break-all">{email || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-[#00A651] mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-[#888888] uppercase tracking-wide">Mobile Number</p>
                <p className="text-sm font-semibold text-[#111111]">{mobile ? `+91 ${mobile}` : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<Pencil size={16} />}
            onClick={() => navigate("/profile/edit")}
          >
            Edit Profile
          </Button>
        </div>

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </>
  );
}
