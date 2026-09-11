-- ==============================================================================
-- Shree Hari Keerai — Fix Orders Table Row Level Security (RLS) Policies
-- ==============================================================================
-- Run this SQL in your Supabase Dashboard -> SQL Editor -> New Query -> Run
-- This allows storefront orders to be inserted and viewed without permission errors.
-- ==============================================================================

-- 1. Ensure Table Exists with All Required Columns
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    razorpay_payment_id TEXT,
    razorpay_order_id   TEXT,
    razorpay_signature  TEXT,
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
    subtotal        NUMERIC NOT NULL DEFAULT 0,
    delivery_charge NUMERIC NOT NULL DEFAULT 0,
    discount        NUMERIC NOT NULL DEFAULT 0,
    total           NUMERIC NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    payment_status TEXT NOT NULL DEFAULT 'Paid (Razorpay)',
    sheets_synced  BOOLEAN NOT NULL DEFAULT false,
    email_sent     BOOLEAN NOT NULL DEFAULT false,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT DEFAULT NULL,
    last_attempt_at TIMESTAMPTZ DEFAULT NULL,
    source TEXT DEFAULT 'storefront',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id
    ON public.orders(razorpay_payment_id)
    WHERE razorpay_payment_id IS NOT NULL AND razorpay_payment_id <> '';

CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_sheets_synced   ON public.orders(sheets_synced) WHERE sheets_synced = false;
CREATE INDEX IF NOT EXISTS idx_orders_email_sent      ON public.orders(email_sent)    WHERE email_sent = false;

-- 3. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Clean up old restrictive policies
DROP POLICY IF EXISTS "Service role full access on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public select on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all access on orders" ON public.orders;

-- 5. Create Permissive Policies for Storefront & Admin
-- Allow Anonymous & Authenticated users (Storefront Customers) to Insert Orders
CREATE POLICY "Allow public insert on orders"
ON public.orders FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (true);

-- Allow Public & Service Role to Read Orders
CREATE POLICY "Allow public select on orders"
ON public.orders FOR SELECT
TO anon, authenticated, service_role
USING (true);

-- Allow Status Updates (for Sheets sync and status flags)
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

-- 6. Enable Realtime Replication
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
