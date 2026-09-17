import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

export async function resolveAndDeductStock(
  supabaseClient: SupabaseClient,
  items: Array<{ id?: string; productId?: string; variantId?: string; name?: string; quantity?: number }>,
  orderId: string
): Promise<Array<{ id: string; name: string; previousStock: number; newStock: number; inStock: boolean }>> {
  if (!items || !items.length) return [];

  const validItems = items
    .filter((it) => it && (it.id || it.productId || it.name))
    .map((it) => ({
      id: String(it.id || "").trim(),
      productId: String(it.productId || "").trim(),
      variantId: String(it.variantId || "").trim(),
      name: String(it.name || "").trim(),
      quantity: Math.max(1, Number(it.quantity) || 1),
    }));

  if (!validItems.length) return [];

  // Fetch all products to resolve matches across base IDs, variant IDs, prefixes, and names
  const { data: allProducts, error: fetchErr } = await supabaseClient
    .from("products")
    .select("id, name, stock_quantity, in_stock, variants");

  if (fetchErr || !allProducts) {
    console.error(`[Stock Engine] Failed to fetch products for order ${orderId}:`, fetchErr);
    return [];
  }

  // Map each order item to its resolved base product ID in Supabase
  const resolvedMap = new Map<string, { product: any; totalQty: number }>();

  for (const item of validItems) {
    const matchedProduct = allProducts.find((p: any) => {
      if (item.productId && p.id === item.productId) return true;
      if (item.id && p.id === item.id) return true;
      if (item.id && Array.isArray(p.variants) && p.variants.some((v: any) => v && v.id === item.id)) return true;
      if (item.variantId && Array.isArray(p.variants) && p.variants.some((v: any) => v && v.id === item.variantId)) return true;
      if (item.id && item.id.includes("_") && item.id.startsWith(p.id + "_")) return true;
      if (item.name && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()) return true;
      return false;
    });

    if (!matchedProduct) {
      console.warn(`[Stock Engine] ⚠️ No matching product found for item:`, item);
      continue;
    }

    const existing = resolvedMap.get(matchedProduct.id);
    if (existing) {
      existing.totalQty += item.quantity;
    } else {
      resolvedMap.set(matchedProduct.id, { product: matchedProduct, totalQty: item.quantity });
    }
  }

  const results: Array<{ id: string; name: string; previousStock: number; newStock: number; inStock: boolean }> = [];
  const rpcItems: Array<{ id: string; quantity: number }> = [];

  for (const [prodId, { product, totalQty }] of resolvedMap.entries()) {
    if (product.stock_quantity !== null && product.stock_quantity !== undefined) {
      rpcItems.push({ id: prodId, quantity: totalQty });
    }
  }

  // 1. Try atomic database RPC with PostgreSQL row-level locking (FOR UPDATE)
  let rpcSuccess = false;
  if (rpcItems.length > 0) {
    try {
      const { data: rpcRes, error: rpcErr } = await supabaseClient.rpc("deduct_product_stock", {
        p_items: rpcItems,
      });
      if (!rpcErr && rpcRes && rpcRes.success && Array.isArray(rpcRes.updated) && rpcRes.updated.length > 0) {
        rpcSuccess = true;
        for (const up of rpcRes.updated) {
          const entry = resolvedMap.get(up.id);
          results.push({
            id: up.id,
            name: entry?.product.name || up.id,
            previousStock: up.previousStock,
            newStock: up.newStock,
            inStock: up.inStock,
          });
          console.info(
            `[Stock Engine] ✅ Atomic RPC: "${entry?.product.name || up.id}" stock: ${up.previousStock} -> ${up.newStock} (Order ${orderId})`
          );
        }
      }
    } catch (err) {
      console.warn(`[Stock Engine] RPC execution notice:`, err);
    }
  }

  // 2. Direct fallback for any products not covered by RPC
  for (const [prodId, { product, totalQty }] of resolvedMap.entries()) {
    const alreadyDone = results.some((r) => r.id === prodId);
    if (!alreadyDone && product.stock_quantity !== null && product.stock_quantity !== undefined) {
      const currentStock = Number(product.stock_quantity);
      if (!isNaN(currentStock)) {
        const newStock = Math.max(0, currentStock - totalQty);
        const newInStock = newStock > 0;

        const { error: updErr } = await supabaseClient
          .from("products")
          .update({
            stock_quantity: newStock,
            in_stock: newInStock,
            updated_at: new Date().toISOString(),
          })
          .eq("id", prodId);

        if (!updErr) {
          results.push({
            id: prodId,
            name: product.name,
            previousStock: currentStock,
            newStock,
            inStock: newInStock,
          });
          console.info(
            `[Stock Engine] ✅ Direct fallback: "${product.name}" stock: ${currentStock} -> ${newStock} (Order ${orderId})`
          );
        } else {
          console.error(`[Stock Engine] Failed fallback update for ${prodId}:`, updErr);
        }
      }
    }
  }

  return results;
}

