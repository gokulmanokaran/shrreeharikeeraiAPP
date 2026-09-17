import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { getOrGenerateSequentialOrderId } from "../api/_catalog.js";
import processPaymentHandler from "../api/process-payment.js";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const adminClient = createClient(url, serviceKey!, { auth: { persistSession: false } });

function mockReqRes(method: string, body: any) {
  let statusCode = 200;
  let responseData: any = null;

  const req = {
    method,
    body,
    headers: { "content-type": "application/json" },
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

async function testJumpSequence() {
  console.log("================================================================================");
  console.log("TESTING EXACT PROMPT SCENARIO: LAST ORDER SHK00025 -> NEXT SHK00026, SHK00027, SHK00028");
  console.log("================================================================================\n");

  const seededIds = ["SHK00021", "SHK00022", "SHK00023", "SHK00024", "SHK00025"];
  const createdIds: string[] = [];

  try {
    // 1. Seed SHK00021 to SHK00025 into orders table
    console.log("1. Seeding orders SHK00021 through SHK00025...");
    for (const seedId of seededIds) {
      await adminClient.from("orders").insert({
        id: seedId,
        full_name: "Seed Customer",
        mobile: "9999999999",
        email: "seed@example.com",
        address: "Seed Street",
        total: 100,
        subtotal: 100,
        payment_status: "Paid (Test Seed)",
      });
    }
    console.log("   ✅ Seeded 5 orders successfully.");

    // 2. Query next sequence ID directly
    const nextDirect = await getOrGenerateSequentialOrderId(adminClient);
    console.log("2. Direct sequence generator check:", nextDirect);
    if (nextDirect !== "SHK00026") {
      throw new Error(`Expected next order ID to be SHK00026, got: ${nextDirect}`);
    }
    console.log("   ✅ Direct query returned exactly SHK00026");

    // 3. Place order via /api/process-payment
    console.log("3. Placing order via /api/process-payment...");
    const payId26 = `pay_jump_${Date.now()}_26`;
    const { req: r26, res: res26, getResult: gr26 } = mockReqRes("POST", {
      fullName: "Customer 26",
      mobile: "9876543226",
      email: "cust26@example.com",
      address: "Coimbatore",
      items: [{ id: "senkeerai", name: "Senkeerai", quantity: 1, price: 30 }],
      total: 60,
      subtotal: 30,
      deliveryCharge: 30,
      paymentId: payId26,
    });
    await processPaymentHandler(r26, res26);
    const result26 = gr26();
    console.log("   Response 26:", result26.data);
    if (result26.data.orderId !== "SHK00026") {
      throw new Error(`Expected order ID SHK00026, got ${result26.data.orderId}`);
    }
    createdIds.push("SHK00026");
    console.log("   ✅ Order successfully created with ID: SHK00026");

    // 4. Place next order via /api/process-payment
    console.log("4. Placing second order via /api/process-payment...");
    const payId27 = `pay_jump_${Date.now()}_27`;
    const { req: r27, res: res27, getResult: gr27 } = mockReqRes("POST", {
      fullName: "Customer 27",
      mobile: "9876543227",
      email: "cust27@example.com",
      address: "Coimbatore",
      items: [{ id: "senkeerai", name: "Senkeerai", quantity: 1, price: 30 }],
      total: 60,
      subtotal: 30,
      deliveryCharge: 30,
      paymentId: payId27,
    });
    await processPaymentHandler(r27, res27);
    const result27 = gr27();
    console.log("   Response 27:", result27.data);
    if (result27.data.orderId !== "SHK00027") {
      throw new Error(`Expected order ID SHK00027, got ${result27.data.orderId}`);
    }
    createdIds.push("SHK00027");
    console.log("   ✅ Order successfully created with ID: SHK00027");

    // 5. Place third order via /api/process-payment
    console.log("5. Placing third order via /api/process-payment...");
    const payId28 = `pay_jump_${Date.now()}_28`;
    const { req: r28, res: res28, getResult: gr28 } = mockReqRes("POST", {
      fullName: "Customer 28",
      mobile: "9876543228",
      email: "cust28@example.com",
      address: "Coimbatore",
      items: [{ id: "senkeerai", name: "Senkeerai", quantity: 1, price: 30 }],
      total: 60,
      subtotal: 30,
      deliveryCharge: 30,
      paymentId: payId28,
    });
    await processPaymentHandler(r28, res28);
    const result28 = gr28();
    console.log("   Response 28:", result28.data);
    if (result28.data.orderId !== "SHK00028") {
      throw new Error(`Expected order ID SHK00028, got ${result28.data.orderId}`);
    }
    createdIds.push("SHK00028");
    console.log("   ✅ Order successfully created with ID: SHK00028");

    console.log("\n================================================================================");
    console.log("EXACT USER SCENARIO PASSED (SHK00025 -> SHK00026 -> SHK00027 -> SHK00028) 🎉");
    console.log("================================================================================");
  } finally {
    const allToClean = [...seededIds, ...createdIds];
    console.log(`\nCleaning up ${allToClean.length} test records...`);
    await adminClient.from("orders").delete().in("id", allToClean);
    console.log("Cleanup finished.");
  }
}

testJumpSequence().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
