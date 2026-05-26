import { createAdminClient } from '@/lib/supabase';
import crypto from 'crypto';
export async function POST(req) {
  const { phone, code, creatorId } = await req.json();
  if (!phone || !code || !creatorId) return Response.json({ error: 'Missing fields' }, { status: 400 });
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const supabase = createAdminClient();
  const { data: otp } = await supabase
    .from('otp_codes').select('*')
    .eq('creator_id', creatorId).eq('phone', phone).eq('code_hash', hash)
    .gte('expires_at', new Date().toISOString()).single();
  if (!otp) return Response.json({ error: 'رمز خاطئ أو منتهي الصلاحية' }, { status: 400 });
  await supabase.from('creators').update({ phone }).eq('id', creatorId);
  await supabase.from('otp_codes').delete().eq('id', otp.id);
  return Response.json({ success: true });
}
