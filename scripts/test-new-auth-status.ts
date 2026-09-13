import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
const anonKey = envFile.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();

console.log("Checking NEW Application Supabase Connection...");
console.log("URL:", url);

const adminSupabase = createClient(url, serviceKey!, { auth: { persistSession: false } });
const publicSupabase = createClient(url, anonKey!, { auth: { persistSession: false } });

async function checkAuthAndTables() {
  // 1. Check Auth Users in Project 2
  const { data: usersData, error: userErr } = await adminSupabase.auth.admin.listUsers();
  if (userErr) {
    console.log("❌ Auth Admin listUsers error:", userErr.message);
  } else {
    console.log(`✅ Auth service connected to Project 2! Found ${usersData.users.length} registered users in Project 2.`);
    usersData.users.forEach((u) => {
      console.log(`   - User: ${u.email} | Confirmed: ${Boolean(u.email_confirmed_at)} | Created: ${u.created_at}`);
    });
  }

  // 2. Check Tables status
  const tables = ["categories", "products", "orders", "profiles"];
  for (const t of tables) {
    const { data, error } = await adminSupabase.from(t).select("*").limit(2);
    if (error) {
      console.log(`ℹ Table [${t}]: ${error.message}`);
    } else {
      console.log(`✅ Table [${t}]: Exists and accessible (${data.length} sample rows).`);
    }
  }
}

checkAuthAndTables().catch(console.error);
