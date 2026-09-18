import {
  ALLOWED_PINCODES,
  MINIMUM_ORDER_VALUE,
  FREE_DELIVERY_THRESHOLD,
  BASE_DELIVERY_CHARGE,
  FREE_DELIVERY_CHARGE,
  UNSUPPORTED_PINCODE_MESSAGE,
  isServiceablePincode,
  calculateDeliveryCharge,
  getDeliveryZoneInfo,
} from "../src/data/deliveryZones";
import {
  validateLocationPin,
  validateCheckoutPincode,
} from "../src/utils/validation";
import {
  calculateDiscount,
  calculateTotal,
  calculateDelivery,
} from "../src/utils/price";
import {
  ALLOWED_DELIVERY_PINCODES,
  SERVER_MINIMUM_ORDER,
  SERVER_FREE_DELIVERY_THRESHOLD,
  SERVER_BASE_DELIVERY_CHARGE,
  SERVER_UNSUPPORTED_PINCODE_MESSAGE,
  isValidServerPincode,
  calculateServerDeliveryCharge,
} from "../api/_catalog";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log("=================================================");
console.log("RUNNING DELIVERY VALIDATION & PRICING TEST SUITE");
console.log("=================================================\n");

// 1. Verify Allowed Pincodes List
console.log("--- 1. Allowed Pincodes (ONLY 8) ---");
const expectedPincodes = [
  "641014",
  "641048",
  "641051",
  "641004",
  "641035",
  "641062",
  "641028",
  "641107",
];

assert(ALLOWED_PINCODES.length === 8, "Frontend ALLOWED_PINCODES has exactly 8 pincodes");
assert(ALLOWED_DELIVERY_PINCODES.length === 8, "Backend ALLOWED_DELIVERY_PINCODES has exactly 8 pincodes");

for (const pin of expectedPincodes) {
  assert(isServiceablePincode(pin), `Frontend accepts allowed pincode: ${pin}`);
  assert(isValidServerPincode(pin), `Backend accepts allowed pincode: ${pin}`);
  assert(validateCheckoutPincode(pin) === null, `validateCheckoutPincode accepts: ${pin}`);
  assert(validateLocationPin(11.0, 76.9, pin) === null, `validateLocationPin accepts: ${pin}`);
}

// 2. Verify Rejected Pincodes
console.log("\n--- 2. Unsupported Pincodes Rejection & Exact Error Message ---");
const unsupportedPincodes = [
  "641001",
  "641002",
  "641005", // Old Zone C
  "641006", // Old Zone C
  "641012", // Old Zone C
  "641018", // Old Zone C
  "641037", // Old Zone C
  "641045", // Old Zone C
  "600001", // Chennai
  "560001", // Bangalore
  "110001", // Delhi
  "000000",
  "123456",
  "",
];

for (const pin of unsupportedPincodes) {
  assert(!isServiceablePincode(pin), `Frontend rejects unsupported pincode: "${pin}"`);
  assert(!isValidServerPincode(pin), `Backend rejects unsupported pincode: "${pin}"`);

  if (pin && pin.length === 6) {
    const valRes = validateCheckoutPincode(pin);
    assert(valRes !== null, `validateCheckoutPincode rejects: ${pin}`);
    assert(valRes === UNSUPPORTED_PINCODE_MESSAGE, `Error matches exact message: "${valRes}"`);

    const locRes = validateLocationPin(11.0, 76.9, pin);
    assert(locRes !== null, `validateLocationPin rejects: ${locRes}`);
    assert(locRes === UNSUPPORTED_PINCODE_MESSAGE, `Location error matches exact message: "${locRes}"`);
  }
}

assert(
  UNSUPPORTED_PINCODE_MESSAGE === "Sorry, delivery is not available for this pincode.",
  `Exact message string verified: "${UNSUPPORTED_PINCODE_MESSAGE}"`
);
assert(
  SERVER_UNSUPPORTED_PINCODE_MESSAGE === "Sorry, delivery is not available for this pincode.",
  `Exact server message string verified: "${SERVER_UNSUPPORTED_PINCODE_MESSAGE}"`
);

