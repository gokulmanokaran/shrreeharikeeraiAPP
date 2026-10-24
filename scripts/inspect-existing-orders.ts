import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const supabase = createClient(url, serviceKey!, { auth: { persistSession: false } });

async function inspect() {
  const { data: orders, error } = await supabase.from("orders").select("id, full_name, email, mobile, total, payment_status, lat, lng, maps_link, address, sheets_synced, email_sent, last_error, last_attempt_at, retry_count, source, created_at").order("created_at", { ascending: false }).limit(10);
  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }
  console.log(`Top ${orders?.length} most recent orders in DB:`);
  orders?.forEach((o, i) => {
    console.log(`\n[#${i + 1}] ID: ${o.id} | Created: ${o.created_at}`);
    console.log(`     Customer: ${o.full_name} (${o.email}) | Mobile: ${o.mobile}`);
    console.log(`     Total: ₹${o.total} | Status: ${o.payment_status} | Source: ${o.source}`);
    console.log(`     Address: ${o.address}`);
    console.log(`     Lat: ${o.lat} | Lng: ${o.lng} | Maps Link: ${o.maps_link}`);
    console.log(`     Sheets Synced: ${o.sheets_synced} | Email Sent: ${o.email_sent} | Retries: ${o.retry_count}`);
  });
}

inspect();
