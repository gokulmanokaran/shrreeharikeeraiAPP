// Centralized delivery zone configuration
// Maps Coimbatore service pincodes → { charge, minimumOrder }

export interface DeliveryZone {
  charge: number;       // Delivery charge in ₹
  minimumOrder: number; // Minimum order value in ₹
  zoneName?: string;
}

// Zone A — ₹30 delivery, ₹199 minimum order
const ZONE_A: DeliveryZone = { charge: 30, minimumOrder: 199, zoneName: "Central Coimbatore" };

// Zone B — ₹50 delivery, ₹249 minimum order
const ZONE_B: DeliveryZone = { charge: 50, minimumOrder: 249, zoneName: "Coimbatore Suburbs" };

// Zone C — ₹80 delivery, ₹299 minimum order
const ZONE_C: DeliveryZone = { charge: 80, minimumOrder: 299, zoneName: "Outer Coimbatore" };

export const DELIVERY_ZONES: Record<string, DeliveryZone> = {
  // ── Zone A (₹30 charge) ────────────────────────────────────────────────────
  "641014": ZONE_A,
  "641048": ZONE_A,
  "641051": ZONE_A,

  // ── Zone B (₹50 charge) ────────────────────────────────────────────────────
  "641004": ZONE_B,
  "641035": ZONE_B,
  "641062": ZONE_B,
  "641028": ZONE_B,
  "641107": ZONE_B,

  // ── Zone C (₹80 charge) ────────────────────────────────────────────────────
  "641005": ZONE_C,
  "641018": ZONE_C,
  "641006": ZONE_C,
  "641037": ZONE_C,
  "641045": ZONE_C,
  "641012": ZONE_C,
};

/** Fallback global minimum (used before a location is pinned) */
export const DEFAULT_MINIMUM_ORDER = 199;

export const BUSINESS_PHONE = "9790209685";

/** Get delivery zone details for a pincode */
export function getDeliveryZone(pincode: string): DeliveryZone | null {
  const clean = pincode.trim();
  return DELIVERY_ZONES[clean] ?? null;
}

/** Get delivery charge for a pincode */
export function getDeliveryCharge(pincode: string): number | null {
  const clean = pincode.trim();
  return DELIVERY_ZONES[clean]?.charge ?? null;
}

/** Get minimum order for a pincode */
export function getMinimumOrder(pincode: string): number {
  const clean = pincode.trim();
  return DELIVERY_ZONES[clean]?.minimumOrder ?? DEFAULT_MINIMUM_ORDER;
}

/** Check if a pincode is within our serviceable delivery zones */
export function isValidPincode(pincode: string): boolean {
  if (!pincode) return false;
  const clean = pincode.trim();
  return clean in DELIVERY_ZONES;
}

/** Return all available service pincodes list */
export function getServiceablePincodes(): string[] {
  return Object.keys(DELIVERY_ZONES);
}
