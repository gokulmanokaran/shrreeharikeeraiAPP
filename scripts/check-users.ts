import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const supabase = createClient(url, serviceKey!, { auth: { persistSession: false } });

async function check() {
  const { data: { user } } = await supabase.auth.admin.getUserById("a060a8a4-5236-4242-a198-1fd18b8f0e04");
  console.log("Email:", user?.email);
  console.log("User Metadata:", JSON.stringify(user?.user_metadata, null, 2));
}

check();
