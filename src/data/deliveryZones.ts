// Centralized delivery zone configuration
// Allowed delivery pincodes — ONLY these 8:
// 641014, 641048, 641051, 641004, 641035, 641062, 641028, 641107

export interface DeliveryZone {
  charge: number;       // Base delivery charge in ₹ (30)
  minimumOrder: number; // Minimum order value in ₹ (199)
  zoneName?: string;
}

export const ALLOWED_PINCODES = [
  "641014",
  "641048",
  "641051",
  "641004",
  "641035",
  "641062",
  "641028",
  "641107",
] as const;

export const DEFAULT_MINIMUM_ORDER = 199;
export const MINIMUM_ORDER_VALUE = 199;
export const FREE_DELIVERY_THRESHOLD = 300;
export const BASE_DELIVERY_CHARGE = 30;
export const FREE_DELIVERY_CHARGE = 0;
export const BUSINESS_PHONE = "9790209685";
export const UNSUPPORTED_PINCODE_MESSAGE = "Sorry, delivery is not available for this pincode.";

const FLAT_ZONE: DeliveryZone = {
  charge: BASE_DELIVERY_CHARGE,
  minimumOrder: MINIMUM_ORDER_VALUE,
  zoneName: "Coimbatore Delivery Zone",
};

export const DELIVERY_ZONES: Record<string, DeliveryZone> = {
  "641014": FLAT_ZONE,
  "641048": FLAT_ZONE,
  "641051": FLAT_ZONE,
  "641004": FLAT_ZONE,
  "641035": FLAT_ZONE,
  "641062": FLAT_ZONE,
  "641028": FLAT_ZONE,
  "641107": FLAT_ZONE,
};

/** Get delivery zone details for a pincode */
export function getDeliveryZone(pincode: string): DeliveryZone | null {
  const clean = pincode.trim();
  return DELIVERY_ZONES[clean] ?? null;
}

/**
 * Get delivery charge for an order.
 * - Flat ₹30 for orders from ₹199 to ₹299
 * - ₹0 (Free Delivery) for orders ₹300 or above
 */
export function calculateDeliveryCharge(subtotal: number, pincode?: string): number {
  if (pincode && !isValidPincode(pincode)) {
    return BASE_DELIVERY_CHARGE;
  }
  if (subtotal >= FREE_DELIVERY_THRESHOLD) {
    return FREE_DELIVERY_CHARGE;
  }
  return BASE_DELIVERY_CHARGE;
}

/** Get base delivery charge for a pincode (returns 30 if valid, null if invalid) */
export function getDeliveryCharge(pincode: string, subtotal?: number): number | null {
  const clean = pincode.trim();
  if (!(clean in DELIVERY_ZONES)) return null;
  if (subtotal !== undefined && subtotal >= FREE_DELIVERY_THRESHOLD) {
    return FREE_DELIVERY_CHARGE;
  }
  return BASE_DELIVERY_CHARGE;
}

/** Get minimum order for a pincode */
export function getMinimumOrder(_pincode?: string): number {
  return MINIMUM_ORDER_VALUE;
}

/** Check if a pincode is within our 8 serviceable delivery zones */
export function isValidPincode(pincode: string): boolean {
  if (!pincode) return false;
  const clean = pincode.trim();
  return clean in DELIVERY_ZONES;
}

export const isServiceablePincode = isValidPincode;
export const getDeliveryZoneInfo = getDeliveryZone;

/** Return all 8 available service pincodes */
export function getServiceablePincodes(): string[] {
  return [...ALLOWED_PINCODES];
}
