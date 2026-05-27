import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import crypto from 'crypto';

const MAX_ATTEMPTS = 6;

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone, code } = await req.json();
  if (!phone || !code) return Response.json({ error: 'Missing fields' }, { status: 400 });

  const cleanPhone = String(phone).replace(/\s+/g, '');
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from('otp_codes').select('*')
    .eq('creator_id', user.id).eq('phone', cleanPhone)
    .maybeSingle();

  if (!row) return Response.json({ error: 'اطلب رمزاً جديداً' }, { status: 400 });

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from('otp_codes').delete().eq('id', row.id);
    return Response.json({ error: 'انتهت صلاحية الرمز، اطلب رمزاً جديداً' }, { status: 400 });
  }

  // attempt cap — defeat brute force of the 6-digit space
  if (row.attempts >= MAX_ATTEMPTS) {
    await supabase.from('otp_codes').delete().eq('id', row.id);
    return Response.json({ error: 'تجاوزت عدد المحاولات، اطلب رمزاً جديداً' }, { status: 429 });
  }

  const hash = crypto.createHash('sha256').update(String(code)).digest('hex');
  if (row.code_hash !== hash) {
    await supabase.from('otp_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
    return Response.json({ error: 'رمز خاطئ' }, { status: 400 });
  }

  // success — record verified phone, mark verification, clear the code
  await supabase.from('creators')
    .update({ phone: cleanPhone, whatsapp_number: cleanPhone })
    .eq('id', user.id);

  await supabase.from('verifications').upsert(
    { creator_id: user.id, phone_verified: true, phone_verified_at: new Date().toISOString() },
    { onConflict: 'creator_id' }
  );

  await supabase.from('otp_codes').delete().eq('id', row.id);

  return Response.json({ success: true });
}
