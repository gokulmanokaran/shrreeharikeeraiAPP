-- ==============================================================================
-- Shree Hari Keerai — Security & Customer Data Isolation Patch
-- Project: wmzevbfhziroffoyxkxf
-- ==============================================================================
-- Run this script in:
-- Supabase Dashboard -> Project (wmzevbfhziroffoyxkxf) -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Add user_id column to orders table (if not exists)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Performance indexes for user-isolated queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_email_lower ON public.orders(lower(email));

-- 3. Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Drop all legacy/insecure public access policies on orders
DROP POLICY IF EXISTS "Allow public select on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow customers to insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Service role full access on orders" ON public.orders;

-- 5. Strict SELECT Policy:
-- Authenticated customers can ONLY view orders where user_id matches auth.uid()
-- OR the order email matches their authenticated account email.
CREATE POLICY "Customers can view own orders"
ON public.orders FOR SELECT
TO authenticated
USING (
    (user_id IS NOT NULL AND auth.uid() = user_id)
    OR
    (email IS NOT NULL AND email <> '' AND lower(email) = lower(auth.jwt()->>'email'))
);

-- 6. Strict INSERT Policy:
-- Authenticated users can insert orders for their account;
-- Anonymous customers can insert orders during checkout;
-- Service role has full insert privileges.
CREATE POLICY "Allow customers to insert own orders"
ON public.orders FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (
    (auth.uid() IS NULL) OR (user_id IS NULL) OR (user_id = auth.uid())
);

-- 7. UPDATE & DELETE Policies:
-- Strictly restricted to service_role (Backend APIs & Admin Panel).
-- Customers and anonymous users CANNOT modify or delete orders!
CREATE POLICY "Service role full access on orders"
ON public.orders FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 8. Verify profiles table RLS policies
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
