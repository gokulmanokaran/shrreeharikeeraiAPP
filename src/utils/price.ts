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

// ── Discount Rules ───────────────────────────────────────────────────────────
//  subtotal < ₹300        → 0% discount
//  ₹300 ≤ subtotal < ₹499 → 5% discount
//  subtotal ≥ ₹499        → 10% discount  (never stacked with 5%)

export interface DiscountResult {
  rate: number;        // 0, 0.05, or 0.10
  percentage: number;  // 0, 5, or 10  (for display)
  amount: number;      // Actual ₹ discount (rounded to 2dp)
}

export function calculateDiscount(subtotal: number): DiscountResult {
  let rate = 0;
  if (subtotal >= 499) {
    rate = 0.10;
  } else if (subtotal >= 300) {
    rate = 0.05;
  }
  const amount = Math.round(subtotal * rate * 100) / 100;
  return { rate, percentage: rate * 100, amount };
}

export function calculateTotal(subtotal: number, deliveryCharge: number): number {
  const { amount: discount } = calculateDiscount(subtotal);
  return subtotal - discount + deliveryCharge;
}

export function getMinimumOrderShortfall(subtotal: number, minimum: number): number {
  return Math.max(0, minimum - subtotal);
}
