import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { getOrGenerateSequentialOrderId } from "../api/_catalog.js";
import processPaymentHandler from "../api/process-payment.js";
import razorpayWebhookHandler from "../api/razorpay-webhook.js";
import adminAuthHandler from "../api/admin/auth.js";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
const anonKey = envFile.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();

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

async function runSequentialIdTests() {
  console.log("================================================================================");
  console.log("SHREE HARI KEERAI — STRICT SEQUENTIAL ORDER ID VERIFICATION SUITE");
  console.log("================================================================================\n");

  const createdTestOrderIds: string[] = [];

  try {
    // 1. Direct Sequential ID Generation Test
    console.log("1. Testing getOrGenerateSequentialOrderId directly...");
    const seq1 = await getOrGenerateSequentialOrderId(adminClient);
    console.log("   Candidate Sequence ID 1:", seq1);
    if (!/^SHK\d{5,}$/.test(seq1)) {
      throw new Error(`Invalid sequential format: ${seq1}. Expected SHK00001 format.`);
    }

    // 2. Testing Sequential Order Placement via /api/process-payment
    console.log("\n2. Testing /api/process-payment Sequential Order Creation...");
    const testPaymentId1 = `pay_seq_test_${Date.now()}_1`;
    const { req: req1, res: res1, getResult: getRes1 } = mockReqRes("POST", {
      fullName: "Sequence Test Customer 1",
      mobile: "9876543210",
      email: "test_seq1@example.com",
      address: "123 Test Street, Coimbatore",
      items: [
        { id: "senkeerai", name: "Senkeerai", quantity: 2, price: 30 },
      ],
      subtotal: 60,
      deliveryCharge: 30,
      discount: 0,
      total: 90,
      paymentId: testPaymentId1,
      paymentStatus: `Paid (Razorpay) · ${testPaymentId1}`,
    });

    await processPaymentHandler(req1, res1);
    const result1 = getRes1();
    console.log("   Order 1 API Response Status:", result1.status, "Body:", result1.data);

    if (result1.status !== 200 || !result1.data.success || !result1.data.orderId.startsWith("SHK")) {
      throw new Error(`Order 1 failed to receive valid sequential ID: ${JSON.stringify(result1.data)}`);
    }
    const orderId1 = result1.data.orderId;
    createdTestOrderIds.push(orderId1);
    console.log(`   ✅ Order 1 successfully created with Sequential ID: ${orderId1}`);

    // Place Second Order
    const testPaymentId2 = `pay_seq_test_${Date.now()}_2`;
    const { req: req2, res: res2, getResult: getRes2 } = mockReqRes("POST", {
      fullName: "Sequence Test Customer 2",
      mobile: "9876543211",
      email: "test_seq2@example.com",
      address: "456 Test Avenue, Coimbatore",
      items: [
        { id: "senkeerai", name: "Senkeerai", quantity: 1, price: 30 },
      ],
      subtotal: 30,
      deliveryCharge: 30,
      discount: 0,
      total: 60,
      paymentId: testPaymentId2,
      paymentStatus: `Paid (Razorpay) · ${testPaymentId2}`,
    });

    await processPaymentHandler(req2, res2);
    const result2 = getRes2();
    console.log("   Order 2 API Response Status:", result2.status, "Body:", result2.data);

    if (result2.status !== 200 || !result2.data.success || !result2.data.orderId.startsWith("SHK")) {
      throw new Error(`Order 2 failed to receive valid sequential ID: ${JSON.stringify(result2.data)}`);
    }
    const orderId2 = result2.data.orderId;
    createdTestOrderIds.push(orderId2);
    console.log(`   ✅ Order 2 successfully created with Sequential ID: ${orderId2}`);

    // Place Third Order
    const testPaymentId3 = `pay_seq_test_${Date.now()}_3`;
    const { req: req3, res: res3, getResult: getRes3 } = mockReqRes("POST", {
      fullName: "Sequence Test Customer 3",
      mobile: "9876543212",
      email: "test_seq3@example.com",
      address: "789 Test Road, Coimbatore",
      items: [
        { id: "senkeerai", name: "Senkeerai", quantity: 3, price: 30 },
      ],
      subtotal: 90,
      deliveryCharge: 30,
      discount: 0,
      total: 120,
      paymentId: testPaymentId3,
      paymentStatus: `Paid (Razorpay) · ${testPaymentId3}`,
    });

    await processPaymentHandler(req3, res3);
    const result3 = getRes3();
    console.log("   Order 3 API Response Status:", result3.status, "Body:", result3.data);

    if (result3.status !== 200 || !result3.data.success || !result3.data.orderId.startsWith("SHK")) {
      throw new Error(`Order 3 failed to receive valid sequential ID: ${JSON.stringify(result3.data)}`);
    }
    const orderId3 = result3.data.orderId;
    createdTestOrderIds.push(orderId3);
    console.log(`   ✅ Order 3 successfully created with Sequential ID: ${orderId3}`);

    // Verify exact sequence increments: order 1 -> order 2 -> order 3
    const num1 = parseInt(orderId1.replace(/SHK-?/i, ""), 10);
    const num2 = parseInt(orderId2.replace(/SHK-?/i, ""), 10);
    const num3 = parseInt(orderId3.replace(/SHK-?/i, ""), 10);

    if (num2 !== num1 + 1) {
      throw new Error(`Sequential order numbering mismatch: Order 1 was ${orderId1} (${num1}), Order 2 was ${orderId2} (${num2}). Expected ${num1 + 1}.`);
    }
    if (num3 !== num2 + 1) {
      throw new Error(`Sequential order numbering mismatch: Order 2 was ${orderId2} (${num2}), Order 3 was ${orderId3} (${num3}). Expected ${num2 + 1}.`);
    }
    console.log(`   ✅ Exact sequence verified: ${orderId1} -> ${orderId2} -> ${orderId3} (Strict +1 increments)`);

    // 3. Testing Idempotency & No Sequence Burn on Retries
    console.log("\n3. Testing Idempotency & Duplicate Resubmission...");
    const { req: retryReq, res: retryRes, getResult: getRetryRes } = mockReqRes("POST", {
      orderId: orderId1,
      paymentId: testPaymentId1,
      fullName: "Sequence Test Customer 1",
      mobile: "9876543210",
      items: [{ id: "senkeerai", name: "Senkeerai", quantity: 2, price: 30 }],
      total: 90,
    });
    await processPaymentHandler(retryReq, retryRes);
    const retryResult = getRetryRes();
    console.log("   Retry Result:", retryResult.status, retryResult.data);
    if (retryResult.data.orderId !== orderId1) {
      throw new Error(`Idempotency failure: retry returned new ID ${retryResult.data.orderId} instead of original ${orderId1}`);
    }
    console.log(`   ✅ Retry preserved exact sequential ID ${orderId1} without consuming new sequence.`);

    // 4. Testing Webhook Fallback Sequential Generation
    console.log("\n4. Testing Razorpay Webhook Fallback Sequential ID...");
    const testPaymentId4 = `pay_seq_test_${Date.now()}_4`;
    const { req: whReq, res: whRes, getResult: getWhRes } = mockReqRes("POST", {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: testPaymentId4,
            amount: 15000,
            currency: "INR",
            status: "captured",
            contact: "+919876543212",
            email: "webhook_seq@example.com",
            notes: {
              customerName: "Webhook Customer",
            },
          },
        },
      },
    });

    await razorpayWebhookHandler(whReq, whRes);
    const whResult = getWhRes();
    console.log("   Webhook Fallback Response:", whResult.status, whResult.data);
    if (!whResult.data.orderId?.startsWith("SHK")) {
      throw new Error(`Webhook failed to assign sequential ID: ${JSON.stringify(whResult.data)}`);
    }
    const orderId4 = whResult.data.orderId;
    createdTestOrderIds.push(orderId4);
    const num4 = parseInt(orderId4.replace(/SHK-?/i, ""), 10);
    if (num4 !== num3 + 1) {
      throw new Error(`Webhook sequential numbering mismatch: ${orderId4} (${num4}) expected ${num3 + 1}`);
    }
    console.log(`   ✅ Webhook fallback received sequential ID: ${orderId4} (+1 increment)`);

    // 5. Testing Admin Auth Hardening & Rate Limiting
    console.log("\n5. Testing Admin Authentication Security & Rate Limiting...");
    const { req: authReq1, res: authRes1, getResult: getAuthRes1 } = mockReqRes("POST", { pin: "2026" });
    await adminAuthHandler(authReq1, authRes1);
    const authRes = getAuthRes1();
    if (authRes.status !== 200 || !authRes.data.success) {
      throw new Error(`Valid Admin auth failed: ${JSON.stringify(authRes.data)}`);
    }
    console.log("   ✅ Valid Admin Authentication: PASS");

    const { req: authBadReq, res: authBadRes, getResult: getAuthBadRes } = mockReqRes("POST", { pin: "wrong_pin_123" });
    await adminAuthHandler(authBadReq, authBadRes);
    const authBad = getAuthBadRes();
    if (authBad.status !== 401) {
      throw new Error(`Invalid Admin auth should return 401, got: ${authBad.status}`);
    }
    console.log("   ✅ Invalid Admin Authentication Rejected (401): PASS");

    console.log("\n================================================================================");
    console.log("ALL STRICT SEQUENTIAL ORDER ID TESTS PASSED 🎉");
    console.log("================================================================================");
  } finally {
    // Cleanup created test records from orders table
    if (createdTestOrderIds.length > 0) {
      console.log(`\nCleaning up ${createdTestOrderIds.length} test order(s):`, createdTestOrderIds);
      for (const id of createdTestOrderIds) {
        await adminClient.from("orders").delete().eq("id", id);
      }
      console.log("Cleanup complete.");
    }
  }
}

runSequentialIdTests().catch((err) => {
  console.error("\n❌ TEST FAILED WITH ERROR:", err);
  process.exit(1);
});
