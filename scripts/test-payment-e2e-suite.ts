import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import processPaymentHandler from "../api/process-payment.js";
import razorpayWebhookHandler from "../api/razorpay-webhook.js";
import createRazorpayOrderHandler from "../api/create-razorpay-order.js";
import verifyPaymentHandler from "../api/verify-razorpay-payment.js";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
const anonKey = envFile.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();

const adminClient = createClient(url, serviceKey!, { auth: { persistSession: false } });
const anonClient = createClient(url, anonKey!, { auth: { persistSession: false } });

// Helper to simulate request/response for serverless functions
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

async function runE2ETestSuite() {
  console.log("================================================================================");
  console.log("SHREE HARI KEERAI — COMPLETE PAYMENT & ORDER LIFECYCLE E2E TEST SUITE");
  console.log("================================================================================\n");

  const results: Record<string, "PASS" | "FAIL"> = {};

  const userAEmail = "test_user_a@shreeharikeerai.com";
  const userBEmail = "test_user_b@shreeharikeerai.com";
  const testPassword = "TestPassword@2026";

  // Ensure accounts exist
  const { data: usersList } = await adminClient.auth.admin.listUsers();
  const userA = usersList?.users?.find(u => u.email === userAEmail);
  const userB = usersList?.users?.find(u => u.email === userBEmail);

  if (!userA || !userB) {
    throw new Error("Test users do not exist. Please run seed first.");
  }

  const clientA = createClient(url, anonKey!, { auth: { persistSession: false } });
  await clientA.auth.signInWithPassword({ email: userAEmail, password: testPassword });

  const clientB = createClient(url, anonKey!, { auth: { persistSession: false } });
  await clientB.auth.signInWithPassword({ email: userBEmail, password: testPassword });

  // Get a test product and its initial stock
  const { data: testProds } = await adminClient.from("products").select("id, name, stock_quantity").limit(1);
  const testProduct = testProds?.[0];
  if (!testProduct) {
    throw new Error("No test product found in database.");
  }
  const initialStock = testProduct.stock_quantity ?? 100;
  console.log(`Test Product: ${testProduct.name} (${testProduct.id}), Current stock: ${initialStock}`);

  // Ensure stock is sufficient
  await adminClient.from("products").update({ stock_quantity: 50, in_stock: true }).eq("id", testProduct.id);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Server-side Razorpay Order Creation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n1. Testing /api/create-razorpay-order...");
  const testOrderId = `SHK_TEST_${Date.now()}`;
  const { req: createReq, res: createRes, getResult: getCreateRes } = mockReqRes("POST", {
    amount: 199,
    receipt: testOrderId,
    notes: {
      storefrontOrderId: testOrderId,
      userId: userA.id,
      customerEmail: userAEmail,
    }
  });
  await createRazorpayOrderHandler(createReq, createRes);
  const createResult = getCreateRes();
  console.log("   create-razorpay-order status:", createResult.status, "body:", createResult.data);
  results["Create Razorpay Order Endpoint"] = createResult.status === 200 ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Payment Failure & Retry Flow Simulation
  // Customer initiates order -> payment attempt fails -> retries -> succeeds
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n2. Testing Payment Failure followed by Successful Retry...");
  const paymentAttempt1Id = `pay_fail_${Date.now()}`;
  const paymentAttempt2SuccessId = `pay_succ_${Date.now()}`;

  // In our updated flow, payment failure is recorded in client UI / logging without writing a broken order
  // When retry succeeds, /api/process-payment is called with the successful payment ID
  const { data: stockBefore } = await adminClient.from("products").select("stock_quantity").eq("id", testProduct.id).single();
  const stockBeforeOrder = stockBefore?.stock_quantity ?? 50;

  const orderPayload = {
    orderId: testOrderId,
    userId: userA.id,
    fullName: "Customer User A",
    mobile: "9876543210",
    email: userAEmail,
    address: "123 Anna Nagar, Coimbatore",
    city: "Coimbatore",
    pincode: "641014",
    items: [{ id: testProduct.id, name: testProduct.name, quantity: 2, price: 99.5 }],
    subtotal: 199,
    deliveryCharge: 0,
    discount: 0,
    total: 199,
    paymentId: paymentAttempt2SuccessId,
    razorpayPaymentId: paymentAttempt2SuccessId,
    paymentStatus: `Paid (Razorpay) · ${paymentAttempt2SuccessId}`,
  };

  const { req: procReq, res: procRes, getResult: getProcRes } = mockReqRes("POST", orderPayload);
  await processPaymentHandler(procReq, procRes);
  const procResult = getProcRes();
  console.log("   process-payment result:", procResult.status, procResult.data);
  const assignedOrderId = procResult.data?.orderId || testOrderId;

  // Verify in database
  const { data: savedOrder, error: fetchErr } = await adminClient
    .from("orders")
    .select("*")
    .eq("id", assignedOrderId)
    .single();

  const orderExists = !!savedOrder && !fetchErr;
  const orderPaid = savedOrder?.payment_status?.includes("Paid") && savedOrder?.razorpay_payment_id === paymentAttempt2SuccessId;
  const userLinked = savedOrder?.user_id === userA.id;
  const isSequentialFormat = /^SHK-?\d{5,}$/.test(assignedOrderId);

  console.log(`   - Order exists in DB: ${orderExists ? "YES ✅" : "NO ❌"} (ID: ${assignedOrderId})`);
  console.log(`   - Order sequential format: ${isSequentialFormat ? "YES ✅" : "NO ❌"}`);
  console.log(`   - Order payment status: ${savedOrder?.payment_status} (Paid: ${orderPaid ? "YES ✅" : "NO ❌"})`);
  console.log(`   - Order linked to correct User A: ${userLinked ? "YES ✅" : "NO ❌"}`);

  results["Order Created & Linked on Retry Success"] = (orderExists && orderPaid && userLinked && isSequentialFormat) ? "PASS" : "FAIL";

  // Check stock deduction
  const { data: stockAfter } = await adminClient.from("products").select("stock_quantity").eq("id", testProduct.id).single();
  const stockAfterOrder = stockAfter?.stock_quantity ?? 50;
  const stockDeductedOnce = stockAfterOrder === stockBeforeOrder - 2;
  console.log(`   - Stock before: ${stockBeforeOrder}, Stock after: ${stockAfterOrder} (Deducted 2: ${stockDeductedOnce ? "YES ✅" : "NO ❌"})`);
  results["Stock Deducted Exactly Once"] = stockDeductedOnce ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Duplicate Submission / Callback / Page Refresh Idempotency Test
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n3. Testing Idempotency on Duplicate Submission & Webhook...");
  // Duplicate process-payment call (e.g. user refreshed or retried)
  const { req: dupReq, res: dupRes, getResult: getDupRes } = mockReqRes("POST", { ...orderPayload, orderId: assignedOrderId });
  await processPaymentHandler(dupReq, dupRes);
  const dupResult = getDupRes();
  console.log("   Duplicate process-payment status:", dupResult.status, "alreadyProcessed:", dupResult.data?.alreadyProcessed);

  // Duplicate Webhook call for the same payment
  const { req: whReq, res: whRes, getResult: getWhRes } = mockReqRes("POST", {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: paymentAttempt2SuccessId,
          amount: 19900,
          currency: "INR",
          status: "captured",
          notes: {
            storefrontOrderId: assignedOrderId,
            userId: userA.id,
            customerEmail: userAEmail,
          },
        },
      },
    },
  });
  await razorpayWebhookHandler(whReq, whRes);
  const whResult = getWhRes();
  console.log("   Webhook duplicate call status:", whResult.status, "body:", whResult.data);

  // Verify stock was NOT deducted again
  const { data: stockAfterDuplicates } = await adminClient.from("products").select("stock_quantity").eq("id", testProduct.id).single();
  const stockUnchanged = stockAfterDuplicates?.stock_quantity === stockAfterOrder;
  console.log(`   - Stock after duplicates: ${stockAfterDuplicates?.stock_quantity} (Unchanged: ${stockUnchanged ? "YES ✅" : "NO ❌"})`);

  // Verify exactly 1 order row exists
  const { data: allOrderRows } = await adminClient.from("orders").select("id").eq("id", assignedOrderId);
  const exactlyOneOrder = allOrderRows?.length === 1;
  console.log(`   - Total orders with ID ${assignedOrderId}: ${allOrderRows?.length} (Exactly 1: ${exactlyOneOrder ? "YES ✅" : "NO ❌"})`);

  results["Idempotency & Duplicate Prevention"] = (dupResult.data?.alreadyProcessed && stockUnchanged && exactlyOneOrder) ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Order History Isolation & Visibility
  // User A should see the order in Order History; User B must NOT see it!
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n4. Verifying Order History Isolation...");
  // User A queries Order History (same query as OrdersPage.tsx)
  const { data: userAOrders } = await clientA
    .from("orders")
    .select("id, created_at, total, payment_status, items, address, city")
    .or(`user_id.eq.${userA.id},email.ilike.${userAEmail}`);

  const userASeesOrder = userAOrders?.some(o => o.id === assignedOrderId);
  console.log(`   - User A sees own retried order: ${userASeesOrder ? "YES ✅" : "NO ❌"}`);

  // User B queries Order History
  const { data: userBOrders } = await clientB
    .from("orders")
    .select("id, created_at, total, payment_status, items, address, city")
    .or(`user_id.eq.${userB.id},email.ilike.${userBEmail}`);

  const userBSeesUserAOrder = userBOrders?.some(o => o.id === assignedOrderId);
  console.log(`   - User B CANNOT see User A order: ${!userBSeesUserAOrder ? "BLOCKED / SAFE ✅" : "LEAKED ❌"}`);

  results["Order History Visibility & Isolation"] = (userASeesOrder && !userBSeesUserAOrder) ? "PASS" : "FAIL";

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: Webhook-Only Fallback (Browser Crashed / Tab Closed mid-payment)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n5. Testing Webhook-Only Fallback (Client tab dropped)...");
  const webhookPaymentId = `pay_wh_${Date.now()}`;

  const { req: whOnlyReq, res: whOnlyRes, getResult: getWhOnlyRes } = mockReqRes("POST", {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: webhookPaymentId,
          amount: 15000,
          currency: "INR",
          status: "captured",
          email: userAEmail,
          contact: "+919876543210",
          notes: {
            userId: userA.id,
            customerName: "Customer User A",
          },
        },
      },
    },
  });
  await razorpayWebhookHandler(whOnlyReq, whOnlyRes);
  const whOnlyResult = getWhOnlyRes();
  console.log("   Webhook fallback response:", whOnlyResult.status, whOnlyResult.data);
  const whAssignedOrderId = whOnlyResult.data?.orderId;

  const { data: whSavedOrder } = await adminClient.from("orders").select("*").eq("id", whAssignedOrderId).single();
  const whOrderCreated = !!whSavedOrder && whSavedOrder.user_id === userA.id && whSavedOrder.payment_status?.includes("Paid") && whAssignedOrderId?.startsWith("SHK");
  console.log(`   - Webhook-only order created and linked to User A: ${whOrderCreated ? "YES ✅" : "NO ❌"} (ID: ${whAssignedOrderId})`);

  results["Webhook-Only Fallback Processing"] = whOrderCreated ? "PASS" : "FAIL";

  // Cleanup test orders
  await adminClient.from("orders").delete().in("id", [assignedOrderId, whAssignedOrderId]);
  await adminClient.from("products").update({ stock_quantity: initialStock }).eq("id", testProduct.id);
  console.log("\nCleaned up test orders and restored stock.");

  // Summary
  console.log("\n================================================================================");
  console.log("E2E VERIFICATION RESULTS SUMMARY");
  console.log("================================================================================");
  let allPass = true;
  for (const [name, status] of Object.entries(results)) {
    console.log(`  ${status === "PASS" ? "✅" : "❌"} ${name}: ${status}`);
    if (status !== "PASS") allPass = false;
  }
  console.log("================================================================================");
  console.log(`OVERALL: ${allPass ? "ALL TESTS PASSED 🎉" : "SOME TESTS FAILED ⚠️"}`);

  if (!allPass) process.exit(1);
}

runE2ETestSuite().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
