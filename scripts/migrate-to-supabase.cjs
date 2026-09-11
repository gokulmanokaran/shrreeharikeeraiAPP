const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load catalog data
const catalogPath = path.join(__dirname, '../data/catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

// Auto load .env if available
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const match = line.trim().match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
        if (!process.env[key]) process.env[key] = value;
      }
    });
  }
} catch {
  // ignore
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// 1. Generate SQL Seed file (for 1-click paste in Supabase SQL Editor)
function generateSeedSql() {
  const lines = [
    '-- ==============================================================================',
    '-- Shree Hari Keerai - Seed Data for Supabase',
    '-- Populates all categories and products with exact fields and pricing',
    '-- ==============================================================================',
    '',
    '-- 1. Insert / Upsert Categories',
  ];

  for (const cat of catalog.categories) {
    const esc = (s) => (s ? `'${String(s).replace(/'/g, "''")}'` : "''");
    lines.push(
      `INSERT INTO public.categories (id, name, emoji, description, color, sort_order, active) ` +
      `VALUES (${esc(cat.id)}, ${esc(cat.name)}, ${esc(cat.emoji)}, ${esc(cat.description)}, ${esc(cat.color)}, ${Number(cat.sortOrder || 0)}, ${cat.active !== false}) ` +
      `ON CONFLICT (id) DO UPDATE SET ` +
      `name = EXCLUDED.name, emoji = EXCLUDED.emoji, description = EXCLUDED.description, color = EXCLUDED.color, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;`
    );
  }

  lines.push('', '-- 2. Insert / Upsert Products');
  for (const p of catalog.products) {
    const esc = (s) => (s ? `'${String(s).replace(/'/g, "''")}'` : "''");
    const variantsJson = JSON.stringify(p.variants || []).replace(/'/g, "''");
    lines.push(
      `INSERT INTO public.products (id, name, name_tamil, tamil_name, price, mrp, unit, quantity, category, image, image_url, description, short_description, note, in_stock, stock_quantity, featured, active, sort_order, variant_type, variants) ` +
      `VALUES (${esc(p.id)}, ${esc(p.name)}, ${esc(p.nameTamil || p.tamilName)}, ${esc(p.tamilName || p.nameTamil)}, ${Number(p.price || 0)}, ${Number(p.mrp || p.price || 0)}, ${esc(p.unit)}, ${esc(p.quantity || p.unit)}, ${esc(p.category)}, ${esc(p.image)}, ${esc(p.image)}, ${esc(p.description)}, ${esc(p.shortDescription)}, ${esc(p.note)}, ${p.inStock !== false}, ${p.stockQuantity !== undefined ? Number(p.stockQuantity) : 'NULL'}, ${Boolean(p.featured)}, ${p.active !== false}, ${Number(p.sortOrder || 0)}, ${p.variantType ? esc(p.variantType) : 'NULL'}, '${variantsJson}'::jsonb) ` +
      `ON CONFLICT (id) DO UPDATE SET ` +
      `name = EXCLUDED.name, name_tamil = EXCLUDED.name_tamil, tamil_name = EXCLUDED.tamil_name, price = EXCLUDED.price, mrp = EXCLUDED.mrp, unit = EXCLUDED.unit, quantity = EXCLUDED.quantity, category = EXCLUDED.category, image = EXCLUDED.image, image_url = EXCLUDED.image_url, description = EXCLUDED.description, short_description = EXCLUDED.short_description, note = EXCLUDED.note, in_stock = EXCLUDED.in_stock, stock_quantity = EXCLUDED.stock_quantity, featured = EXCLUDED.featured, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order, variant_type = EXCLUDED.variant_type, variants = EXCLUDED.variants;`
    );
  }

  const seedSqlPath = path.join(__dirname, '../supabase/seed.sql');
  fs.writeFileSync(seedSqlPath, lines.join('\n'), 'utf-8');
  console.log(`✓ Generated ${seedSqlPath} with ${catalog.categories.length} categories and ${catalog.products.length} products.`);
}

generateSeedSql();

// 2. Direct Node API migration if Supabase environment variables are provided
async function runDirectMigration() {
  if (!supabaseUrl || !supabaseKey) {
    console.log('\n[Supabase Direct Migration]');
    console.log('ℹ SUPABASE_URL or SUPABASE_KEY not set in environment.');
    console.log('ℹ You can copy and paste "supabase/schema.sql" and "supabase/seed.sql" directly into your Supabase Dashboard SQL Editor!');
    console.log('ℹ Or run: SUPABASE_URL=... SUPABASE_KEY=... node scripts/migrate-to-supabase.cjs\n');
    return;
  }

  console.log(`\nConnecting to Supabase at ${supabaseUrl}...`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Migrate Categories
  console.log(`Migrating ${catalog.categories.length} categories...`);
  const categoriesPayload = catalog.categories.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji || '🌿',
    description: c.description || '',
    color: c.color || '#EAF8F0',
    sort_order: Number(c.sortOrder || 0),
    active: c.active !== false,
  }));

  const { error: catError } = await supabase.from('categories').upsert(categoriesPayload, { onConflict: 'id' });
  if (catError) {
    console.error('❌ Error migrating categories:', catError.message);
  } else {
    console.log(`✓ Successfully migrated ${categoriesPayload.length} categories.`);
  }

  // Migrate Products
  console.log(`Migrating ${catalog.products.length} products...`);
  const productsPayload = catalog.products.map((p) => ({
    id: p.id,
    name: p.name,
    name_tamil: p.nameTamil || p.tamilName || '',
    tamil_name: p.tamilName || p.nameTamil || '',
    price: Number(p.price || 0),
    mrp: Number(p.mrp || p.price || 0),
    unit: p.unit || '1 Pack',
    quantity: p.quantity || p.unit || '1 Pack',
    category: p.category || 'keerai',
    image: p.image || '',
    image_url: p.image || '',
    description: p.description || '',
    short_description: p.shortDescription || '',
    note: p.note || '',
    in_stock: p.inStock !== false,
    stock_quantity: p.stockQuantity !== undefined ? Number(p.stockQuantity) : null,
    featured: Boolean(p.featured),
    active: p.active !== false,
    sort_order: Number(p.sortOrder || 0),
    variant_type: p.variantType || null,
    variants: p.variants || [],
  }));

  const { error: prodError } = await supabase.from('products').upsert(productsPayload, { onConflict: 'id' });
  if (prodError) {
    console.error('❌ Error migrating products:', prodError.message);
  } else {
    console.log(`✓ Successfully migrated ${productsPayload.length} products to Supabase.`);
  }

  console.log('\n✓ Migration complete!');
}

runDirectMigration().catch(console.error);
