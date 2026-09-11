-- ==============================================================================
-- Shree Hari Keerai - Supabase Database Schema
-- Single Source of Truth for Storefront, Admin Panel & Future Android App
-- ==============================================================================

-- 1. Create Categories Table
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

-- 2. Create Products Table
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

-- 2.1 Ensure new columns exist on existing databases (Idempotent updates)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mrp NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_tamil TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tamil_name TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variant_type TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS secondary_category TEXT DEFAULT '';

-- 2.2 Add image column to categories (Idempotent)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_secondary_category ON public.products(secondary_category);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON public.products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(featured);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON public.products(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS Policies for Categories
-- Public (anonymous) can view active categories
DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;
CREATE POLICY "Public can view active categories"
ON public.categories FOR SELECT
USING (true);

-- Authenticated / Service Role can insert/update/delete categories
DROP POLICY IF EXISTS "Admin full access on categories" ON public.categories;
CREATE POLICY "Admin full access on categories"
ON public.categories FOR ALL
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 6. Define RLS Policies for Products
-- Public (anonymous) can view active products
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
ON public.products FOR SELECT
USING (true);

-- Authenticated / Service Role can insert/update/delete products
DROP POLICY IF EXISTS "Admin full access on products" ON public.products;
CREATE POLICY "Admin full access on products"
ON public.products FOR ALL
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 7. Enable Supabase Realtime for instant multi-client push (Idempotent)
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
END $$;

-- 8. Auto-update `updated_at` timestamp trigger
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

-- 9. Atomic Stock Deduction Stored Procedure (RPC)
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
        -- Check current stock with row-level locking to prevent concurrency race conditions
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


-- ==============================================================================
-- 10. Orders Table — Durable Order Persistence & Notification Tracking
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
    -- Primary identifier: our internal storefront order ID (e.g. "SHK-1725187800000")
    id TEXT PRIMARY KEY,

    -- Razorpay identifiers (unique index prevents duplicate webhook processing)
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

    -- Order financials
    subtotal        NUMERIC NOT NULL DEFAULT 0,
    delivery_charge NUMERIC NOT NULL DEFAULT 0,
    discount        NUMERIC NOT NULL DEFAULT 0,
    total           NUMERIC NOT NULL DEFAULT 0,

    -- Full items payload (JSONB array of {id, name, nameTamil, quantity, price, unit})
    items JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Payment status text (e.g. "Paid (Razorpay) · pay_XXXXX")
    payment_status TEXT NOT NULL DEFAULT 'Paid (Razorpay)',

    -- Downstream notification status
    sheets_synced  BOOLEAN NOT NULL DEFAULT false,
    email_sent     BOOLEAN NOT NULL DEFAULT false,

    -- Retry observability
    retry_count     INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT DEFAULT NULL,
    last_attempt_at TIMESTAMPTZ DEFAULT NULL,

    -- Source metadata
    source TEXT DEFAULT 'storefront',

    -- Timestamps
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Unique index so duplicate Razorpay payment IDs are rejected at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id
    ON public.orders(razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL AND razorpay_payment_id <> '';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sheets_synced   ON public.orders(sheets_synced) WHERE sheets_synced = false;
CREATE INDEX IF NOT EXISTS idx_orders_email_sent      ON public.orders(email_sent)    WHERE email_sent = false;

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Clean up old policies
DROP POLICY IF EXISTS "Service role full access on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public select on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update on orders" ON public.orders;

-- Allow Storefront Customers (anon & authenticated) to insert orders
CREATE POLICY "Allow public insert on orders"
ON public.orders FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (true);

-- Allow Reading orders
CREATE POLICY "Allow public select on orders"
ON public.orders FOR SELECT
TO anon, authenticated, service_role
USING (true);

-- Allow Updating orders (e.g. syncing flags)
CREATE POLICY "Allow public update on orders"
ON public.orders FOR UPDATE
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Full access for Service Role
CREATE POLICY "Service role full access on orders"
ON public.orders FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for orders table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
END $$;

-- Customer profiles & login helpers live in supabase/customer-auth.sql (additive).

