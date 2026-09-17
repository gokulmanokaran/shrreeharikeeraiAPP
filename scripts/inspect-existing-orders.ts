import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const supabase = createClient(url, serviceKey!, { auth: { persistSession: false } });

async function inspect() {
  await supabase.from("orders").delete().like("id", "ORD-%");
  const { data: orders, error } = await supabase.from("orders").select("id, full_name, total, created_at, payment_status").order("created_at", { ascending: true });
  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }
  console.log(`Found ${orders?.length} existing orders in database:`);
  orders?.forEach((o, i) => {
    console.log(`[${i + 1}] ID: ${o.id} | Name: ${o.full_name} | Total: ₹${o.total} | Status: ${o.payment_status} | Created: ${o.created_at}`);
  });
}

inspect();
