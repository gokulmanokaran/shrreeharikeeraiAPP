import { useEffect, useRef } from "react";
import { STORAGE_KEYS, getItem, setItem } from "../../utils/storage";

/**
 * DailyNotification
 *
 * - Listens for granted Notification permission.
 * - When permission is granted, schedules a client-side daily notification for 9:00 AM.
 * - Avoids duplicate notifications via last-sent date tracking.
 */
export function DailyNotification() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    // Check if we already sent a notification today
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const lastSent = getItem<string>(STORAGE_KEYS.NOTIFICATION_LAST_SENT, "");
    if (lastSent === today) return;

    // Calculate ms until 9:00 AM
    const now = new Date();
    const next9am = new Date(now);
    next9am.setHours(9, 0, 0, 0);

    if (now >= next9am) {
      // Already past 9 AM today — schedule for tomorrow 9 AM
      next9am.setDate(next9am.getDate() + 1);
    }

    const msUntil9am = next9am.getTime() - now.getTime();

    timerRef.current = setTimeout(() => {
      const sentToday = new Date().toISOString().slice(0, 10);
      const alreadySentToday = getItem<string>(STORAGE_KEYS.NOTIFICATION_LAST_SENT, "");
      if (alreadySentToday === sentToday) return;

      try {
        const notif = new Notification("🌿 Shree Hari Keerai — Pre-Order Now!", {
          body: "Fresh greens & natural foods are ready to order! Today Order – Tomorrow Evening Delivery Guaranteed.",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "daily-promo",
        });

        setItem(STORAGE_KEYS.NOTIFICATION_LAST_SENT, sentToday);
        setTimeout(() => notif.close(), 8000);
      } catch (e) {
        console.warn("Notification trigger error:", e);
      }
    }, msUntil9am);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return null;
}
