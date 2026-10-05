-- Hero Banners table setup — SAFE TO RUN MULTIPLE TIMES
-- Run this in your Supabase SQL Editor

-- 1. Create table if not already created
CREATE TABLE IF NOT EXISTS hero_banners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'New Banner',
  banner_type TEXT NOT NULL DEFAULT 'image',
  image_url TEXT DEFAULT '',
  gradient_config JSONB DEFAULT NULL,
  link_url TEXT DEFAULT '/products',
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add new columns if they were missing from a previous run
ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS banner_type TEXT NOT NULL DEFAULT 'image';
ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS gradient_config JSONB DEFAULT NULL;

-- 3. Enable RLS
ALTER TABLE hero_banners ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies if they exist, then recreate cleanly
DROP POLICY IF EXISTS "Allow public read on hero_banners" ON hero_banners;
DROP POLICY IF EXISTS "Allow service role full access to hero_banners" ON hero_banners;

CREATE POLICY "Allow public read on hero_banners"
  ON hero_banners FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to hero_banners"
  ON hero_banners FOR ALL USING (auth.role() = 'service_role');

-- 5. Seed the 3 existing gradient banners (skips if already inserted)
INSERT INTO hero_banners (id, name, banner_type, image_url, gradient_config, link_url, active, sort_order, created_at, updated_at)
VALUES
  (
    'pre-order',
    'Weekday Delivery Notice',
    'gradient',
    '',
    '{
      "id": "pre-order",
      "tag": "WEEKDAY DELIVERY NOTICE",
      "title": "Freshness Delivered Daily",
      "subtitle": "Order Today – Delivered Tomorrow Evening",
      "gradient": "from-[#00A651] via-[#087A43] to-[#065A31]",
      "accent": "rgba(255,255,255,0.12)",
      "targetCategory": "all",
      "chips": [],
      "previewCss": "linear-gradient(135deg, #00A651, #087A43, #065A31)"
    }',
    '/products',
    true,
    0,
    now(),
    now()
  ),
  (
    'weekend-delivery',
    'Weekend Delivery Notice',
    'gradient',
    '',
    '{
      "id": "weekend-delivery",
      "tag": "WEEKEND DELIVERY NOTICE",
      "title": "Orders placed on Saturday & Sunday",
      "subtitle": "will be delivered on Monday.",
      "gradient": "from-[#033E20] via-[#065A31] to-[#087A43]",
      "accent": "rgba(255,255,255,0.14)",
      "targetCategory": "all",
      "chips": [],
      "previewCss": "linear-gradient(135deg, #033E20, #065A31, #087A43)"
    }',
    '/products',
    true,
    1,
    now(),
    now()
  ),
  (
    'premium-dry-fruits',
    'Premium Dry Fruits & Seeds',
    'gradient',
    '',
    '{
      "id": "premium-dry-fruits",
      "tag": "PREMIUM SELECTION",
      "title": "Wholesome Dry Fruits & Seeds",
      "subtitle": "Natural, unsalted & nutrient-dense whole foods",
      "gradient": "from-[#111111] via-[#1E3A2B] to-[#087A43]",
      "accent": "rgba(0,166,81,0.25)",
      "targetCategory": "dry-fruits",
      "chips": ["🌰 Almonds & Cashews", "🫘 Pista & Walnuts", "🌱 Chia & Flax", "✨ Dates & Figs"],
      "previewCss": "linear-gradient(135deg, #111111, #1E3A2B, #087A43)"
    }',
    '/products?category=dry-fruits',
    true,
    2,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;
