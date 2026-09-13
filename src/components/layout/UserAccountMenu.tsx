import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserRound,
  Package,
  LogOut,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../store/AuthContext";

export function UserAccountMenu() {
  const { profile, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isGuest = !user;
  const displayName =
    profile?.fullName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "My Account";

  const userInitial = (
    profile?.fullName?.trim()?.[0] ||
    user?.user_metadata?.full_name?.trim()?.[0] ||
    user?.email?.trim()?.[0] ||
    "U"
  ).toUpperCase();

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
      {/* Modern UI User Account Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        className={`relative h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
          user
            ? "w-9 bg-gradient-to-tr from-[#00A651] via-[#009247] to-[#10B981] text-white shadow-[0_2px_8px_rgba(0,166,81,0.25)] ring-2 ring-[#00A651]/20 hover:ring-[#00A651]/40"
            : "w-9 bg-white hover:bg-[#F5FCF8] border border-gray-200 hover:border-[#A3E5C1] text-gray-700 hover:text-[#00A651] shadow-2xs"
        }`}
        aria-label="My account"
        aria-expanded={open}
      >
        {user ? (
          <>
            <span className="text-[13px] font-black tracking-tight select-none">
              {userInitial}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10B981] rounded-full ring-2 ring-white" />
          </>
        ) : (
          <UserRound size={18} className="stroke-[2.2]" />
        )}
      </motion.button>

      {/* Modern Dropdown Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-12 w-[260px] bg-white/98 backdrop-blur-xl rounded-[20px] border border-gray-100 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.15)] overflow-hidden z-50 p-1.5"
          >
            {isGuest ? (
              <>
                <div className="px-3.5 py-3 bg-gradient-to-br from-[#F5FCF8] to-emerald-50/40 rounded-[14px] border border-[#E2F7EB] mb-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#00A651] uppercase tracking-wide">
                    <Sparkles size={13} />
                    <span>Welcome</span>
                  </div>
                  <p className="text-sm font-black text-[#111111] mt-0.5">Guest User</p>
                  <p className="text-[11px] text-[#666666] mt-0.5 leading-snug">
                    Log in to order fresh greens &amp; track deliveries
                  </p>
                </div>
                <div className="p-1 mb-1">
                  <button
                    type="button"
                    onClick={() => go("/login")}
                    className="w-full h-10 bg-[#00A651] hover:bg-[#008f45] text-white rounded-[12px] text-xs font-bold transition-all shadow-sm flex items-center justify-center cursor-pointer"
                  >
                    Login / Create Account
                  </button>
                </div>
                <div className="py-0.5">
                  <MenuItem
                    icon={<Package size={16} />}
                    label="My Orders"
                    onClick={() => go("/orders")}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Modern User Profile Header Card */}
                <div className="px-3.5 py-3 bg-gradient-to-br from-[#F5FCF8] to-[#EAF8F0]/50 rounded-[14px] border border-[#E2F7EB] mb-1.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00A651] to-[#008743] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {userInitial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#111111] truncate">{displayName}</p>
                      <p className="text-[11px] text-[#666666] truncate">{user?.email || ""}</p>
                    </div>
                  </div>
                </div>

                {/* Navigation Items (Without Edit Profile and Without Account Settings) */}
                <div className="py-1 space-y-0.5">
                  <MenuItem
                    icon={<UserRound size={16} />}
                    label="My Profile"
                    onClick={() => go("/profile")}
                  />
                  <MenuItem
                    icon={<Package size={16} />}
                    label="My Orders"
                    onClick={() => go("/orders")}
                  />
                </div>

                <div className="my-1 border-t border-gray-100" />

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={async () => {
                    setOpen(false);
                    await logout();
                    navigate("/", { replace: true });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-[#EA4335] hover:bg-red-50 rounded-[12px] transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
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
      className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-[#222222] hover:bg-[#EAF8F0]/70 hover:text-[#00A651] rounded-[12px] transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[#00A651] group-hover:scale-110 transition-transform">{icon}</span>
        <span>{label}</span>
      </div>
      <ChevronRight size={14} className="text-gray-400 group-hover:text-[#00A651] group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}
