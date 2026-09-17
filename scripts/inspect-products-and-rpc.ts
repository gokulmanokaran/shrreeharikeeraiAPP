import { createClient } from "@supabase/supabase-js";
import fs from "fs";

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

const supabase = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data: nuts } = await supabase.from("products").select("*").ilike("name", "%Nuts%");
  console.log("Nuts product in DB:", JSON.stringify(nuts, null, 2));

  // Test what happens when deduct_product_stock is called with the order item id:
  const testItemId = "prod_mtkupkpw_1788400752322";
  console.log("\nCalling deduct_product_stock with item id:", testItemId);
  const { data: rpcRes1, error: rpcErr1 } = await supabase.rpc("deduct_product_stock", {
    p_items: [{ id: testItemId, quantity: 1 }],
  });
  console.log("RPC with variant ID result:", { data: rpcRes1, error: rpcErr1 });

  // Test what happens when deduct_product_stock is called with base product ID "prod_mtkupkpw"
  if (nuts && nuts.length > 0) {
    const baseId = nuts[0].id;
    console.log("\nCalling deduct_product_stock with base product ID:", baseId);
    const { data: rpcRes2, error: rpcErr2 } = await supabase.rpc("deduct_product_stock", {
      p_items: [{ id: baseId, quantity: 1 }],
    });
    console.log("RPC with base ID result:", { data: rpcRes2, error: rpcErr2 });
  }
}

main().catch(console.error);
