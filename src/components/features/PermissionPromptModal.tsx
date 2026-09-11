import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, MapPin, Sparkles, CheckCircle2, ChevronRight, X, Shield } from "lucide-react";
import { useLocation } from "react-router-dom";

type PermissionType = "notification" | "location";

const SESSION_NOTIF_KEY = "shreehari_session_notif_prompted";
const SESSION_LOC_KEY = "shreehari_session_loc_prompted";

export function PermissionPromptModal() {
  const routerLocation = useLocation();
  const [activePrompt, setActivePrompt] = useState<PermissionType | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [successType, setSuccessType] = useState<PermissionType | null>(null);

  // Check if we should prompt for permissions
  const evaluatePermissions = useCallback(async () => {
    // Don't show intrusive prompts while user is on checkout or pincode gate
    if (routerLocation.pathname === "/checkout" || routerLocation.pathname === "/pincode") {
      setActivePrompt(null);
      return;
    }

    // 1. Check Notification Permission
    const notifPromptedInSession = sessionStorage.getItem(SESSION_NOTIF_KEY) === "true";
    const hasNotifApi = typeof window !== "undefined" && "Notification" in window;
    const notifGranted = hasNotifApi && Notification.permission === "granted";
    const notifDenied = hasNotifApi && Notification.permission === "denied";

    if (hasNotifApi && !notifGranted && !notifDenied && !notifPromptedInSession) {
      setActivePrompt("notification");
      return;
    }

    // 2. Check Location Permission
    const locPromptedInSession = sessionStorage.getItem(SESSION_LOC_KEY) === "true";
    const hasGeoApi = typeof navigator !== "undefined" && "geolocation" in navigator;

    if (hasGeoApi && !locPromptedInSession) {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          if (status.state === "prompt") {
            setActivePrompt("location");
            return;
          }
        }
      } catch {
        // If permissions.query is unsupported, we can prompt once per session if not prompted
        if (!locPromptedInSession) {
          setActivePrompt("location");
          return;
        }
      }
    }

    setActivePrompt(null);
  }, [routerLocation.pathname]);

  useEffect(() => {
    // Slight delay so the user first sees the page smoothly before the centered permission prompt appears
    const timer = setTimeout(() => {
      evaluatePermissions();
    }, 1200);

    return () => clearTimeout(timer);
  }, [evaluatePermissions]);

  // Handle Dismissal ("Maybe Later" or Close)
  const handleDismiss = () => {
    if (activePrompt === "notification") {
      sessionStorage.setItem(SESSION_NOTIF_KEY, "true");
      // Check if location prompt should show next
      const locPrompted = sessionStorage.getItem(SESSION_LOC_KEY) === "true";
      if (!locPrompted) {
        setTimeout(() => {
          evaluatePermissions();
        }, 400);
      } else {
        setActivePrompt(null);
      }
    } else if (activePrompt === "location") {
      sessionStorage.setItem(SESSION_LOC_KEY, "true");
      setActivePrompt(null);
    }
  };

  // Handle "Allow" Notification
  const handleAllowNotification = async () => {
    setRequesting(true);
    sessionStorage.setItem(SESSION_NOTIF_KEY, "true");

    try {
      if ("Notification" in window) {
        const result = await Notification.requestPermission();
        if (result === "granted") {
          setSuccessType("notification");
          await new Promise((r) => setTimeout(r, 900));
        }
      }
    } catch (e) {
      console.warn("Notification permission error:", e);
    } finally {
      setRequesting(false);
      setSuccessType(null);
      // Check if location prompt is also needed next
      evaluatePermissions();
    }
  };

  // Handle "Allow" Location
  const handleAllowLocation = async () => {
    setRequesting(true);
    sessionStorage.setItem(SESSION_LOC_KEY, "true");

    try {
      if ("geolocation" in navigator) {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
        setSuccessType("location");
        await new Promise((r) => setTimeout(r, 900));
      }
    } catch {
      // User may have denied or timed out; continue without error
    } finally {
      setRequesting(false);
      setSuccessType(null);
      setActivePrompt(null);
    }
  };

  if (!activePrompt) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        />

        {/* Centered Permission Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="relative w-full max-w-sm bg-white rounded-[26px] p-6 shadow-2xl border border-[#EAEAEA] z-10 overflow-hidden"
          style={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.18)" }}
        >
          {/* Subtle top decoration glow */}
          <div
            className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,166,81,0.18) 0%, transparent 70%)" }}
          />

          {/* Close / Skip 'x' */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {/* ─── Notification Permission Content ─────────────────────────────── */}
          {activePrompt === "notification" && (
            <div className="flex flex-col items-center text-center">
              {/* Icon Container */}
              <div className="relative mb-4">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  className="w-18 h-18 rounded-full bg-[#EAF8F0] border-2 border-[#00A651]/20 flex items-center justify-center shadow-inner"
                >
                  <Bell size={32} className="text-[#00A651]" />
                </motion.div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#00A651] text-white flex items-center justify-center shadow-md">
                  <Sparkles size={12} />
                </div>
              </div>

              {/* Title & Badge */}
              <span className="text-[11px] font-bold text-[#00A651] bg-[#EAF8F0] px-3 py-0.5 rounded-full uppercase tracking-wider mb-2">
                Stay Updated
              </span>
              <h2 className="text-xl font-black text-[#111111] tracking-tight leading-snug">
                Enable Order & Harvest Alerts
              </h2>

              {/* Description */}
              <p className="text-xs text-[#666666] mt-2 mb-4 leading-relaxed px-2">
                Get timely alerts when fresh greens are harvested and track your delivery status directly.
              </p>

              {/* Feature Benefit Items */}
              <div className="w-full bg-[#F9F9F9] rounded-[18px] p-3.5 flex flex-col gap-2.5 text-left mb-5 border border-[#F0F0F0]">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#EAF8F0] text-[#00A651] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 size={13} />
                  </div>
                  <p className="text-xs text-[#444444] font-medium">
                    <strong className="text-[#111111]">Daily Fresh Harvest:</strong> Pre-order before stocks sell out.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#EAF8F0] text-[#00A651] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 size={13} />
                  </div>
                  <p className="text-xs text-[#444444] font-medium">
                    <strong className="text-[#111111]">Delivery Tracking:</strong> Know when your delivery is en route.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-2">
                <button
                  onClick={handleAllowNotification}
                  disabled={requesting}
                  className="w-full h-12 rounded-[14px] bg-[#00A651] hover:bg-[#087A43] active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-75"
                >
                  {successType === "notification" ? (
                    <>
                      <CheckCircle2 size={18} />
                      Permission Granted!
                    </>
                  ) : requesting ? (
                    "Enabling Alerts…"
                  ) : (
                    <>
                      <Bell size={16} />
                      Allow Notifications
                    </>
                  )}
                </button>

                <button
                  onClick={handleDismiss}
                  disabled={requesting}
                  className="w-full h-10 rounded-[14px] text-xs font-bold text-[#888888] hover:text-[#444444] hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          )}

          {/* ─── Location Permission Content ────────────────────────────────── */}
          {activePrompt === "location" && (
            <div className="flex flex-col items-center text-center">
              {/* Icon Container */}
              <div className="relative mb-4">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  className="w-18 h-18 rounded-full bg-[#EAF8F0] border-2 border-[#00A651]/20 flex items-center justify-center shadow-inner"
                >
                  <MapPin size={32} className="text-[#00A651]" />
                </motion.div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#00A651] text-white flex items-center justify-center shadow-md">
                  <Shield size={12} />
                </div>
              </div>

              {/* Title & Badge */}
              <span className="text-[11px] font-bold text-[#00A651] bg-[#EAF8F0] px-3 py-0.5 rounded-full uppercase tracking-wider mb-2">
                Easy Delivery
              </span>
              <h2 className="text-xl font-black text-[#111111] tracking-tight leading-snug">
                Enable Location Access
              </h2>

              {/* Description */}
              <p className="text-xs text-[#666666] mt-2 mb-4 leading-relaxed px-2">
                Help us auto-detect your delivery address for fast, farm-fresh doorstep deliveries in Coimbatore without typing.
              </p>

              {/* Feature Benefit Items */}
              <div className="w-full bg-[#F9F9F9] rounded-[18px] p-3.5 flex flex-col gap-2.5 text-left mb-5 border border-[#F0F0F0]">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#EAF8F0] text-[#00A651] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 size={13} />
                  </div>
                  <p className="text-xs text-[#444444] font-medium">
                    <strong className="text-[#111111]">1-Tap Pinpoint:</strong> Drop your exact pin on Google Maps.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#EAF8F0] text-[#00A651] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 size={13} />
                  </div>
                  <p className="text-xs text-[#444444] font-medium">
                    <strong className="text-[#111111]">Doorstep Accuracy:</strong> Ensures prompt next-day arrival.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-2">
                <button
                  onClick={handleAllowLocation}
                  disabled={requesting}
                  className="w-full h-12 rounded-[14px] bg-[#00A651] hover:bg-[#087A43] active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-75"
                >
                  {successType === "location" ? (
                    <>
                      <CheckCircle2 size={18} />
                      Location Enabled!
                    </>
                  ) : requesting ? (
                    "Locating…"
                  ) : (
                    <>
                      <MapPin size={16} />
                      Allow Location Access
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>

                <button
                  onClick={handleDismiss}
                  disabled={requesting}
                  className="w-full h-10 rounded-[14px] text-xs font-bold text-[#888888] hover:text-[#444444] hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          )}

          {/* Safe & Private Footer Note */}
          <p className="text-[10px] text-[#AAAAAA] text-center mt-3">
            🔒 Your privacy is protected. You can change permissions anytime in browser settings.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
