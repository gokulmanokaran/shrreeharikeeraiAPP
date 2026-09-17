import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const webhookUrl = envFile.match(/^VITE_ORDER_WEBHOOK_URL=(.*)$/m)?.[1]?.trim();
console.log("Testing GAS URL:", webhookUrl);

async function testGas() {
  const payload = {
    orderId: "TEST-DIAG-" + Date.now(),
    fullName: "Test Customer Diagnosis",
    mobile: "9790209685",
    email: "shreeharikeerai1@gmail.com",
    address: "123 Test Green Garden, Coimbatore",
    city: "Coimbatore",
    state: "Tamil Nadu",
    pincode: "641014",
    items: [{ name: "Arai Keerai", quantity: 2, price: 50, unit: "1 Bunch" }],
    subtotal: 100,
    deliveryCharge: 30,
    discount: 0,
    total: 130,
    paymentStatus: "Paid (Test)",
    paymentId: "pay_test_diag" + Date.now(),
    source: "diagnosis-script"
  };

  const start = Date.now();
  try {
    const res = await fetch(webhookUrl!, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });
    const text = await res.text();
    console.log("Response status:", res.status, "Time taken:", (Date.now() - start) + "ms");
    console.log("Response body:", text);
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

testGas();
