import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const supabase = createClient(url, serviceKey!, { auth: { persistSession: false } });

async function checkSchema() {
  const { data, error } = await supabase.from("orders").select("*").limit(0);
  console.log("Orders columns query error:", error);
  // Insert a dummy order and see returned columns, then delete it
  const dummyId = `test_schema_${Date.now()}`;
  const { data: insData, error: insErr } = await supabase.from("orders").insert({
    id: dummyId,
    full_name: "Schema Test",
    mobile: "9999999999",
    email: "test@example.com",
    total: 100
  }).select("*").single();

  if (insErr) {
    console.log("Insert error:", insErr);
  } else {
    console.log("Orders columns:", Object.keys(insData));
    await supabase.from("orders").delete().eq("id", dummyId);
  }
}

checkSchema().catch(console.error);
