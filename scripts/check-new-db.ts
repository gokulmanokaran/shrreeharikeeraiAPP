import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Read .env directly
const envFile = fs.readFileSync(".env", "utf8");
const envVars: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let v = match[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    envVars[match[1]] = v;
  }
}

const url = envVars.SUPABASE_URL || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

console.log("Connecting to Supabase:", url);
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function main() {
  const checks = ["categories", "products", "orders", "profiles"];
  for (const table of checks) {
    const { data, error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: false })
      .limit(3);

    if (error) {
      console.log(`Table [${table}]: ERROR ->`, error.message);
    } else {
      console.log(`Table [${table}]: OK -> records in DB: ${data.length} (total count: ${count})`);
      if (data.length > 0) {
        console.log(`Sample item in ${table}:`, Object.keys(data[0]));
      }
    }
  }

  // Check RPC
  const { data: rpcData, error: rpcErr } = await supabase.rpc("deduct_product_stock", {
    p_items: [],
  });
  console.log("RPC deduct_product_stock:", { data: rpcData, error: rpcErr?.message });
}

main().catch(console.error);
