-- ============================================================
-- Qahwa ☕ — Supabase schema
-- Reconstructed from codebase column references (types/index.ts,
-- lib/*, app/api/*). Run once in the Supabase SQL Editor, or apply
-- via the Management API. Idempotent where practical.
-- ============================================================

-- gen_random_uuid() is built into Postgres 13+; pgcrypto kept for safety.
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type verification_status as enum ('pending','under_review','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tip_status as enum ('pending','paid','failed','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reply_type as enum ('text','voice_note');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_method as enum ('bank_transfer','knet_send');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_status as enum ('pending','approved','paid','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wa_direction as enum ('inbound','outbound');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- CREATORS
-- id == auth.users.id (1:1 with the Supabase Auth user)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.creators (
  id                  uuid primary key references auth.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  full_name           text not null default '',
  handle              text unique,
  email               text,
  phone               text,
  whatsapp_number     text,

  avatar_url          text,
  avatar_emoji        text default '☕',
  bio                 text,

  coffee_price_kd     numeric(6,3) not null default 1.000,
  theme_bg            text not null default '#FAFAF7',
  theme_text          text not null default '#0D0D0D',

  amazing_enabled     boolean not null default true,
  amazing_message     text,
  thankyou_template   text,

  instagram           text,
  twitter             text,
  youtube             text,
  tiktok              text,

  total_tips_count    integer not null default 0,
  total_earned_kd     numeric(12,3) not null default 0,
  balance_kd          numeric(12,3) not null default 0,

  is_verified         boolean not null default false,
  is_active           boolean not null default true,
  is_disabled         boolean not null default false,
  verification_status verification_status not null default 'pending'
);

create index if not exists creators_handle_idx on public.creators (handle);

-- handle should be stored lowercase; enforce a basic format
alter table public.creators
  drop constraint if exists creators_handle_format;
alter table public.creators
  add constraint creators_handle_format
  check (handle is null or handle ~ '^[a-z0-9_]{3,30}$');

-- ─────────────────────────────────────────────────────────────
-- VERIFICATIONS (KYC: phone OTP, Civil ID, selfie, payout IBAN)
-- Civil ID + IBAN stored encrypted (see lib/encryption.js)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.verifications (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null unique references public.creators(id) on delete cascade,
  created_at          timestamptz not null default now(),
  reviewed_at         timestamptz,

  phone_verified      boolean not null default false,
  phone_verified_at   timestamptz,

  civil_id_encrypted  text,
  civil_id_masked     text,

  selfie_url          text,

  iban_encrypted      text,
  bank_name           text,
  account_holder      text,

  status              verification_status not null default 'pending',
  reviewer_notes      text
);

create index if not exists verifications_creator_idx on public.verifications (creator_id);

-- ─────────────────────────────────────────────────────────────
-- TIPS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tips (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  paid_at                 timestamptz,
  creator_id              uuid not null references public.creators(id) on delete cascade,

  supporter_phone         text,
  supporter_name          text,

  cups                    integer not null default 0,
  is_amazing              boolean not null default false,

  gross_amount_kd         numeric(12,3) not null,
  platform_fee_kd         numeric(12,3) not null default 0,
  net_amount_kd           numeric(12,3) not null default 0,
  fee_pct                 numeric(5,2) not null default 0,

  message                 text,
  payment_method          text,

  myfatoorah_invoice_id   text,
  myfatoorah_payment_id   text,

  status                  tip_status not null default 'pending',

  whatsapp_notified_at    timestamptz,
  reply_sent_at           timestamptz,
  reply_type              reply_type,
  reply_content           text,
  reply_voice_url         text
);

create index if not exists tips_creator_idx        on public.tips (creator_id);
create index if not exists tips_status_idx         on public.tips (status);
create index if not exists tips_invoice_idx        on public.tips (myfatoorah_invoice_id);
create index if not exists tips_creator_paid_idx   on public.tips (creator_id, paid_at desc);

-- ─────────────────────────────────────────────────────────────
-- PAYOUTS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.payouts (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  creator_id      uuid not null references public.creators(id) on delete cascade,
  amount_kd       numeric(12,3) not null,
  bank_name       text,
  account_holder  text,
  iban            text,
  method          payout_method not null default 'bank_transfer',
  status          payout_status not null default 'pending',
  paid_at         timestamptz,
  reviewer_notes  text
);

create index if not exists payouts_creator_idx on public.payouts (creator_id);
create index if not exists payouts_status_idx  on public.payouts (status);

-- at most one pending payout per creator — race-safe DB guard backing the
-- check in /api/creator/payout (concurrent requests can't both insert)
create unique index if not exists payouts_one_pending_per_creator
  on public.payouts (creator_id) where status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- PLATFORM SETTINGS (single row, id = 1)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.platform_settings (
  id                       integer primary key default 1,
  platform_fee_pct         numeric(5,2) not null default 7.00,
  min_payout_kd            numeric(12,3) not null default 5.000,
  max_coffee_price_kd      numeric(6,3) not null default 10.000,
  amazing_enabled_global   boolean not null default true,
  amazing_max_kd           numeric(12,3) not null default 50.000,
  amazing_min_kd           numeric(12,3) not null default 0.500,
  new_signups_enabled      boolean not null default true,
  manual_approval_required boolean not null default true,
  payouts_enabled          boolean not null default true,
  maintenance_mode         boolean not null default false,
  maintenance_message      text,
  constraint platform_settings_singleton check (id = 1)
);

insert into public.platform_settings (id) values (1)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- ADMIN USERS (god admin — auth via Supabase Auth, listed here)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.admin_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- WHATSAPP MESSAGES (audit log of every WA message)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.whatsapp_messages (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  tip_id              uuid references public.tips(id) on delete set null,
  creator_id          uuid references public.creators(id) on delete set null,
  direction           wa_direction not null,
  recipient_phone     text,
  message_type        text,
  content             text,
  voice_url           text,
  provider_message_id text,
  status              text default 'sent'
);

create index if not exists wa_messages_tip_idx     on public.whatsapp_messages (tip_id);
create index if not exists wa_messages_creator_idx on public.whatsapp_messages (creator_id);

-- ─────────────────────────────────────────────────────────────
-- OTP CODES (temp; phone verification during onboarding)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.otp_codes (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.creators(id) on delete cascade,
  phone       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  unique (creator_id, phone)
);

create index if not exists otp_codes_lookup_idx on public.otp_codes (creator_id, phone);

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: keep updated_at fresh on creators
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists creators_set_updated_at on public.creators;
create trigger creators_set_updated_at
  before update on public.creators
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: update creator balance when a tip becomes 'paid'
-- Fires when status transitions into 'paid' (insert or update).
-- The webhook (app/api/webhook/myfatoorah) relies on this.
-- ─────────────────────────────────────────────────────────────
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
          -- balance may legitimately go negative if funds were already paid out
          balance_kd       = balance_kd - old.net_amount_kd
      where id = new.creator_id;
  end if;
  return new;
end $$;

drop trigger if exists tips_update_balance on public.tips;
create trigger tips_update_balance
  after insert or update of status on public.tips
  for each row execute function public.update_creator_balance();

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: auto-create a creators row when a creator signs up.
-- Signup sets raw_user_meta_data.is_creator = 'true' (+ full_name,
-- handle). Admin users are created without that flag, so they get
-- no creators row. Idempotent via on conflict.
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'is_creator','') = 'true' then
    insert into public.creators (id, email, full_name, handle)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name',''),
      nullif(lower(new.raw_user_meta_data->>'handle'),'')
    )
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: decrement balance when a payout is approved/paid
-- (deduct the moment a payout leaves 'pending' toward payment)
-- ─────────────────────────────────────────────────────────────
create or replace function public.deduct_payout_balance()
returns trigger language plpgsql as $$
begin
  if new.status in ('approved','paid') and old.status = 'pending' then
    update public.creators
      set balance_kd = balance_kd - new.amount_kd
      where id = new.creator_id;
  -- refund balance if a paid/approved payout is later rejected
  elsif new.status = 'rejected' and old.status in ('approved','paid') then
    update public.creators
      set balance_kd = balance_kd + new.amount_kd
      where id = new.creator_id;
  end if;
  return new;
end $$;

drop trigger if exists payouts_deduct_balance on public.payouts;
create trigger payouts_deduct_balance
  after update of status on public.payouts
  for each row execute function public.deduct_payout_balance();

-- ═════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- service_role (used by all /api routes) bypasses RLS entirely.
-- These policies govern the browser anon/authenticated clients.
-- ═════════════════════════════════════════════════════════════
alter table public.creators          enable row level security;
alter table public.verifications     enable row level security;
alter table public.tips              enable row level security;
alter table public.payouts           enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_users       enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.otp_codes         enable row level security;

-- helper: is the current user a god admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where id = auth.uid());
$$;

-- CREATORS ----------------------------------------------------
drop policy if exists creators_select_own on public.creators;
create policy creators_select_own on public.creators
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists creators_update_own on public.creators;
create policy creators_update_own on public.creators
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- a freshly signed-up user may insert their own creators row
drop policy if exists creators_insert_self on public.creators;
create policy creators_insert_self on public.creators
  for insert with check (auth.uid() = id);

-- The public tipping page is served via the service-role client
-- (createAdminClient), which bypasses RLS — so anon needs NO read access
-- to creators. We intentionally do NOT add a permissive anon SELECT:
-- RLS is row-level (not column-level), so an anon SELECT policy would
-- expose email / phone / whatsapp_number / balance_kd / total_earned_kd
-- to anyone holding the public anon key. Drop it if it exists.
drop policy if exists creators_public_read on public.creators;

-- VERIFICATIONS ----------------------------------------------
drop policy if exists verifications_own on public.verifications;
create policy verifications_own on public.verifications
  for all using (auth.uid() = creator_id or public.is_admin())
  with check (auth.uid() = creator_id or public.is_admin());

-- TIPS --------------------------------------------------------
-- supporters (anon) may insert a tip only as 'pending'
drop policy if exists tips_anon_insert_pending on public.tips;
create policy tips_anon_insert_pending on public.tips
  for insert with check (status = 'pending');

-- creators read their own tips; admins read all
drop policy if exists tips_select_own on public.tips;
create policy tips_select_own on public.tips
  for select using (auth.uid() = creator_id or public.is_admin());

-- PAYOUTS -----------------------------------------------------
drop policy if exists payouts_select_own on public.payouts;
create policy payouts_select_own on public.payouts
  for select using (auth.uid() = creator_id or public.is_admin());

drop policy if exists payouts_insert_own on public.payouts;
create policy payouts_insert_own on public.payouts
  for insert with check (auth.uid() = creator_id and status = 'pending');

-- PLATFORM SETTINGS ------------------------------------------
-- anyone may read (tipping page needs amazing limits etc.)
drop policy if exists settings_read_all on public.platform_settings;
create policy settings_read_all on public.platform_settings
  for select using (true);

drop policy if exists settings_admin_write on public.platform_settings;
create policy settings_admin_write on public.platform_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ADMIN USERS -------------------------------------------------
drop policy if exists admin_self_read on public.admin_users;
create policy admin_self_read on public.admin_users
  for select using (auth.uid() = id);

-- WHATSAPP MESSAGES ------------------------------------------
drop policy if exists wa_select_own on public.whatsapp_messages;
create policy wa_select_own on public.whatsapp_messages
  for select using (auth.uid() = creator_id or public.is_admin());

-- OTP CODES ---------------------------------------------------
-- no anon/authenticated access — only service_role (OTP routes) touches these
-- (RLS enabled with no permissive policy = deny all to non-service clients)

-- ═════════════════════════════════════════════════════════════
-- DONE
-- ═════════════════════════════════════════════════════════════
