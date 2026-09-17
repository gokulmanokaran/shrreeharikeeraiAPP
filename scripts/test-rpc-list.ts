import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const supabase = createClient(url, serviceKey!, { auth: { persistSession: false } });

async function checkRpc() {
  const rpcs = [
    "generate_sequential_order_id",
    "get_next_order_number",
    "deduct_product_stock",
    "exec_sql",
    "exec",
  ];

  for (const r of rpcs) {
    const { data, error } = await supabase.rpc(r as any, {});
    console.log(`RPC [${r}]:`, { data, error: error?.message || error?.code || null });
  }
}

checkRpc();
