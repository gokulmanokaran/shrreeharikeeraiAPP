-- ==============================================================================
-- Shree Hari Keerai — Sequential Order ID System Migration
-- ==============================================================================
-- Formats order IDs sequentially: ORD-000001, ORD-000002, ORD-000003, etc.
-- Atomic, concurrent-safe, server-side/database-side generation.
-- ==============================================================================

-- 1. Create PostgreSQL Sequence
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- 2. Align sequence with any existing sequential orders in database
DO $$
DECLARE
  v_max_seq BIGINT := 0;
  v_order_record RECORD;
BEGIN
  FOR v_order_record IN 
    SELECT id FROM public.orders WHERE id ~ '^ORD-[0-9]+$'
  LOOP
    BEGIN
      v_max_seq := GREATEST(v_max_seq, SUBSTRING(v_order_record.id FROM 5)::BIGINT);
    EXCEPTION WHEN OTHERS THEN
      -- ignore parse errors
    END;
  END LOOP;

  IF v_max_seq > 0 THEN
    PERFORM setval('public.order_number_seq', v_max_seq);
  END IF;
END $$;

-- 3. Database function to generate next sequential Order ID atomically
CREATE OR REPLACE FUNCTION public.generate_sequential_order_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq BIGINT;
  v_order_id TEXT;
  v_exists BOOLEAN;
  v_tries INT := 0;
BEGIN
  LOOP
    v_tries := v_tries + 1;
    v_seq := nextval('public.order_number_seq');
    -- Format: ORD-000001, ORD-000002, etc. (6-digit zero padding)
    v_order_id := 'ORD-' || LPAD(v_seq::TEXT, 6, '0');
    
    -- Safety check: ensure no order already exists with this ID
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE id = v_order_id) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_order_id;
    END IF;
    
    -- Safety circuit breaker
    IF v_tries > 10000 THEN
      RAISE EXCEPTION 'Unable to find unique order ID after 10000 attempts';
    END IF;
  END LOOP;
END;
$$;

-- 4. Grant permissions
GRANT USAGE, SELECT ON SEQUENCE public.order_number_seq TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_sequential_order_id() TO anon, authenticated, service_role;