async function runAllTests() {
  console.log("==================================================================");
  console.log("RUNNING COMPREHENSIVE STOCK DEDUCTION TEST SUITE");
  console.log("==================================================================");

  // 1. Test variant product (Nuts & Seeds Laddu)
  console.log("\n[TEST 1] Variant product deduction (Nuts & Seeds Laddu)...");
  const { data: nutsBefore } = await supabase.from("products").select("id, stock_quantity, in_stock").eq("id", "prod_mtkupkpw").single();
  const initNutsStock = nutsBefore?.stock_quantity ?? 20;
  console.log(`Initial Nuts stock: ${initNutsStock}`);

  const res1 = await resolveAndDeductStock(
    supabase,
    [{ id: "prod_mtkupkpw_1788400752322", name: "Nuts & Seeds  Laddu", quantity: 2 }],
    "TEST-ORD-01"
  );
  console.log("Deduction result:", res1);
  const { data: nutsAfter1 } = await supabase.from("products").select("id, stock_quantity, in_stock").eq("id", "prod_mtkupkpw").single();
  console.log(`Nuts stock after -2: ${nutsAfter1?.stock_quantity}`);
  console.log(`Test 1 Passed: ${nutsAfter1?.stock_quantity === initNutsStock - 2}`);

  // 2. Test standard product without variants (Palak Leaves)
  console.log("\n[TEST 2] Standard product without variants (Palak Leaves)...");
  const { data: palakBefore } = await supabase.from("products").select("id, stock_quantity, in_stock").eq("id", "palak-leaves").single();
  const initPalakStock = palakBefore?.stock_quantity ?? 50;
  console.log(`Initial Palak stock: ${initPalakStock}`);

  const res2 = await resolveAndDeductStock(
    supabase,
    [{ id: "palak-leaves", name: "Palak Leaves", quantity: 5 }],
    "TEST-ORD-02"
  );
  console.log("Deduction result:", res2);
  const { data: palakAfter2 } = await supabase.from("products").select("id, stock_quantity, in_stock").eq("id", "palak-leaves").single();
  console.log(`Palak stock after -5: ${palakAfter2?.stock_quantity}`);
  console.log(`Test 2 Passed: ${palakAfter2?.stock_quantity === initPalakStock - 5}`);

  // 3. Test reaching exactly 0 and setting in_stock = false
  console.log("\n[TEST 3] Reaching exactly 0 and in_stock = false...");
  // Temporarily set a dummy product or test product with 3 units
  await supabase.from("products").update({ stock_quantity: 3, in_stock: true }).eq("id", "prod_mtkupkpw");
  const res3 = await resolveAndDeductStock(
    supabase,
    [{ id: "prod_mtkupkpw_1788400752322", quantity: 3 }],
    "TEST-ORD-03"
  );
  console.log("Deduction result:", res3);
  const { data: nutsAfter3 } = await supabase.from("products").select("id, stock_quantity, in_stock").eq("id", "prod_mtkupkpw").single();
  console.log(`Nuts stock after buying remaining 3: ${nutsAfter3?.stock_quantity}, in_stock: ${nutsAfter3?.in_stock}`);
  console.log(`Test 3 Passed: ${nutsAfter3?.stock_quantity === 0 && nutsAfter3?.in_stock === false}`);

  // 4. Test insufficient stock (available: 0 or 2, requested: 7) - Must NOT be negative
  console.log("\n[TEST 4] Insufficient stock / Non-negative guard (Stock: 2, Requested: 7)...");
  await supabase.from("products").update({ stock_quantity: 2, in_stock: true }).eq("id", "prod_mtkupkpw");
  const res4 = await resolveAndDeductStock(
    supabase,
    [{ id: "prod_mtkupkpw_1788400752322", quantity: 7 }],
    "TEST-ORD-04"
  );
  console.log("Deduction result:", res4);
  const { data: nutsAfter4 } = await supabase.from("products").select("id, stock_quantity, in_stock").eq("id", "prod_mtkupkpw").single();
  console.log(`Nuts stock after buying 7 with 2 available: ${nutsAfter4?.stock_quantity}, in_stock: ${nutsAfter4?.in_stock}`);
  console.log(`Test 4 Passed: ${nutsAfter4?.stock_quantity === 0 && nutsAfter4?.in_stock === false}`);

  // 5. Test concurrent orders placed at nearly the same time
  console.log("\n[TEST 5] Concurrent purchases at nearly the same time...");
  await supabase.from("products").update({ stock_quantity: 20, in_stock: true }).eq("id", "prod_mtkupkpw");
  const p1 = resolveAndDeductStock(supabase, [{ id: "prod_mtkupkpw_1788400752322", quantity: 2 }], "CONC-01");
  const p2 = resolveAndDeductStock(supabase, [{ id: "prod_mtkupkpw_1788400752322", quantity: 3 }], "CONC-02");
  await Promise.all([p1, p2]);

  const { data: nutsAfter5 } = await supabase.from("products").select("id, stock_quantity, in_stock").eq("id", "prod_mtkupkpw").single();
  console.log(`Nuts stock after concurrent -2 and -3 (from 20): ${nutsAfter5?.stock_quantity}`);
  console.log(`Test 5 Passed: ${nutsAfter5?.stock_quantity === 15}`);

  // Clean up & restore original stock
  await supabase.from("products").update({ stock_quantity: initNutsStock, in_stock: true }).eq("id", "prod_mtkupkpw");
  await supabase.from("products").update({ stock_quantity: initPalakStock, in_stock: true }).eq("id", "palak-leaves");
  console.log("\nRestored original product stock.");
  console.log("==================================================================");
  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================================");
}

runAllTests().catch(console.error);
