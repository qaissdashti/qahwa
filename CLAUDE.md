# Qahwa ☕ — Build Instructions for Claude Code

## What is this?
Qahwa is a GCC-native creator tipping platform for Kuwait.
Supporters tip creators in KWD via KNET. No supporter account needed.
Creators get WhatsApp notifications and can reply directly to supporters.

## Stack
- Next.js 14 App Router
- Supabase (Postgres + Auth + Storage)
- MyFatoorah (KNET, Apple Pay, Visa — KWD)
- WhatsApp Business API (Meta) via 360dialog or Twilio
- Tailwind CSS
- Deployed on Vercel + Cloudflare

## Project structure
```
app/
  [username]/page.js         ← Public tipping page (no auth)
  dashboard/                 ← Creator dashboard (auth required)
  admin/                     ← God admin panel (admin auth required)
  api/
    payment/initiate/        ← POST: start a payment
    payment/callback/        ← GET:  MyFatoorah redirect after pay
    webhook/myfatoorah/      ← POST: payment confirmed → mark paid → notify creator
    whatsapp/inbound/        ← POST: creator replies → route to supporter
    otp/send/                ← POST: send OTP via WhatsApp
    otp/verify/              ← POST: verify OTP code

lib/
  supabase.js                ← createClient, createServerSupabaseClient, createAdminClient
  myfatoorah.js              ← createInvoice, getPaymentStatus
  whatsapp.js                ← sendCreatorNotification, handleCreatorReply, sendOTP
  encryption.js              ← AES-256 encrypt/decrypt for Civil ID + IBAN

components/
  tipper/TippingClient.js    ← Full tipping UI (cup selector, amazing box, pay button)
  creator/                   ← Creator dashboard components (build these)
  admin/                     ← God admin components (build these)

types/index.ts               ← TypeScript types for all DB tables
```

## Three user roles
1. **Supporter** — visits buymeqahwa.com/[handle], no account needed, pays via KNET
2. **Creator** — logs in at /dashboard, customises page, sees tips, requests payouts
3. **God Admin (you)** — logs in at /admin, full platform control

## Database (Supabase)
7 tables: creators, verifications, tips, payouts, platform_settings, admin_users, whatsapp_messages
+ otp_codes (temp table: id, creator_id, phone, code_hash, expires_at)

Run the schema SQL in Supabase SQL Editor BEFORE starting the app.
See qahwa_supabase_schema.docx for full SQL.

## Key flows to build next

### 1. Creator Auth + Onboarding
- /signup → email/password via Supabase Auth → creates creators row
- /verify → 3-step: OTP phone → Civil ID → selfie upload
- /dashboard → protected route, redirects to /verify if not verified

### 2. Creator Dashboard pages
- Overview (stats, balance, bar chart, recent tips)
- Tips list (all transactions)  
- Messages (tips with messages + WhatsApp reply button)
- Payout request form
- Settings (profile customisation — theme, avatar, coffee price, amazing box)

### 3. God Admin pages (/admin — separate Supabase Auth role)
- Overview dashboard
- Creators list with enable/disable
- Verification review (selfie + civil ID + OTP status)
- Payouts approval queue
- Platform settings (fee %, amazing limits, maintenance mode)

## Payment flow (already coded)
1. TippingClient calls POST /api/payment/initiate
2. initiate.js validates → inserts pending tip → calls MyFatoorah → returns paymentUrl
3. Browser redirects to MyFatoorah KNET page
4. Supporter pays
5. MyFatoorah fires POST /api/webhook/myfatoorah (server-to-server)
6. Webhook marks tip paid → Supabase trigger updates balance → WhatsApp fires
7. MyFatoorah redirects browser to /[handle]?success=1

## Environment variables needed (.env.local)
See .env.local file — fill in all values before running.

## Storage buckets to create in Supabase
- avatars (public)
- selfies (private)  
- voice-notes (private)

## Supabase RLS
- Supporters can INSERT tips without auth (status must be 'pending')
- Creators can only read/update their own row
- God admin uses service_role key — bypasses all RLS

## Important: MyFatoorah
- Sandbox: apitest.myfatoorah.com (change MF_BASE_URL in lib/myfatoorah.js)
- Production: api.myfatoorah.com
- Kuwait requires KNET gateway approval from MyFatoorah team
- Webhook must be registered in MyFatoorah dashboard

## Important: WhatsApp
- Use Meta Business WhatsApp API (graph.facebook.com/v19.0)
- Register webhook at Meta Developers → WhatsApp → Configuration
- Creator replies arrive as inbound messages at /api/whatsapp/inbound
- Voice notes: download from WhatsApp → upload to Supabase Storage → forward to supporter

## Design language
- Font: Syne (headings), Tajawal (Arabic body), DM Sans (numbers/English)
- Colors: black #0D0D0D, cream #FAFAF7, accent #C8F55A
- Style: bold Syne headings, chunky black borders with 3px offset box-shadows
- Direction: RTL Arabic primary, bilingual
- Dark creator dashboard: background #080808, surface #0F0F0F
- Light tipping pages: background from creator's theme_bg

## Run locally
```bash
npm install
npm run dev
```
