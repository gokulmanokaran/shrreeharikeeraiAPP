import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

const supabase = createClient(url, serviceKey!, { auth: { persistSession: false } });

async function inspect() {
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  console.log("Users count in Project 2:", users?.users?.length || 0);
  users?.users?.forEach((u) => {
    console.log(`- ID: ${u.id}, Email: ${u.email}, Phone: ${u.phone || u.user_metadata?.mobile}`);
  });

  const { data: orders, error: ordErr } = await supabase.from("orders").select("*").limit(5);
  console.log("Orders count:", orders?.length || 0);

  const { data: profiles, error: profErr } = await supabase.from("profiles").select("*").limit(5);
  console.log("Profiles count:", profiles?.length || 0);
}

inspect().catch(console.error);
