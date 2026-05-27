-- ============================================================
-- Migration 0002 — OTP rate-limiting columns
-- Apply in the Supabase SQL Editor. Idempotent.
-- Backs /api/otp/send cooldown + send cap and /api/otp/verify
-- attempt cap.
-- ============================================================
alter table public.otp_codes
  add column if not exists last_sent_at timestamptz not null default now(),
  add column if not exists sends    integer not null default 0,
  add column if not exists attempts integer not null default 0;
