-- 0005_payout_fee.sql
-- Adds a fixed payout fee, deducted from a creator's withdrawal.
--
--   • platform_settings.payout_fee_kd — the current fee (god-admin editable),
--     default 2.000 KD. Charged once per payout request.
--   • payouts.fee_kd — the fee actually charged on each payout row, snapshotted
--     at request time so reporting stays accurate even if the setting changes
--     later. Defaults to 0 so pre-existing payouts (charged no fee) read as 0.
--
-- Semantics: amount_kd stays the GROSS amount the creator requested (and the
-- amount deducted from their balance by deduct_payout_balance()). The creator
-- receives amount_kd - fee_kd in their bank. The fee is the platform's cut.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payout_fee_kd numeric(6,3) NOT NULL DEFAULT 2.000;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS fee_kd numeric(6,3) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.platform_settings.payout_fee_kd IS
  'Fixed fee (KD) deducted from each payout. God-admin editable.';
COMMENT ON COLUMN public.payouts.fee_kd IS
  'Payout fee charged on this row, snapshotted from platform_settings.payout_fee_kd at request time. Net to creator = amount_kd - fee_kd.';
