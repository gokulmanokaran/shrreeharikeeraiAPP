// localStorage key constants
export const STORAGE_KEYS = {
  CART: "shreehari_cart",
  PINCODE: "shreehari_pincode",
  DELIVERY_CHARGE: "shreehari_delivery_charge",
  DELIVERY_AVAILABLE: "shreehari_delivery_available",
  NOTIFICATION_LAST_SENT: "shreehari_notif_last_sent", // date string YYYY-MM-DD
  NOTIFICATION_PERMISSION_ASKED: "shreehari_notif_asked",
} as const;

export function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail — storage might be full or disabled
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}
