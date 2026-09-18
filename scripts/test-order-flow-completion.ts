import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { generateUniqueOrderId, getOrGenerateSequentialOrderId } from "../api/_catalog.js";
import processPaymentHandler from "../api/process-payment.js";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const adminClient = createClient(url, serviceKey!, { auth: { persistSession: false } });

// Helper to simulate req/res
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

async function runTests() {
  console.log("================================================================================");
  console.log("ORDER COMPLETION FLOW VERIFICATION");
  console.log("================================================================================\n");

  // 1. Test generateUniqueOrderId uniqueness across 10,000 samples
  console.log("1. Testing generateUniqueOrderId uniqueness (10,000 iterations)...");
  const seenIds = new Set<string>();
  for (let i = 0; i < 10000; i++) {
    const id = generateUniqueOrderId();
    if (seenIds.has(id)) {
      throw new Error(`Collision detected on iteration ${i}: ${id}`);
    }
    if (!id.startsWith("SHK") || id.length < 10) {
      throw new Error(`Invalid format for generated ID: ${id}`);
    }
    seenIds.add(id);
  }
  console.log("   ✅ 10,000 generated Order IDs are all unique and follow SHK prefix format.\n");

  // 2. Test getOrGenerateSequentialOrderId resolution
  console.log("2. Testing getOrGenerateSequentialOrderId with client-provided ID...");
  const customClientId = generateUniqueOrderId();
  const resolvedId = await getOrGenerateSequentialOrderId(adminClient, undefined, customClientId);
  if (resolvedId !== customClientId) {
    throw new Error(`Expected client ID "${customClientId}", got "${resolvedId}"`);
  }
  console.log(`   ✅ Successfully preserved client-provided unique ID: ${resolvedId}\n`);

  console.log("3. Testing getOrGenerateSequentialOrderId server-side fallback (no client ID)...");
  const fallbackId = await getOrGenerateSequentialOrderId(adminClient, undefined, undefined);
  if (!fallbackId.startsWith("SHK") || fallbackId.length < 10) {
    throw new Error(`Invalid fallback ID format: ${fallbackId}`);
  }
  console.log(`   ✅ Successfully generated server fallback unique ID: ${fallbackId}\n`);

  // 4. Test end-to-end /api/process-payment order persistence & ID flow
  console.log("4. Testing /api/process-payment order creation and persistence...");
  const testOrderId = generateUniqueOrderId();
  const testPaymentId = `pay_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const orderPayload = {
    orderId: testOrderId,
    fullName: "Order Flow Test User",
    mobile: "9876543210",
    email: "test_flow@shreeharikeerai.com",
    address: "123 Test Street, Coimbatore",
    city: "Coimbatore",
    state: "Tamil Nadu",
    pincode: "641001",
    items: [
      {
        id: "test-item-1",
        name: "Test Keerai Pack",
        price: 50,
        quantity: 2,
        unit: "1 Bunch",
      },
    ],
    subtotal: 100,
    deliveryCharge: 30,
    discount: 0,
    total: 130,
    paymentStatus: `Paid (Test) · ${testPaymentId}`,
    paymentId: testPaymentId,
  };

  const { req, res, getResult } = mockReqRes("POST", orderPayload);
  await processPaymentHandler(req, res);
  const result = getResult();

  console.log("   Response status:", result.status);
  console.log("   Response data:", result.data);

  if (result.status !== 200 || !result.data?.success) {
    throw new Error(`Order processing failed: ${JSON.stringify(result.data)}`);
  }

  const returnedOrderId = result.data.orderId;
  if (returnedOrderId !== testOrderId) {
    throw new Error(`Expected order ID "${testOrderId}", got "${returnedOrderId}"`);
  }

  // Verify in Supabase database
  const { data: dbOrder, error: dbErr } = await adminClient
    .from("orders")
    .select("*")
    .eq("id", testOrderId)
    .single();

  if (dbErr || !dbOrder) {
    throw new Error(`Failed to fetch order from Supabase: ${dbErr?.message}`);
  }

  console.log(`   ✅ Order verified in Supabase: id=${dbOrder.id}, total=₹${dbOrder.total}, payment_id=${dbOrder.razorpay_payment_id}\n`);

  // 5. Test idempotency with existing payment ID
  console.log("5. Testing payment ID idempotency on repeat calls...");
  const secondAttemptId = generateUniqueOrderId();
  const repeatPayload = {
    ...orderPayload,
    orderId: secondAttemptId,
  };

  const { req: r2, res: s2, getResult: gr2 } = mockReqRes("POST", repeatPayload);
  await processPaymentHandler(r2, s2);
  const repeatResult = gr2();

  console.log("   Repeat response status:", repeatResult.status);
  console.log("   Repeat response data:", repeatResult.data);

  if (repeatResult.status !== 200 || !repeatResult.data?.success) {
    throw new Error(`Repeat order processing failed: ${JSON.stringify(repeatResult.data)}`);
  }

  // It should return the original order's ID because the payment ID was already used
  if (repeatResult.data.orderId !== testOrderId) {
    throw new Error(`Expected idempotent reuse of order ID "${testOrderId}", got "${repeatResult.data.orderId}"`);
  }
  console.log(`   ✅ Idempotency confirmed: repeat payment reused original order ID ${testOrderId}\n`);

  // Clean up test order
  console.log("6. Cleaning up test order from DB...");
  await adminClient.from("orders").delete().eq("id", testOrderId);
  console.log("   ✅ Cleaned up test order.\n");

  console.log("================================================================================");
  console.log("ALL TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
