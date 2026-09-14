import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
const anonKey = envFile.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();

const adminSupabase = createClient(url, serviceKey!, { auth: { persistSession: false } });

async function runSecurityAudit() {
  console.log("==================================================");
  console.log("SHREE HARI KEERAI — SECURITY & DATA ISOLATION TEST");
  console.log("Target:", url);
  console.log("==================================================");

  const emailA = "test_user_a@shreeharikeerai.com";
  const emailB = "test_user_b@shreeharikeerai.com";
  const password = "TestPassword@2026";

  // 1. Setup/Ensure Test User A
  let userAId: string;
  const { data: usersList } = await adminSupabase.auth.admin.listUsers();
  const existingA = usersList?.users?.find((u) => u.email === emailA);
  if (existingA) {
    userAId = existingA.id;
  } else {
    const { data: newA, error: errA } = await adminSupabase.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Customer User A", mobile: "9876543210" },
    });
    if (errA) throw new Error("Failed to create User A: " + errA.message);
    userAId = newA.user.id;
  }

  // 2. Setup/Ensure Test User B
  let userBId: string;
  const existingB = usersList?.users?.find((u) => u.email === emailB);
  if (existingB) {
    userBId = existingB.id;
  } else {
    const { data: newB, error: errB } = await adminSupabase.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Customer User B", mobile: "9123456780" },
    });
    if (errB) throw new Error("Failed to create User B: " + errB.message);
    userBId = newB.user.id;
  }

  console.log(`User A ID: ${userAId} (${emailA})`);
  console.log(`User B ID: ${userBId} (${emailB})`);

  // 3. Authenticate User A and User B to obtain customer JWT sessions
  const clientA = createClient(url, anonKey!, { auth: { persistSession: false } });
  const { data: authA, error: authAErr } = await clientA.auth.signInWithPassword({ email: emailA, password });
  if (authAErr) throw new Error("Auth A failed: " + authAErr.message);

  const clientB = createClient(url, anonKey!, { auth: { persistSession: false } });
  const { data: authB, error: authBErr } = await clientB.auth.signInWithPassword({ email: emailB, password });
  if (authBErr) throw new Error("Auth B failed: " + authBErr.message);

  console.log("✅ Both User A and User B successfully authenticated.");

  // Test 1: Customer Profile Isolation
  console.log("\n--- TEST 1: Customer Profile Isolation ---");
  // User A reads own profile
  const { data: profAOwn } = await clientA.from("profiles").select("*").eq("id", userAId);
  console.log("User A reads own profile:", profAOwn?.length ? "Found" : "Empty (profile not created yet)");

  // User A attempts to read User B's profile
  const { data: profBOwn } = await clientA.from("profiles").select("*").eq("id", userBId);
  const test1ReadIsolated = !profBOwn || profBOwn.length === 0;
  console.log(`User A read User B's profile: ${test1ReadIsolated ? "DENIED / ISOLATED ✅" : "EXPOSED ❌"}`);

  // User A attempts to modify User B's profile
  const { error: modErr } = await clientA.from("profiles").update({ full_name: "Hacked by A" }).eq("id", userBId);
  const { data: checkB } = await adminSupabase.from("profiles").select("*").eq("id", userBId);
  const test1ModIsolated = checkB?.[0]?.full_name !== "Hacked by A";
  console.log(`User A modify User B's profile: ${test1ModIsolated ? "PREVENTED ✅" : "PERMITTED / VULNERABLE ❌"}`);

  // Test 2: Orders Table RLS & Data Isolation
  console.log("\n--- TEST 2: Orders RLS & Data Isolation ---");
  const orderAId = `ORD_A_${Date.now()}`;
  const orderBId = `ORD_B_${Date.now()}`;

  // Insert Order for User A
  await adminSupabase.from("orders").insert({
    id: orderAId,
    email: emailA,
    mobile: "9876543210",
    full_name: "Customer User A",
    address: "123 Anna Nagar, Coimbatore",
    city: "Coimbatore",
    total: 250,
    items: [{ name: "Ponnangani Keerai", quantity: 2, price: 49 }],
    payment_status: "Paid (Razorpay)",
  });

  // Insert Order for User B
  await adminSupabase.from("orders").insert({
    id: orderBId,
    email: emailB,
    mobile: "9123456780",
    full_name: "Customer User B",
    address: "456 Gandhipuram, Coimbatore",
    city: "Coimbatore",
    total: 450,
    items: [{ name: "Broccoli Microgreens", quantity: 1, price: 89 }],
    payment_status: "Paid (Razorpay)",
  });

  // User A queries all orders without frontend filter: select * from orders
  const { data: userAOrdersUnfiltered } = await clientA.from("orders").select("id, email, full_name, address");
  console.log(`User A unfiltered orders query returned ${userAOrdersUnfiltered?.length || 0} orders.`);
  const userASeesUserB = userAOrdersUnfiltered?.some((o) => o.id === orderBId);
  console.log(`RLS Leak Check: User A sees User B's order: ${userASeesUserB ? "YES (RLS LEAK! ❌)" : "NO (ISOLATED ✅)"}`);

  // User B directly attempts IDOR to read User A's order by ID
  const { data: userBReadsOrderA } = await clientB.from("orders").select("id, email, address, total").eq("id", orderAId);
  const idorAExposed = userBReadsOrderA && userBReadsOrderA.length > 0;
  console.log(`IDOR Check: User B fetches User A's order by ID: ${idorAExposed ? "EXPOSED! (IDOR VULNERABLE ❌)" : "DENIED / ISOLATED ✅"}`);

  // User B attempts to tamper with User A's order
  const { error: tamperErr } = await clientB.from("orders").update({ address: "Tampered Address" }).eq("id", orderAId);
  const { data: checkOrderA } = await adminSupabase.from("orders").select("address").eq("id", orderAId).single();
  const isTampered = checkOrderA?.address === "Tampered Address";
  console.log(`Tamper Check: User B updates User A's order: ${isTampered ? "SUCCESSFUL TAMPER (VULNERABLE ❌)" : "PREVENTED ✅"}`);

  // Clean up test orders
  await adminSupabase.from("orders").delete().in("id", [orderAId, orderBId]);

  console.log("\n==================================================");
  console.log("BASELINE SECURITY AUDIT SUMMARY");
  console.log("Profile Read Isolation:", test1ReadIsolated ? "PASS" : "FAIL");
  console.log("Profile Update Isolation:", test1ModIsolated ? "PASS" : "FAIL");
  console.log("Orders RLS Table Isolation:", !userASeesUserB ? "PASS" : "FAIL");
  console.log("Orders IDOR Direct Fetch:", !idorAExposed ? "PASS" : "FAIL");
  console.log("Orders Tamper Protection:", !isTampered ? "PASS" : "FAIL");
  console.log("==================================================");
}

runSecurityAudit().catch(console.error);
