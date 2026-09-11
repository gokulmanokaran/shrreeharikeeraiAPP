import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleUserRound,
  User,
  Pencil,
  Package,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../store/AuthContext";

export function UserAccountMenu() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isGuest = !user;
  const displayName = profile?.fullName || user?.user_metadata?.full_name || user?.email || "My Account";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
          user ? "bg-[#EAF8F0] text-[#00A651]" : "hover:bg-gray-100 text-[#111111]"
        }`}
        aria-label="My account"
        aria-expanded={open}
      >
        <CircleUserRound size={18} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-11 w-[240px] bg-white rounded-[16px] border border-[#EAEAEA] shadow-xl overflow-hidden z-50"
          >
            {isGuest ? (
              <>
                <div className="px-4 py-3 bg-[#F5FCF8] border-b border-[#EAEAEA]">
                  <p className="text-[11px] font-bold text-[#00A651] uppercase tracking-wide">Welcome</p>
                  <p className="text-sm font-black text-[#111111]">Guest User</p>
                  <p className="text-[11px] text-[#666666] mt-0.5">Log in to view past orders &amp; profile</p>
                </div>
                <div className="p-3 border-b border-[#EAEAEA]">
                  <button
                    type="button"
                    onClick={() => go("/login")}
                    className="w-full h-9 bg-[#00A651] text-white rounded-[10px] text-xs font-bold hover:bg-[#087A43] transition-colors cursor-pointer shadow-xs flex items-center justify-center"
                  >
                    Login / Sign In
                  </button>
                </div>
                <div className="py-1">
                  <MenuItem icon={<Package size={16} />} label="My Orders" onClick={() => go("/orders")} />
                </div>
              </>
            ) : (
              <>
                <div className="px-4 py-3 bg-[#F5FCF8] border-b border-[#EAEAEA]">
                  <p className="text-[11px] font-bold text-[#00A651] uppercase tracking-wide">Account</p>
                  <p className="text-sm font-black text-[#111111] truncate">{displayName}</p>
                </div>
                <div className="py-1.5">
                  <MenuItem icon={<User size={16} />} label="My Profile" onClick={() => go("/profile")} />
                  <MenuItem icon={<Pencil size={16} />} label="Edit Profile" onClick={() => go("/profile/edit")} />
                  <MenuItem icon={<Package size={16} />} label="My Orders" onClick={() => go("/orders")} />
                  <MenuItem icon={<Settings size={16} />} label="Account Settings" onClick={() => go("/account")} />
                  <button
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      await logout();
                      navigate("/", { replace: true });
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#EA4335] hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#111111] hover:bg-[#EAF8F0] hover:text-[#087A43] transition-colors"
    >
      <span className="text-[#00A651]">{icon}</span>
      {label}
    </button>
  );
}
