-- ==============================================================================
-- Shree Hari Keerai - Customer Profiles (storefront authentication)
-- Additive only. Does not alter products, categories, payments, or admin APIs.
-- Run this in the Supabase SQL Editor if the profiles table does not exist yet.
-- ==============================================================================

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

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Keep a profile row in sync when a new Auth user is created
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

-- Resolve email for login when the customer types a mobile number
CREATE OR REPLACE FUNCTION public.get_email_for_login(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
    v_mobile TEXT;
BEGIN
    IF p_identifier IS NULL OR btrim(p_identifier) = '' THEN
        RETURN NULL;
    END IF;

    IF position('@' in p_identifier) > 0 THEN
        RETURN lower(btrim(p_identifier));
    END IF;

    v_mobile := regexp_replace(p_identifier, '[^0-9]', '', 'g');
    IF length(v_mobile) = 12 AND left(v_mobile, 2) = '91' THEN
        v_mobile := right(v_mobile, 10);
    END IF;
    IF length(v_mobile) <> 10 THEN
        RETURN NULL;
    END IF;

    SELECT email INTO v_email
    FROM public.profiles
    WHERE mobile = v_mobile
    LIMIT 1;

    RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_for_login(TEXT) TO anon, authenticated;
