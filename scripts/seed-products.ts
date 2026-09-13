import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { PRODUCTS } from "../src/data/products";

const envFile = fs.readFileSync(".env", "utf8");
const url = envFile.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim() || "https://wmzevbfhziroffoyxkxf.supabase.co";
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();

if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function seed() {
  console.log("Seeding products to:", url);

  // 1. Verify categories in DB
  const { data: categories, error: catErr } = await supabase.from("categories").select("id");
  if (catErr) {
    console.error("Failed to query categories:", catErr.message);
    return;
  }
  const catSet = new Set(categories.map((c) => c.id));
  console.log("Categories in DB:", Array.from(catSet));

  // 2. Prepare product rows
  const rows = PRODUCTS.map((p, idx) => {
    let cat = p.category;
    if (!catSet.has(cat)) {
      console.warn(`Warning: product ${p.id} has unknown category '${cat}', falling back to 'keerai'`);
      cat = "keerai";
    }

    return {
      id: p.id,
      name: p.name,
      name_tamil: p.nameTamil || p.tamilName || "",
      tamil_name: p.tamilName || p.nameTamil || "",
      price: p.price,
      mrp: p.mrp || p.price,
      unit: p.unit || "1 Pack",
      quantity: p.quantity || p.unit || "1 Pack",
      category: cat,
      secondary_category: p.secondaryCategory || "",
      image: p.image || "",
      image_url: p.image || "",
      description: p.description || "",
      short_description: p.shortDescription || "",
      note: p.note || "",
      in_stock: p.inStock !== false,
      stock_quantity: p.stockQuantity ?? null,
      featured: Boolean(p.featured),
      active: p.active !== false,
      sort_order: p.sortOrder !== undefined ? p.sortOrder : idx,
      variant_type: p.variantType || null,
      variants: p.variants && p.variants.length > 0 ? p.variants : [],
    };
  });

  console.log(`Upserting ${rows.length} catalog products...`);

  // Upsert in batches of 25
  const batchSize = 25;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error: upsertErr } = await supabase.from("products").upsert(batch, { onConflict: "id" });
    if (upsertErr) {
      console.error(`Error upserting batch ${i}-${i + batch.length}:`, upsertErr.message);
    } else {
      console.log(`Upserted batch ${i + 1} to ${Math.min(i + batchSize, rows.length)}`);
    }
  }

  // Verify total products in DB
  const { count, error: countErr } = await supabase.from("products").select("*", { count: "exact", head: true });
  if (countErr) {
    console.error("Error counting products:", countErr.message);
  } else {
    console.log(`✅ Seeding Complete! Total products now in Supabase: ${count}`);
  }
}

seed().catch(console.error);
