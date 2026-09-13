-- ==============================================================================
-- Shree Hari Keerai - Complete Fresh Setup for NEW Supabase Project
-- Project: wmzevbfhziroffoyxkxf
-- Single Source of Truth for Storefront, Admin Panel, and Android App
-- ==============================================================================

-- ── 1. Create Categories Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🌿',
    description TEXT DEFAULT '',
    color TEXT NOT NULL DEFAULT '#EAF8F0',
    image TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for Categories
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

-- Enable RLS for Categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;
CREATE POLICY "Public can view active categories"
ON public.categories FOR SELECT
TO anon, authenticated, service_role
USING (true);

DROP POLICY IF EXISTS "Admin full access on categories" ON public.categories;
CREATE POLICY "Admin full access on categories"
ON public.categories FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);


-- ── 2. Create Products Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_tamil TEXT DEFAULT '',
    tamil_name TEXT DEFAULT '',
    price NUMERIC NOT NULL DEFAULT 0,
    mrp NUMERIC NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '1 Pack',
    quantity TEXT DEFAULT '1 Pack',
    category TEXT NOT NULL REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    secondary_category TEXT DEFAULT '',
    image TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    description TEXT DEFAULT '',
    short_description TEXT DEFAULT '',
    note TEXT DEFAULT '',
    in_stock BOOLEAN NOT NULL DEFAULT true,
    stock_quantity INTEGER,
    featured BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    variant_type TEXT,
    variants JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for Products
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_secondary_category ON public.products(secondary_category);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON public.products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(featured);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON public.products(sort_order);

-- Enable RLS for Products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
ON public.products FOR SELECT
TO anon, authenticated, service_role
USING (true);

DROP POLICY IF EXISTS "Admin full access on products" ON public.products;
CREATE POLICY "Admin full access on products"
ON public.products FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);


-- ── 3. Create Orders Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,

    -- Razorpay identifiers
    razorpay_payment_id TEXT,
    razorpay_order_id   TEXT,
    razorpay_signature  TEXT,

    -- Customer details
    full_name   TEXT NOT NULL DEFAULT '',
    mobile      TEXT NOT NULL DEFAULT '',
    email       TEXT DEFAULT '',
    address     TEXT DEFAULT '',
    city        TEXT DEFAULT '',
    state       TEXT DEFAULT '',
    pincode     TEXT DEFAULT '',
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    maps_link   TEXT DEFAULT '',

    -- Financials
    subtotal        NUMERIC NOT NULL DEFAULT 0,
    delivery_charge NUMERIC NOT NULL DEFAULT 0,
    discount        NUMERIC NOT NULL DEFAULT 0,
    total           NUMERIC NOT NULL DEFAULT 0,

    -- Items array {id, name, nameTamil, quantity, price, unit}
    items JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Payment status text (e.g. "Paid (Razorpay) · pay_XXXXX")
    payment_status TEXT NOT NULL DEFAULT 'Paid (Razorpay)',

    -- Downstream notification flags
    sheets_synced  BOOLEAN NOT NULL DEFAULT false,
    email_sent     BOOLEAN NOT NULL DEFAULT false,

    -- Retry tracking
    retry_count     INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT DEFAULT NULL,
    last_attempt_at TIMESTAMPTZ DEFAULT NULL,

    -- Source metadata
    source TEXT DEFAULT 'storefront',

    -- Timestamps
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Unique index on Razorpay payment ID prevents duplicate orders
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id
    ON public.orders(razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL AND razorpay_payment_id <> '';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_email           ON public.orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_mobile          ON public.orders(mobile);
CREATE INDEX IF NOT EXISTS idx_orders_sheets_synced   ON public.orders(sheets_synced) WHERE sheets_synced = false;

-- Enable RLS for Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
CREATE POLICY "Allow public insert on orders"
ON public.orders FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select on orders" ON public.orders;
CREATE POLICY "Allow public select on orders"
ON public.orders FOR SELECT
TO anon, authenticated, service_role
USING (true);

DROP POLICY IF EXISTS "Allow public update on orders" ON public.orders;
CREATE POLICY "Allow public update on orders"
ON public.orders FOR UPDATE
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on orders" ON public.orders;
CREATE POLICY "Service role full access on orders"
ON public.orders FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ── 4. Create Customer Profiles Table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    mobile TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower
    ON public.profiles (lower(email))
    WHERE email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_mobile
    ON public.profiles (mobile)
    WHERE mobile <> '';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
CREATE POLICY "Service role full access on profiles"
ON public.profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ── 5. Auto-update `updated_at` Trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
CREATE TRIGGER set_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ── 6. Auth User Created Trigger (Sync to profiles) ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, mobile)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'mobile', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        mobile = COALESCE(NULLIF(EXCLUDED.mobile, ''), public.profiles.mobile);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();


