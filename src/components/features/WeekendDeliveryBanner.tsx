import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, X, Sparkles, Truck } from "lucide-react";
import { useLocation } from "react-router-dom";
import { isAuthPath } from "../../utils/authRoutes";

const SESSION_DISMISS_KEY = "shreehari_weekend_delivery_banner_dismissed";

export function WeekendDeliveryBanner() {
  const { pathname } = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if dismissed in current session
    const isDismissed = sessionStorage.getItem(SESSION_DISMISS_KEY) === "true";
    if (!isDismissed) {
      // Subtle delay so page first loads cleanly before banner smoothly slides in
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem(SESSION_DISMISS_KEY, "true");
  };

  if (isAuthPath(pathname)) return null;

  return (
    <div className="fixed top-18 sm:top-20 left-0 right-0 z-40 flex justify-center pointer-events-none px-3.5 sm:px-4">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="pointer-events-auto w-full max-w-lg relative bg-white/95 backdrop-blur-md rounded-[20px] p-3.5 sm:p-4 shadow-xl border border-[#00A651]/25 overflow-hidden select-none"
            style={{
              boxShadow: "0 12px 36px -4px rgba(0, 166, 81, 0.18), 0 4px 12px rgba(0, 0, 0, 0.05)",
            }}
            role="region"
            aria-label="Weekend Delivery Notice"
          >
            {/* Soft decorative background gradient glow */}
            <div
              className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none opacity-60"
              style={{
                background: "radial-gradient(circle, rgba(0, 166, 81, 0.25) 0%, transparent 70%)",
              }}
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full pointer-events-none opacity-40"
              style={{
                background: "radial-gradient(circle, rgba(8, 122, 67, 0.2) 0%, transparent 70%)",
              }}
              aria-hidden="true"
            />

            {/* Close Button at top-right */}
            <button
              onClick={handleDismiss}
              className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-100/90 hover:bg-gray-200/90 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-90 z-20"
              aria-label="Close delivery notice"
            >
              <X size={15} strokeWidth={2.5} />
            </button>

            {/* Content Layout */}
            <div className="relative z-10 flex items-start gap-3 sm:gap-3.5 pr-7 sm:pr-8">
              {/* Icon Container */}
              <div className="relative flex-shrink-0 mt-0.5">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] bg-gradient-to-br from-[#EAF8F0] to-[#D5F3E2] border border-[#00A651]/30 flex items-center justify-center text-[#00A651] shadow-inner">
                  <CalendarClock size={20} className="text-[#00A651] sm:w-[22px] sm:h-[22px]" strokeWidth={2.2} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00A651] text-white flex items-center justify-center shadow-sm">
                  <Sparkles size={8} />
                </div>
              </div>

              {/* Text Information */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="inline-flex items-center gap-1 bg-[#EAF8F0] text-[#087A43] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#00A651]/20">
                    <Truck size={10} className="text-[#00A651]" />
                    Delivery Schedule Notice
                  </span>
                </div>

                <p className="text-xs sm:text-[13px] font-bold text-[#111111] leading-snug sm:leading-normal">
                  Orders placed on <span className="text-[#087A43] font-black">Saturday</span> and{" "}
                  <span className="text-[#087A43] font-black">Sunday</span> will be delivered on{" "}
                  <span className="text-[#00A651] font-black underline decoration-[#00A651]/40 underline-offset-2">Monday</span>.
                </p>

                <p className="text-[11px] text-[#666666] font-medium mt-1 flex items-center gap-1">
                  <span>🌿</span> Fresh weekend harvests dispatched promptly on Monday evening.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
