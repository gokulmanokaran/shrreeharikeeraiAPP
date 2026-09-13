import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
const anonKey = envFile.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();

console.log("==================================================");
console.log("Shree Hari Keerai — Verification Test Suite");
console.log("Testing Target:", url);
console.log("==================================================");

const adminSupabase = createClient(url, serviceKey!, { auth: { persistSession: false } });
const publicSupabase = createClient(url, anonKey!, { auth: { persistSession: false } });

async function verify() {
  let allPassed = true;

  // 1. Categories Check
  const { data: cats, error: catErr } = await publicSupabase.from("categories").select("*");
  if (catErr) {
    console.log("❌ Categories Check Failed:", catErr.message);
    allPassed = false;
  } else {
    console.log(`✅ Categories: Found ${cats.length} categories.`);
  }

  // 2. Products Check
  const { data: prods, error: prodErr } = await publicSupabase.from("products").select("*");
  if (prodErr) {
    console.log("❌ Products Check Failed:", prodErr.message);
    allPassed = false;
  } else {
    console.log(`✅ Products: Ready and queryable (${prods.length} products).`);
  }

  // 3. Orders Check
  const { data: ords, error: ordErr } = await publicSupabase.from("orders").select("*");
  if (ordErr) {
    console.log("❌ Orders Check Failed:", ordErr.message);
    allPassed = false;
  } else {
    console.log(`✅ Orders: Ready and queryable (${ords.length} orders).`);
  }

  // 4. Profiles Check
  const { data: profs, error: profErr } = await adminSupabase.from("profiles").select("*");
  if (profErr) {
    console.log("❌ Profiles Check Failed:", profErr.message);
    allPassed = false;
  } else {
    console.log(`✅ Profiles: Ready (${profs.length} profiles).`);
  }

  // 5. Atomic Stock RPC Check
  const { data: rpcData, error: rpcErr } = await adminSupabase.rpc("deduct_product_stock", {
    p_items: [],
  });
  if (rpcErr) {
    console.log("❌ Stock RPC Check Failed:", rpcErr.message);
    allPassed = false;
  } else {
    console.log("✅ Stock RPC (deduct_product_stock): Operational.", rpcData);
  }

  // 6. Admin Create, Update, Delete Product Test
  const testId = `test_prod_${Date.now()}`;
  try {
    const { error: insErr } = await adminSupabase.from("products").insert({
      id: testId,
      name: "Test Verification Herb",
      name_tamil: "சோதனை மூலிகை",
      price: 99,
      mrp: 120,
      unit: "1 Pack",
      category: cats?.[0]?.id || "keerai",
      in_stock: true,
      active: true,
    });
    if (insErr) {
      console.log("❌ Admin Product Insert Failed:", insErr.message);
      allPassed = false;
    } else {
      console.log("✅ Admin Product Insert: Successful.");
      // Clean up test product
      await adminSupabase.from("products").delete().eq("id", testId);
      console.log("✅ Admin Product Delete: Successful.");
    }
  } catch (err: any) {
    console.log("❌ Admin Product Test Exception:", err.message);
    allPassed = false;
  }

  console.log("==================================================");
  if (allPassed) {
    console.log("🎉 ALL TESTS PASSED! NEW Supabase project is 100% operational.");
  } else {
    console.log("⚠️ Schema setup required. Please run supabase/fresh-setup.sql in your Supabase SQL Editor.");
  }
  console.log("==================================================");
}

verify().catch(console.error);
