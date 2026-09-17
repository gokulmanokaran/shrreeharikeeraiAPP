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
  const { data, error } = await supabase.rpc("get_schema_columns", {});
  if (error) {
    // Check via a query or examine a row
    const { data: row } = await supabase.from("products").select("variants").limit(1);
    console.log("variants row:", row, typeof row?.[0]?.variants);
  } else {
    console.log("Columns:", data);
  }
}

main().catch(console.error);
