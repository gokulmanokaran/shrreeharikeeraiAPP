import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import processPaymentHandler from "../api/process-payment.js";
import razorpayWebhookHandler from "../api/razorpay-webhook.js";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
process.env.RAZORPAY_KEY_SECRET = "test_razorpay_secret_suite";
const adminClient = createClient(url, serviceKey!, { auth: { persistSession: false } });

function mockReqRes(method: string, body: any, headers: Record<string, string> = {}) {
  let statusCode = 200;
  let responseData: any = null;

  const req = {
    method,
    body,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  };

  const res = {
    statusCode: 200,
    setHeader: () => {},
    status: function (code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json: function (data: any) {
      responseData = data;
      return this;
    },
    end: function (data?: string) {
      if (data && !responseData) {
        try { responseData = JSON.parse(data); } catch { responseData = data; }
      }
    },
  };

  return { req, res, getResult: () => ({ status: statusCode, data: responseData }) };
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("SHREE HARI KEERAI — RIGOROUS PRODUCT STOCK REDUCTION TEST SUITE");
  console.log("================================================================================\n");

  const results: Record<string, "PASS" | "FAIL"> = {};

  // Setup test products
  // Product 1: Variant product (Nuts & Seeds Laddu)
  const { data: nutsProd } = await adminClient.from("products").select("*").eq("id", "prod_mtkupkpw").single();
  const initialNutsStock = nutsProd?.stock_quantity ?? 20;

  // Product 2: Standard product (Palak Leaves)
  const { data: palakProd } = await adminClient.from("products").select("*").eq("id", "palak-leaves").single();
  const initialPalakStock = palakProd?.stock_quantity ?? 50;

  // Reset to known clean stock values
  await adminClient.from("products").update({ stock_quantity: 100, in_stock: true }).eq("id", "prod_mtkupkpw");
  await adminClient.from("products").update({ stock_quantity: 50, in_stock: true }).eq("id", "palak-leaves");

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Payment Failure / Verification Failure — Must NEVER reduce stock
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("TEST 1: Payment Failure / Signature Verification Failure...");
  const fakePaymentId = `pay_fake_${Date.now()}`;
  const { req: failReq, res: failRes, getResult: getFailRes } = mockReqRes("POST", {
    orderId: `SHK-TEMP-${Date.now()}`,
    fullName: "Fail Tester",
    mobile: "9876543210",
    email: "fail_test@example.com",
    address: "123 Test St",
    subtotal: 149,
    deliveryCharge: 0,
    discount: 0,
    total: 149,
    paymentId: fakePaymentId,
    razorpayPaymentId: fakePaymentId,
    razorpayOrderId: "order_fake_123",
    razorpaySignature: "INVALID_TAMPERED_SIGNATURE",
    items: [
      {
        id: "prod_mtkupkpw_1788400752322",
        productId: "prod_mtkupkpw",
        name: "Nuts & Seeds  Laddu",
        quantity: 2,
        price: 149,
      },
    ],
  });

  await processPaymentHandler(failReq, failRes);
  const failResult = getFailRes();
  console.log(`   - Signature failure status: ${failResult.status} (Rejected: ${failResult.status === 400 ? "YES ✅" : "NO ❌"})`);

  const { data: nutsAfterFail } = await adminClient.from("products").select("stock_quantity").eq("id", "prod_mtkupkpw").single();
  const stockUnchangedOnFailure = nutsAfterFail?.stock_quantity === 100;
  console.log(`   - Stock after failed payment: ${nutsAfterFail?.stock_quantity} (Unchanged: ${stockUnchangedOnFailure ? "YES ✅" : "NO ❌"})`);
  results["1. Payment Failure Never Deducts Stock"] = (!failResult.data?.success && stockUnchangedOnFailure) ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Successful Order with Variant Product (Nuts & Seeds Laddu)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST 2: Successful Order with Variant Product...");
  const validPaymentId1 = `pay_test_${Date.now()}_1`;
  const { req: successReq1, res: successRes1, getResult: getSuccessRes1 } = mockReqRes("POST", {
    orderId: `SHK-TEMP-${Date.now()}`,
    fullName: "Variant Buyer",
    mobile: "9876543210",
    email: "variant_buyer@example.com",
    address: "123 Test St",
    subtotal: 298,
    deliveryCharge: 0,
    discount: 0,
    total: 298,
    paymentId: validPaymentId1,
    razorpayPaymentId: validPaymentId1,
    items: [
      {
        id: "prod_mtkupkpw_1788400752322",
        productId: "prod_mtkupkpw",
        name: "Nuts & Seeds  Laddu",
        unit: "100g Box",
        quantity: 2,
        price: 149,
      },
    ],
  });

  await processPaymentHandler(successReq1, successRes1);
  const successResult1 = getSuccessRes1();
  const order1Id = successResult1.data?.orderId;
  console.log(`   - Order 1 created: ${order1Id}, status: ${successResult1.status}`);

  const { data: nutsAfterSuccess1 } = await adminClient.from("products").select("stock_quantity").eq("id", "prod_mtkupkpw").single();
  const nutsDeductedExact = nutsAfterSuccess1?.stock_quantity === 98; // 100 - 2 = 98
  console.log(`   - Nuts stock: 100 -> ${nutsAfterSuccess1?.stock_quantity} (Deducted 2: ${nutsDeductedExact ? "YES ✅" : "NO ❌"})`);
  results["2. Variant Product Stock Deducted Correctly"] = (successResult1.status === 200 && nutsDeductedExact) ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Successful Order with Standard (Non-variant) Product (Palak Leaves)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST 3: Successful Order with Standard Non-variant Product...");
  const validPaymentId2 = `pay_test_${Date.now()}_2`;
  const { req: successReq2, res: successRes2, getResult: getSuccessRes2 } = mockReqRes("POST", {
    orderId: `SHK-TEMP-${Date.now()}`,
    fullName: "Palak Buyer",
    mobile: "9876543210",
    email: "palak_buyer@example.com",
    address: "123 Test St",
    subtotal: 100,
    deliveryCharge: 0,
    discount: 0,
    total: 100,
    paymentId: validPaymentId2,
    razorpayPaymentId: validPaymentId2,
    items: [
      {
        id: "palak-leaves",
        name: "Palak Leaves",
        quantity: 5,
        price: 20,
      },
    ],
  });

  await processPaymentHandler(successReq2, successRes2);
  const successResult2 = getSuccessRes2();
  const order2Id = successResult2.data?.orderId;
  console.log(`   - Order 2 created: ${order2Id}, status: ${successResult2.status}`);

  const { data: palakAfterSuccess2 } = await adminClient.from("products").select("stock_quantity").eq("id", "palak-leaves").single();
  const palakDeductedExact = palakAfterSuccess2?.stock_quantity === 45; // 50 - 5 = 45
  console.log(`   - Palak stock: 50 -> ${palakAfterSuccess2?.stock_quantity} (Deducted 5: ${palakDeductedExact ? "YES ✅" : "NO ❌"})`);
  results["3. Standard Product Stock Deducted Correctly"] = (successResult2.status === 200 && palakDeductedExact) ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Duplicate Submission / Retry / Webhook — Must NOT deduct stock twice
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST 4: Duplicate Submission & Webhook Idempotency...");
  // 1. Browser retry / refresh duplicate call
  const { req: dupReq, res: dupRes, getResult: getDupRes } = mockReqRes("POST", {
    orderId: order1Id,
    paymentId: validPaymentId1,
    razorpayPaymentId: validPaymentId1,
    items: [
      {
        id: "prod_mtkupkpw_1788400752322",
        productId: "prod_mtkupkpw",
        name: "Nuts & Seeds  Laddu",
        quantity: 2,
        price: 149,
      },
    ],
  });
  await processPaymentHandler(dupReq, dupRes);
  const dupResult = getDupRes();
  console.log(`   - Duplicate process-payment status: ${dupResult.status}`);

  // 2. Razorpay Webhook duplicate call for same payment
  const { req: whReq, res: whRes, getResult: getWhRes } = mockReqRes("POST", {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: validPaymentId1,
          amount: 29800,
          currency: "INR",
          status: "captured",
          notes: {
            storefrontOrderId: order1Id,
          },
        },
      },
    },
  });
  await razorpayWebhookHandler(whReq, whRes);
  const whResult = getWhRes();
  console.log(`   - Duplicate Webhook status: ${whResult.status}`);

  const { data: nutsAfterDuplicates } = await adminClient.from("products").select("stock_quantity").eq("id", "prod_mtkupkpw").single();
  const stockUnchangedAfterDuplicates = nutsAfterDuplicates?.stock_quantity === 98;
  console.log(`   - Stock after duplicates: ${nutsAfterDuplicates?.stock_quantity} (Unchanged at 98: ${stockUnchangedAfterDuplicates ? "YES ✅" : "NO ❌"})`);
  results["4. Duplicate & Webhook Never Double-Deducts"] = stockUnchangedAfterDuplicates ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Stock Reaching Exactly 0 & Setting in_stock = false
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST 5: Stock Reaching Exactly 0 & in_stock = false...");
  // Set stock to 3
  await adminClient.from("products").update({ stock_quantity: 3, in_stock: true }).eq("id", "prod_mtkupkpw");

  const validPaymentId3 = `pay_test_${Date.now()}_3`;
  const { req: req3, res: res3 } = mockReqRes("POST", {
    orderId: `SHK-TEMP-${Date.now()}`,
    fullName: "Clearance Buyer",
    mobile: "9876543210",
    email: "clearance@example.com",
    address: "123 Test St",
    subtotal: 447,
    deliveryCharge: 0,
    discount: 0,
    total: 447,
    paymentId: validPaymentId3,
    razorpayPaymentId: validPaymentId3,
    items: [
      {
        id: "prod_mtkupkpw_1788400752322",
        productId: "prod_mtkupkpw",
        name: "Nuts & Seeds  Laddu",
        quantity: 3,
        price: 149,
      },
    ],
  });
  await processPaymentHandler(req3, res3);

  const { data: nutsAfterZero } = await adminClient.from("products").select("stock_quantity, in_stock").eq("id", "prod_mtkupkpw").single();
  const exactlyZero = nutsAfterZero?.stock_quantity === 0;
  const outOfStockFlag = nutsAfterZero?.in_stock === false;
  console.log(`   - Nuts stock: ${nutsAfterZero?.stock_quantity} (0: ${exactlyZero ? "YES ✅" : "NO ❌"}), in_stock: ${nutsAfterZero?.in_stock} (false: ${outOfStockFlag ? "YES ✅" : "NO ❌"})`);
  results["5. Stock Reaches 0 & Sets in_stock=false"] = (exactlyZero && outOfStockFlag) ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: Insufficient Stock Guard — Stock Must NEVER Become Negative
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST 6: Insufficient Stock Guard (Stock: 2, Requested: 7)...");
  await adminClient.from("products").update({ stock_quantity: 2, in_stock: true }).eq("id", "prod_mtkupkpw");

  const validPaymentId4 = `pay_test_${Date.now()}_4`;
  const { req: req4, res: res4 } = mockReqRes("POST", {
    orderId: `SHK-TEMP-${Date.now()}`,
    fullName: "Over Buyer",
    mobile: "9876543210",
    email: "over_buyer@example.com",
    address: "123 Test St",
    subtotal: 1043,
    deliveryCharge: 0,
    discount: 0,
    total: 1043,
    paymentId: validPaymentId4,
    razorpayPaymentId: validPaymentId4,
    items: [
      {
        id: "prod_mtkupkpw_1788400752322",
        productId: "prod_mtkupkpw",
        name: "Nuts & Seeds  Laddu",
        quantity: 7,
        price: 149,
      },
    ],
  });
  await processPaymentHandler(req4, res4);

  const { data: nutsAfterOver } = await adminClient.from("products").select("stock_quantity, in_stock").eq("id", "prod_mtkupkpw").single();
  const clampedToZero = nutsAfterOver?.stock_quantity === 0;
  const notNegative = (nutsAfterOver?.stock_quantity ?? -1) >= 0;
  console.log(`   - Stock after purchasing 7 when 2 available: ${nutsAfterOver?.stock_quantity} (Clamped to 0: ${clampedToZero ? "YES ✅" : "NO ❌"}, Not Negative: ${notNegative ? "YES ✅" : "NO ❌"})`);
  results["6. Non-Negative Stock Guard"] = (clampedToZero && notNegative) ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7: Sequential Order ID Integrity Check
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\nTEST 7: Sequential Order ID Integrity Check...");
  const isSequentialFormat = /^SHK\d+$/i.test(order1Id || "") || /^SHK-\d+$/i.test(order1Id || "");
  console.log(`   - Order 1 format: ${order1Id} (Matches sequential format: ${isSequentialFormat ? "YES ✅" : "NO ❌"})`);
  results["7. Sequential Order ID Untouched & Working"] = isSequentialFormat ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // Clean Up: Restore original product stocks and clean test order rows
  // ─────────────────────────────────────────────────────────────────────────────
  await adminClient.from("products").update({ stock_quantity: initialNutsStock, in_stock: true }).eq("id", "prod_mtkupkpw");
  await adminClient.from("products").update({ stock_quantity: initialPalakStock, in_stock: true }).eq("id", "palak-leaves");
  await adminClient.from("orders").delete().in("razorpay_payment_id", [validPaymentId1, validPaymentId2, validPaymentId3, validPaymentId4]);

  console.log("\n================================================================================");
  console.log("FINAL TEST RESULTS SUMMARY:");
  console.log("================================================================================");
  let allPass = true;
  for (const [testName, status] of Object.entries(results)) {
    console.log(`  ${status === "PASS" ? "✅" : "❌"} ${testName}: ${status}`);
    if (status !== "PASS") allPass = false;
  }
  console.log("================================================================================");
  console.log(`OVERALL RESULT: ${allPass ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);
  console.log("================================================================================\n");

  if (!allPass) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error("Test Suite Unhandled Exception:", err);
  process.exit(1);
});
