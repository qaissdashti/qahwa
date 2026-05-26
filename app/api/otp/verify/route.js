import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone, code } = await req.json();
  if (!phone || !code) return Response.json({ error: 'Missing fields' }, { status: 400 });

  const cleanPhone = phone.replace(/\s+/g, '');
  const hash = crypto.createHash('sha256').update(String(code)).digest('hex');
  const supabase = createAdminClient();

  const { data: otp } = await supabase
    .from('otp_codes').select('*')
    .eq('creator_id', user.id).eq('phone', cleanPhone).eq('code_hash', hash)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!otp) return Response.json({ error: 'رمز خاطئ أو منتهي الصلاحية' }, { status: 400 });

  // record verified phone on the creator + verification row
  await supabase.from('creators')
    .update({ phone: cleanPhone, whatsapp_number: cleanPhone })
    .eq('id', user.id);

  await supabase.from('verifications')
    .upsert(
      { creator_id: user.id, phone_verified: true, phone_verified_at: new Date().toISOString() },
      { onConflict: 'creator_id' }
    );

  await supabase.from('otp_codes').delete().eq('id', otp.id);

  return Response.json({ success: true });
}
