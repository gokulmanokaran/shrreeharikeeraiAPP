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
  const testItemId = "prod_mtkupkpw_1788400752322";

  // Check 1: variants JSON contains variant id
  const { data: d1, error: e1 } = await supabase
    .from("products")
    .select("id, name, stock_quantity")
    .contains("variants", [{ id: testItemId }]);
  console.log("Query 1 (contains variants):", { d1, e1 });

  // Check 2: prefix match (id is prefix of testItemId)
  const { data: allProds } = await supabase.from("products").select("id, name, stock_quantity");
  const matchedByPrefix = allProds?.find(p => testItemId.startsWith(p.id));
  console.log("Matched by prefix:", matchedByPrefix);
}

main().catch(console.error);
