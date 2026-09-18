import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
const webhookUrl =
  envFile.match(/^GOOGLE_SHEETS_WEBHOOK_URL=(.*)$/m)?.[1]?.trim() ||
  envFile.match(/^VITE_ORDER_WEBHOOK_URL=(.*)$/m)?.[1]?.trim() ||
  "https://script.google.com/macros/s/AKfycbzjXsA4gHp4u30Qx9RhFamyOIrSjqs2yi9K5wAF1YylK8FU9Ushsex8kffAIIRUR3bI/exec";

if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not found in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function syncPendingOrders() {
  console.log("================================================================================");
  console.log("SHREE HARI KEERAI — RECOVER & SYNC PENDING ORDERS TO GOOGLE SHEETS & EMAIL");
  console.log("================================================================================\n");

  const { data: pendingOrders, error } = await supabase
    .from("orders")
    .select("*")
    .or("sheets_synced.eq.false,email_sent.eq.false")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch pending orders:", error);
    return;
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    console.log("✅ No pending orders found. All orders in Supabase are already synced to Sheets and Email!");
    return;
  }

  console.log(`Found ${pendingOrders.length} order(s) pending sync to Sheets/Email:\n`);

  for (const order of pendingOrders) {
    console.log(`Processing Order: ${order.id} | Customer: ${order.full_name} (${order.email || order.mobile}) | Total: ₹${order.total}`);

    const formattedDate = new Date(order.created_at).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const items = Array.isArray(order.items) ? order.items : [];
    const productsSummary =
      items.length > 0
        ? items.map((it: any) => `${it.name}${it.unit ? ` (${it.unit})` : ""} × ${it.quantity || 1}`).join(", ")
        : "Products";

    const totalQuantity = items.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);

    const payload = {
      orderId: order.id,
      userId: order.user_id,
      fullName: order.full_name,
      mobile: order.mobile,
      email: order.email || "",
      address: order.address,
      city: order.city || "Coimbatore",
      state: order.state || "Tamil Nadu",
      pincode: order.pincode,
      lat: order.lat,
      lng: order.lng,
      mapsLink: order.maps_link,
      items: order.items,
      subtotal: order.subtotal,
      deliveryCharge: order.delivery_charge,
      discount: order.discount,
      total: order.total,
      paymentStatus: order.payment_status,
      paymentId: order.razorpay_payment_id || "N/A",
      razorpayPaymentId: order.razorpay_payment_id || "N/A",
      productsSummary,
      totalQuantity,
      formattedDate,
      source: "recovery-sync-worker",
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}

      if (res.ok || res.status === 302 || res.status === 0) {
        const isDuplicate = Boolean(parsed?.duplicate);
        const sheetUpdated = Boolean(parsed?.sheetUpdated) || isDuplicate || parsed?.status === "success";
        const emailSent = Boolean(parsed?.emailSent) || Boolean(parsed?.customerEmailSent) || isDuplicate || parsed?.status === "success";

        await supabase.from("orders").update({
          sheets_synced: sheetUpdated,
          email_sent: emailSent,
          last_error: null,
          last_attempt_at: new Date().toISOString(),
        }).eq("id", order.id);

        console.log(`   ✅ Order ${order.id} Synced! (Sheet: ${sheetUpdated}, Email: ${emailSent})\n`);
      } else {
        console.error(`   ❌ Failed to sync order ${order.id}: HTTP ${res.status}: ${text}\n`);
      }
    } catch (e: any) {
      console.error(`   ❌ Exception syncing order ${order.id}:`, e.message, "\n");
    }
  }

  console.log("All pending orders processed.");
}

syncPendingOrders();
