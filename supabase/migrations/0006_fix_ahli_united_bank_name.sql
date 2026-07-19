-- ============================================================
-- Migration 0006 — fix Ahli United Bank Arabic name
-- Apply in the Supabase SQL Editor. Idempotent.
--
-- The bank dropdown (lib/kuwaitBanks.js) previously stored the wrong
-- Arabic name for "Ahli United Bank": it used 'البنك الأهلي الكويتي',
-- which is actually the legal name of Al Ahli Bank of Kuwait (ABK), a
-- DIFFERENT bank. creators.bank_name stores this Arabic string verbatim.
--
-- We've now added ABK as its own option that (correctly) uses
-- 'البنك الأهلي الكويتي', and corrected Ahli United to
-- 'البنك الأهلي المتحد'. Since ABK was not a selectable option before
-- this change, every existing row with 'البنك الأهلي الكويتي' can only
-- have been a creator who chose "Ahli United Bank" — so this backfill
-- safely remaps them to the corrected name.
-- ============================================================
update public.creators
set bank_name = 'البنك الأهلي المتحد'
where bank_name = 'البنك الأهلي الكويتي';
