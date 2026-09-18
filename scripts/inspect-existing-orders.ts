import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const supabase = createClient(url, serviceKey!, { auth: { persistSession: false } });

async function inspect() {
  const { data: orders, error } = await supabase.from("orders").select("id, full_name, email, mobile, total, payment_status, razorpay_payment_id, razorpay_order_id, razorpay_signature, sheets_synced, email_sent, last_error, last_attempt_at, retry_count, source, created_at").order("created_at", { ascending: false }).limit(10);
  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }
  console.log(`Top ${orders?.length} most recent orders in DB:`);
  orders?.forEach((o, i) => {
    console.log(`\n[#${i + 1}] ID: ${o.id} | Created: ${o.created_at}`);
    console.log(`     Customer: ${o.full_name} (${o.email}) | Mobile: ${o.mobile}`);
    console.log(`     Total: ₹${o.total} | Status: ${o.payment_status} | Source: ${o.source}`);
    console.log(`     Sheets Synced: ${o.sheets_synced} | Email Sent: ${o.email_sent} | Retries: ${o.retry_count}`);
    console.log(`     Last Attempt: ${o.last_attempt_at} | Last Error: ${o.last_error}`);
    console.log(`     PaymentId: ${o.razorpay_payment_id} | RzpOrderId: ${o.razorpay_order_id} | Signature: ${o.razorpay_signature ? "YES" : "NO"}`);
  });
}

inspect();
