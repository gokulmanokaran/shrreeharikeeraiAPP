// Quick script to seed data/catalog.json from api/_catalog.ts INITIAL_PRODUCTS
// Run: node scripts/seed-catalog.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Read initialProducts.ts and extract the JSON-serializable data
// We do this by reading api/_catalog.ts which has INITIAL_PRODUCTS
const catalogTs = readFileSync(join(ROOT, "api/_catalog.ts"), "utf-8");

// Extract the INITIAL_PRODUCTS array using a simple approach:
// find the exported const and evaluate it safely
// Instead, we'll parse it by finding the array bounds

function extractInitialProducts(tsContent) {
  const startMarker = "export const INITIAL_PRODUCTS: Product[] = [";
  const startIdx = tsContent.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error("INITIAL_PRODUCTS not found in _catalog.ts");
  }

  // Find the closing ]; at the top level
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let i = startIdx + startMarker.length - 1; // position of '['

  const chars = tsContent.slice(startIdx + startMarker.length - 1);
  let arrayContent = "";

  for (let j = 0; j < chars.length; j++) {
    const ch = chars[j];
    if (inString) {
      arrayContent += ch;
      if (ch === stringChar && chars[j - 1] !== "\\") inString = false;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      arrayContent += ch;
    } else if (ch === "[" || ch === "{") {
      depth++;
      arrayContent += ch;
    } else if (ch === "]" || ch === "}") {
      depth--;
      arrayContent += ch;
      if (depth === 0) break;
    } else {
      arrayContent += ch;
    }
  }

  return arrayContent;
}

// Better approach: just use node to import the compiled JS
// Since the TS file uses ES module syntax, let's just build a minimal JSON from
// the admin-panel's initialProducts.ts by spawning ts-node

import { execSync } from "child_process";

try {
  // Use tsx to run a quick extraction script
  const extractScript = `
    import { INITIAL_PRODUCTS } from './admin-panel/src/services/initialProducts.ts';
    import { writeFileSync, mkdirSync, existsSync } from 'fs';
    
    const CATEGORIES = [
      { id: "keerai", name: "Greens (Keerai)", emoji: "🌿", description: "Fresh leafy greens", color: "#EAF8F0", sortOrder: 1, active: true },
      { id: "microgreens", name: "Microgreens", emoji: "🌱", description: "Nutrient-packed microgreens (40g Pack)", color: "#E8F5E9", sortOrder: 2, active: true },
      { id: "vegetables", name: "Cut Vegetables", emoji: "🧅", description: "Ready-to-use cut vegetables", color: "#FFF8E7", sortOrder: 3, active: true },
      { id: "cut-fruits", name: "Cut Fruits", emoji: "🍓", description: "Fresh cut fruits", color: "#FFF0F5", sortOrder: 4, active: true },
      { id: "sprouts", name: "Sprouts", emoji: "🫘", description: "Fresh & nutritious sprouts", color: "#F0FFF4", sortOrder: 5, active: true },
      { id: "fresh-juices", name: "Fresh Juices", emoji: "🥤", description: "Freshly squeezed juices", color: "#FFFBE6", sortOrder: 6, active: true },
      { id: "premium-products", name: "Natural Powders", emoji: "✨", description: "Pure natural herbal powders", color: "#FAF0FF", sortOrder: 7, active: true },
      { id: "nuts-seeds", name: "Nuts & Seeds", emoji: "🥜", description: "Nutritious nuts & seeds", color: "#FFF5E6", sortOrder: 8, active: true },
      { id: "healthy-snacks", name: "Healthy Snacks", emoji: "🍿", description: "Guilt-free healthy snacks", color: "#F5FCF8", sortOrder: 9, active: true },
      { id: "seasonal-exotic-fruits", name: "Seasonal & Exotic Fruits", emoji: "🍍", description: "Seasonal & exotic fruits", color: "#FFF8EE", sortOrder: 10, active: true },
      { id: "mushrooms", name: "Mushrooms", emoji: "🍄", description: "Fresh & dried mushrooms", color: "#F5F0FF", sortOrder: 11, active: true },
      { id: "cold-pressed-oil", name: "Cold Pressed Oil", emoji: "🫙", description: "Pure cold pressed oils", color: "#FFFAEB", sortOrder: 12, active: true },
    ];

    if (!existsSync('./data')) mkdirSync('./data', { recursive: true });
    writeFileSync('./data/catalog.json', JSON.stringify({ products: INITIAL_PRODUCTS, categories: CATEGORIES, updatedAt: new Date().toISOString() }, null, 2));
    console.log('Seeded ' + INITIAL_PRODUCTS.length + ' products to data/catalog.json');
  `;
  
  writeFileSync(join(ROOT, "scripts/_seed_tmp.ts"), extractScript);
  execSync(`npx tsx scripts/_seed_tmp.ts`, { cwd: ROOT, stdio: "inherit" });
  
  // Cleanup temp file
  try { import("fs").then(fs => fs.unlinkSync(join(ROOT, "scripts/_seed_tmp.ts"))); } catch {}

} catch (e) {
  console.error("Extraction failed:", e.message);
  process.exit(1);
}