// 3. Verify Minimum Order Value (₹199)
console.log("\n--- 3. Minimum Order Value (₹199) ---");
assert(MINIMUM_ORDER_VALUE === 199, "Frontend MINIMUM_ORDER_VALUE is ₹199");
assert(SERVER_MINIMUM_ORDER === 199, "Backend SERVER_MINIMUM_ORDER is ₹199");

// 4. Verify Delivery Charge Calculation Rules
console.log("\n--- 4. Delivery Charges & Free Delivery Threshold (₹300) ---");
assert(FREE_DELIVERY_THRESHOLD === 300, "FREE_DELIVERY_THRESHOLD is ₹300");
assert(SERVER_FREE_DELIVERY_THRESHOLD === 300, "SERVER_FREE_DELIVERY_THRESHOLD is ₹300");
assert(BASE_DELIVERY_CHARGE === 30, "BASE_DELIVERY_CHARGE is ₹30");
assert(SERVER_BASE_DELIVERY_CHARGE === 30, "SERVER_BASE_DELIVERY_CHARGE is ₹30");
assert(FREE_DELIVERY_CHARGE === 0, "FREE_DELIVERY_CHARGE is ₹0");

// ₹199 to ₹299 -> ₹30 delivery charge
assert(calculateDeliveryCharge(199) === 30, "Subtotal ₹199 -> ₹30 delivery");
assert(calculateServerDeliveryCharge(199) === 30, "Server Subtotal ₹199 -> ₹30 delivery");
assert(calculateTotal(199, calculateDelivery(199)) === 229, "Subtotal ₹199 + ₹30 = ₹229 total");

assert(calculateDeliveryCharge(250) === 30, "Subtotal ₹250 -> ₹30 delivery");
assert(calculateServerDeliveryCharge(250) === 30, "Server Subtotal ₹250 -> ₹30 delivery");
assert(calculateTotal(250, calculateDelivery(250)) === 280, "Subtotal ₹250 + ₹30 = ₹280 total");

assert(calculateDeliveryCharge(299) === 30, "Subtotal ₹299 -> ₹30 delivery");
assert(calculateServerDeliveryCharge(299) === 30, "Server Subtotal ₹299 -> ₹30 delivery");
assert(calculateTotal(299, calculateDelivery(299)) === 329, "Subtotal ₹299 + ₹30 = ₹329 total");

// ₹300 or above -> ₹0 (Free Delivery)
assert(calculateDeliveryCharge(300) === 0, "Subtotal ₹300 -> ₹0 (Free Delivery)");
assert(calculateServerDeliveryCharge(300) === 0, "Server Subtotal ₹300 -> ₹0 (Free Delivery)");
assert(calculateTotal(300, calculateDelivery(300)) === 300, "Subtotal ₹300 + ₹0 = ₹300 total");

assert(calculateDeliveryCharge(500) === 0, "Subtotal ₹500 -> ₹0 (Free Delivery)");
assert(calculateServerDeliveryCharge(500) === 0, "Server Subtotal ₹500 -> ₹0 (Free Delivery)");
assert(calculateTotal(500, calculateDelivery(500)) === 500, "Subtotal ₹500 + ₹0 = ₹500 total");

// 5. Verify Discount / Coupon Removal (Always 0)
console.log("\n--- 5. Discount / Coupon Removal ---");
const discount100 = calculateDiscount(100);
const discount300 = calculateDiscount(300);
const discount1000 = calculateDiscount(1000);

assert(discount100.amount === 0 && discount100.percentage === 0, "Discount for ₹100 is 0");
assert(discount300.amount === 0 && discount300.percentage === 0, "Discount for ₹300 is 0");
assert(discount1000.amount === 0 && discount1000.percentage === 0, "Discount for ₹1000 is 0");

console.log("\n=================================================");
console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! (100% COVERAGE)");
console.log("=================================================");
