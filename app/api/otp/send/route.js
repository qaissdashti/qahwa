import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { sendOTP } from '@/lib/whatsapp';
import crypto from 'crypto';

const E164 = /^\+?[1-9]\d{6,14}$/;

export async function POST(req) {
  // creator is derived from the session, never trusted from the body
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone } = await req.json();
  if (!phone || !E164.test(phone.replace(/\s+/g, ''))) {
    return Response.json({ error: 'رقم غير صحيح' }, { status: 400 });
  }

  const cleanPhone = phone.replace(/\s+/g, '');
  const code    = String(Math.floor(100000 + Math.random() * 900000));
  const hash    = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('otp_codes')
    .upsert({ creator_id: user.id, phone: cleanPhone, code_hash: hash, expires_at: expires },
            { onConflict: 'creator_id,phone' });

  if (error) {
    console.error('[otp/send]', error);
    return Response.json({ error: 'تعذّر إنشاء الرمز' }, { status: 500 });
  }

  try {
    await sendOTP({ phone: cleanPhone, code, creatorId: user.id });
  } catch (err) {
    // In dev (no WhatsApp creds) the send fails — surface that clearly.
    console.error('[otp/send] WhatsApp send failed:', err);
    return Response.json({ error: 'تعذّر إرسال الرمز عبر واتساب' }, { status: 502 });
  }

  return Response.json({ success: true });
}
