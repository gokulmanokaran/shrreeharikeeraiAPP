// Seed script: writes all 82 products + categories to data/catalog.json
// Run with: npx tsx scripts/seed-catalog.ts

import { INITIAL_PRODUCTS, INITIAL_CATEGORIES } from "../api/_catalog";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const dataDir = join(ROOT, "data");
const catalogFile = join(dataDir, "catalog.json");

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Check if existing catalog.json already has the full set
let existingProducts: unknown[] = [];
try {
  const raw = require("fs").readFileSync(catalogFile, "utf-8");
  const existing = JSON.parse(raw);
  existingProducts = Array.isArray(existing.products) ? existing.products : [];
} catch {
  // File doesn't exist or is invalid
}

// Merge: keep existing inStock overrides, but ensure all 82 products are present
const existingMap = new Map(
  existingProducts.map((p: any) => [p.id, p])
);

const mergedProducts = INITIAL_PRODUCTS.map((p) => {
  const existing = existingMap.get(p.id);
  if (existing) {
    // Preserve admin overrides (inStock, price, etc.) but keep all fields
    return { ...p, ...(existing as object) };
  }
  return p;
});

const catalog = {
  products: mergedProducts,
  categories: INITIAL_CATEGORIES,
  updatedAt: new Date().toISOString(),
};

writeFileSync(catalogFile, JSON.stringify(catalog, null, 2), "utf-8");
console.log(`✅ catalog.json seeded with ${mergedProducts.length} products and ${INITIAL_CATEGORIES.length} categories`);
