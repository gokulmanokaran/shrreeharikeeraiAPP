-- Migration: Add stock_deducted idempotency column to orders table
-- Run this once against your live Supabase database.
-- Safe to re-run: uses IF NOT EXISTS guard.
--
-- Purpose:
--   Prevents double stock deduction when both /api/process-payment
--   and /api/razorpay-webhook fire for the same order.
--   Once stock is deducted by either path, this flag is set to TRUE
--   and subsequent calls skip deduction.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing paid orders as already-deducted so the webhook
-- doesn't re-deduct stock for historical orders.
UPDATE public.orders
  SET stock_deducted = true
  WHERE stock_deducted = false
    AND (
      lower(payment_status) LIKE '%paid%'
      OR razorpay_payment_id IS NOT NULL
    );

-- Confirm
SELECT
  COUNT(*) FILTER (WHERE stock_deducted = true)  AS already_deducted,
  COUNT(*) FILTER (WHERE stock_deducted = false) AS pending_deduction,
  COUNT(*)                                        AS total_orders
FROM public.orders;
