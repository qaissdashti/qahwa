-- ============================================================
-- Migration 0003 — bank/payout details on creators
-- Apply in the Supabase SQL Editor. Idempotent.
-- Creators enter their IBAN/bank/account-holder once (in settings),
-- and the payout request form just uses those saved values.
-- IBAN is stored encrypted at rest (AES-256-GCM via lib/encryption.js)
-- plus a masked form for safe display in the UI.
-- ============================================================
alter table public.creators
  add column if not exists iban_encrypted  text,
  add column if not exists iban_masked     text,
  add column if not exists bank_name       text,
  add column if not exists account_holder  text;

-- After applying, run if PostgREST doesn't see the new columns yet:
-- notify pgrst, 'reload schema';
