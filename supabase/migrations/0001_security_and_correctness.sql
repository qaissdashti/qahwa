-- ============================================================
-- Migration 0001 — security & correctness
-- Apply on top of the existing schema (Supabase SQL Editor).
-- Idempotent; safe to run once. Covers fixes #3, #6, #8.
-- ============================================================

-- ── #3: close the anon read leak on creators ────────────────
-- The tipping page uses the service-role client, so anon needs no
-- read access. RLS is row-level (not column-level), so any anon
-- SELECT policy would expose email/phone/balance to the public
-- anon key. Drop the permissive policy.
drop policy if exists creators_public_read on public.creators;

-- ── #6: reverse balance on refund / chargeback ──────────────
create or replace function public.update_creator_balance()
returns trigger language plpgsql as $$
begin
  -- transition INTO 'paid' → credit the creator
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    update public.creators
      set total_tips_count = total_tips_count + 1,
          total_earned_kd  = total_earned_kd  + new.net_amount_kd,
          balance_kd       = balance_kd        + new.net_amount_kd
      where id = new.creator_id;

  -- transition OUT of 'paid' (refund / chargeback / reversal) → claw back
  elsif tg_op = 'UPDATE' and old.status = 'paid' and new.status is distinct from 'paid' then
    update public.creators
      set total_tips_count = greatest(total_tips_count - 1, 0),
          total_earned_kd  = greatest(total_earned_kd - old.net_amount_kd, 0),
          balance_kd       = balance_kd - old.net_amount_kd
      where id = new.creator_id;
  end if;
  return new;
end $$;

-- ── #8: race-safe single-pending-payout guard ───────────────
-- If this fails with a duplicate error, you already have >1 pending
-- payout for some creator; resolve those first, then re-run.
create unique index if not exists payouts_one_pending_per_creator
  on public.payouts (creator_id) where status = 'pending';
