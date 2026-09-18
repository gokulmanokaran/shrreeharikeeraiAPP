import {
  MINIMUM_ORDER_VALUE,
  FREE_DELIVERY_THRESHOLD,
  BASE_DELIVERY_CHARGE,
  FREE_DELIVERY_CHARGE,
  calculateDeliveryCharge as getZoneDeliveryCharge,
} from "../data/deliveryZones";

export function formatPrice(amount: number): string {
  return `₹${amount}`;
}

export function formatPriceWithUnit(price: number, unit: string): string {
  return `₹${price} / ${unit}`;
}

export function calculateSubtotal(
  items: Array<{ price: number; quantity: number }>
): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// ── Discount / Coupon functionality removed ──────────────────────────────────
export interface DiscountResult {
  rate: number;
  percentage: number;
  amount: number;
}

export function calculateDiscount(_subtotal: number): DiscountResult {
  return { rate: 0, percentage: 0, amount: 0 };
}

/**
 * Calculate final delivery charge:
 * - ₹30 for orders from ₹199 to ₹299
 * - ₹0 (Free Delivery) for orders ₹300 or above
 */
export function calculateDeliveryCharge(subtotal: number, pincode?: string): number {
  return getZoneDeliveryCharge(subtotal, pincode);
}

export const calculateDelivery = calculateDeliveryCharge;

export function calculateTotal(subtotal: number, deliveryCharge: number): number {
  return subtotal + deliveryCharge;
}

export function getMinimumOrderShortfall(subtotal: number, minimum: number = MINIMUM_ORDER_VALUE): number {
  return Math.max(0, minimum - subtotal);
}

export { MINIMUM_ORDER_VALUE, FREE_DELIVERY_THRESHOLD, BASE_DELIVERY_CHARGE, FREE_DELIVERY_CHARGE };