-- ── 7. Atomic Stock Deduction Stored Procedure (RPC) ──────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_product_stock(
    p_items JSONB -- e.g. [{"id": "prod_1", "quantity": 2}, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_current_stock INT;
    v_new_stock INT;
    v_results JSONB := '[]'::jsonb;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, quantity INT)
    LOOP
        -- Row-level locking prevents concurrency race conditions
        SELECT stock_quantity INTO v_current_stock 
        FROM public.products 
        WHERE id = v_item.id 
        FOR UPDATE;
        
        IF FOUND AND v_current_stock IS NOT NULL THEN
            v_new_stock := GREATEST(0, v_current_stock - COALESCE(v_item.quantity, 1));
            
            UPDATE public.products
            SET 
                stock_quantity = v_new_stock,
                in_stock = (v_new_stock > 0),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_item.id;
            
            v_results := v_results || jsonb_build_object(
                'id', v_item.id,
                'previousStock', v_current_stock,
                'newStock', v_new_stock,
                'inStock', (v_new_stock > 0)
            );
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object('success', true, 'updated', v_results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_product_stock(JSONB) TO anon, authenticated, service_role;


-- ── 8. Realtime Publications ──────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'products'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
END $$;


-- ── 9. Supabase Storage Bucket for Product Images ─────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'products',
    'products',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];

-- Storage RLS policies
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Service role and authenticated can upload product images" ON storage.objects;
CREATE POLICY "Service role and authenticated can upload product images"
ON storage.objects FOR INSERT
TO authenticated, service_role
WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Service role and authenticated can update product images" ON storage.objects;
CREATE POLICY "Service role and authenticated can update product images"
ON storage.objects FOR UPDATE
TO authenticated, service_role
USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Service role and authenticated can delete product images" ON storage.objects;
CREATE POLICY "Service role and authenticated can delete product images"
ON storage.objects FOR DELETE
TO authenticated, service_role
USING (bucket_id = 'products');


-- ── 10. Default Categories Seed (Initial Structure) ───────────────────────────
INSERT INTO public.categories (id, name, emoji, description, color, sort_order, active)
VALUES 
    ('new-arrivals', 'New Arrivals', '✨', 'Freshly added new arrivals', '#FEF3C7', 0, true),
    ('keerai', 'Greens (Keerai)', '🌿', 'Fresh leafy greens', '#EAF8F0', 1, true),
    ('microgreens', 'Microgreens', '🌱', 'Nutrient-packed microgreens (40g Pack)', '#E8F5E9', 2, true),
    ('vegetables', 'Cut Vegetables', '🧅', 'Ready-to-use cut vegetables', '#FFF8E7', 3, true),
    ('cut-fruits', 'Cut Fruits', '🍓', 'Fresh cut fruits', '#FFF0F5', 4, true),
    ('sprouts', 'Sprouts', '🫘', 'Fresh & nutritious sprouts', '#F0FFF4', 5, true),
    ('fresh-juices', 'Fresh Juices', '🥤', 'Freshly squeezed juices', '#FFFBE6', 6, true),
    ('premium-products', 'Natural Powders', '✨', 'Pure natural herbal powders', '#FAF0FF', 7, true),
    ('nuts-seeds', 'Nuts & Seeds', '🥜', 'Nutritious nuts & seeds', '#FFF5E6', 8, true),
    ('healthy-snacks', 'Healthy Snacks', '🍿', 'Guilt-free healthy snacks', '#F5FCF8', 9, true),
    ('seasonal-exotic-fruits', 'Seasonal & Exotic Fruits', '🍍', 'Seasonal & exotic fruits', '#FFF8EE', 10, true),
    ('mushrooms', 'Mushrooms', '🍄', 'Fresh & dried mushrooms', '#F5F0FF', 11, true),
    ('cold-pressed-oil', 'Cold Pressed Oil', '🫙', 'Pure cold pressed oils', '#FFFAEB', 12, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    emoji = EXCLUDED.emoji,
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    active = EXCLUDED.active;
