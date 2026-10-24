import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const supabase = createClient(url, serviceKey!, { auth: { persistSession: false } });

async function check() {
  const { data: order } = await supabase.from("orders").select("*").eq("id", "SHKMVJK8KPQ5Q1T21").single();
  console.log(JSON.stringify(order, null, 2));
}

check();
