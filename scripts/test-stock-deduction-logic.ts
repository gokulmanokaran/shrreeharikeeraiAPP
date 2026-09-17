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

export async function deductStockForOrder(
  supabaseClient: SupabaseClient,
  items: Array<{ id?: string; productId?: string; name?: string; quantity?: number }>,
  orderId: string
): Promise<Array<{ id: string; name: string; previousStock: number; newStock: number }>> {
  if (!items || !items.length) return [];

  // Group purchased quantities by candidate keys
  const validItems = items
    .filter((it) => it && (it.id || it.productId || it.name))
    .map((it) => ({
      id: String(it.id || "").trim(),
      productId: String(it.productId || "").trim(),
      name: String(it.name || "").trim(),
      quantity: Math.max(1, Number(it.quantity) || 1),
    }));

  if (!validItems.length) return [];

  // 1. Fetch active products to ensure accurate ID resolution for both base products and variants
  const { data: allProducts, error: fetchErr } = await supabaseClient
    .from("products")
    .select("id, name, stock_quantity, in_stock, variants");

  if (fetchErr || !allProducts) {
    console.error(`[Stock Deduction] Failed to fetch products for order ${orderId}:`, fetchErr);
    return [];
  }

  const results: Array<{ id: string; name: string; previousStock: number; newStock: number }> = [];

  // Map each order item to its matching product row in Supabase
  for (const item of validItems) {
    // Match priority:
    // 1. Explicit productId
    // 2. Direct product id match
    // 3. Variant id match inside variants array
    // 4. Prefix match (e.g. variant id "prod_mtkupkpw_1788400752322" starts with product id "prod_mtkupkpw")
    // 5. Name match (case-insensitive)
    const matchedProduct = allProducts.find((p) => {
      if (item.productId && p.id === item.productId) return true;
      if (item.id && p.id === item.id) return true;
      if (item.id && Array.isArray(p.variants) && p.variants.some((v: any) => v && v.id === item.id)) return true;
      if (item.id && item.id.includes("_") && item.id.startsWith(p.id + "_")) return true;
      if (item.name && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()) return true;
      return false;
    });

    if (!matchedProduct) {
      console.warn(`[Stock Deduction] Could not find matching product for item:`, item);
      continue;
    }

    // Only deduct if product has a tracked stock quantity (is not null/undefined)
    if (matchedProduct.stock_quantity !== null && matchedProduct.stock_quantity !== undefined) {
      const currentStock = Number(matchedProduct.stock_quantity);
      if (!isNaN(currentStock)) {
        const newStock = Math.max(0, currentStock - item.quantity);
        const newInStock = newStock > 0;

        // Perform atomic database update
        const { error: updateErr } = await supabaseClient
          .from("products")
          .update({
            stock_quantity: newStock,
            in_stock: newInStock,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchedProduct.id);

        if (updateErr) {
          console.error(`[Stock Deduction] Failed to update stock for ${matchedProduct.id}:`, updateErr);
        } else {
          console.info(
            `[Stock Deduction] ✅ Order ${orderId}: Product "${matchedProduct.name}" (${matchedProduct.id}) stock reduced from ${currentStock} to ${newStock} (-${item.quantity}). In-Stock: ${newInStock}`
          );
          results.push({
            id: matchedProduct.id,
            name: matchedProduct.name,
            previousStock: currentStock,
            newStock,
          });

          // Update in-memory copy in case multiple items in same order reference this product
          matchedProduct.stock_quantity = newStock;
          matchedProduct.in_stock = newInStock;
        }
      }
    } else {
      console.info(`[Stock Deduction] Product "${matchedProduct.name}" (${matchedProduct.id}) has unlimited/untracked stock (stock_quantity is null). Skipping.`);
    }
  }

  return results;
}

async function runTests() {
  console.log("=== Testing Stock Deduction Logic ===");

  // Test 1: Nuts & Seeds Laddu using VARIANT ID
  const testItem1 = {
    id: "prod_mtkupkpw_1788400752322",
    name: "Nuts & Seeds  Laddu",
    quantity: 2,
  };

  const { data: nutsBefore } = await supabase.from("products").select("id, stock_quantity").eq("id", "prod_mtkupkpw").single();
  console.log("Nuts stock BEFORE deduction:", nutsBefore?.stock_quantity);

  const res1 = await deductStockForOrder(supabase, [testItem1], "TEST-001");
  console.log("Deduction result 1:", res1);

  const { data: nutsAfter } = await supabase.from("products").select("id, stock_quantity").eq("id", "prod_mtkupkpw").single();
  console.log("Nuts stock AFTER deduction:", nutsAfter?.stock_quantity);

  // Restore Nuts stock
  if (nutsBefore?.stock_quantity !== undefined) {
    await supabase.from("products").update({ stock_quantity: nutsBefore.stock_quantity, in_stock: true }).eq("id", "prod_mtkupkpw");
    console.log("Restored Nuts stock to:", nutsBefore.stock_quantity);
  }
}

runTests().catch(console.error);
