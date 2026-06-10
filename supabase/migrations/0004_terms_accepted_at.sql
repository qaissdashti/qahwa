-- 0004_terms_accepted_at.sql
-- Records the timestamp at which each creator accepted the Terms &
-- Conditions during onboarding. The /onboard Step 5 review submits a
-- POST to /api/creator/accept-terms which writes now() into this column.
--
-- Nullable on purpose: creators that signed up before this migration
-- haven't accepted the current ToS — they'll be prompted on next login
-- (or whenever we add a re-acceptance gate). Querying
--   WHERE terms_accepted_at IS NULL
-- gives the list of accounts that still need to accept.

ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.creators.terms_accepted_at IS
  'When the creator accepted the Terms & Conditions on /onboard Step 5. NULL = not yet accepted.';
