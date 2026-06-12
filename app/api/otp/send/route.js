import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppOTP } from '@/lib/twilio';
import crypto from 'crypto';

const E164 = /^\+?[1-9]\d{6,14}$/;
const COOLDOWN_SEC = 60;   // min seconds between sends
const MAX_SENDS    = 6;    // max sends per active code window
const TTL_MS       = 10 * 60 * 1000;

// Dev-only: skip WhatsApp delivery and surface the code instead. Hard-gated
// so it can never activate in production even if the flag leaks into env.
const BYPASS = process.env.DEV_OTP_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone } = await req.json();
  const cleanPhone = String(phone || '').replace(/\s+/g, '');
  if (!E164.test(cleanPhone)) {
    return Response.json({ error: 'رقم غير صحيح' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── rate limiting against the existing code row ──────────────
  const { data: existing } = await supabase
    .from('otp_codes')
    .select('last_sent_at, sends, expires_at')
    .eq('creator_id', user.id).eq('phone', cleanPhone)
    .maybeSingle();

  const active = existing && new Date(existing.expires_at).getTime() > Date.now();
  if (active) {
    const sinceMs = Date.now() - new Date(existing.last_sent_at).getTime();
    if (sinceMs < COOLDOWN_SEC * 1000) {
      const wait = Math.ceil((COOLDOWN_SEC * 1000 - sinceMs) / 1000);
      return Response.json({ error: `انتظر ${wait} ثانية قبل إعادة الإرسال` }, { status: 429 });
    }
    if (existing.sends >= MAX_SENDS) {
      return Response.json({ error: 'تجاوزت عدد المحاولات، حاول بعد قليل' }, { status: 429 });
    }
  }

  // Dev bypass uses a fixed, well-known code (000000) so it's predictable
  // for local testing; real WhatsApp delivery still uses a random 6-digit.
  const code    = BYPASS ? '000000' : String(Math.floor(100000 + Math.random() * 900000));
  const hash    = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + TTL_MS).toISOString();
  const sends   = active ? existing.sends + 1 : 1;

  const { error } = await supabase.from('otp_codes').upsert(
    {
      creator_id: user.id, phone: cleanPhone, code_hash: hash, expires_at: expires,
      last_sent_at: new Date().toISOString(), sends, attempts: 0,
    },
    { onConflict: 'creator_id,phone' }
  );
  if (error) {
    console.error('[otp/send]', error);
    return Response.json({ error: 'تعذّر إنشاء الرمز' }, { status: 500 });
  }

  // ── dev bypass: don't hit WhatsApp, return the code ──────────
  if (BYPASS) {
    console.log(`[otp/send] DEV BYPASS — code for ${cleanPhone}: ${code}`);
    return Response.json({ success: true, devCode: code });
  }

  try {
    await sendWhatsAppOTP({ phone: cleanPhone, code });
  } catch (err) {
    console.error('[otp/send] WhatsApp send failed:', err);
    return Response.json({ error: 'تعذّر إرسال الرمز عبر واتساب' }, { status: 502 });
  }

  return Response.json({ success: true });
}
