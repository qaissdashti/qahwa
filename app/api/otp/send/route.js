import { createAdminClient } from '@/lib/supabase';
import { sendOTP } from '@/lib/whatsapp';
import crypto from 'crypto';
export async function POST(req) {
  const { phone, creatorId } = await req.json();
  if (!phone || !creatorId) return Response.json({ error: 'Missing fields' }, { status: 400 });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const supabase = createAdminClient();
  await supabase.from('otp_codes').upsert({ creator_id: creatorId, phone, code_hash: hash, expires_at: expires });
  await sendOTP({ phone, code, creatorId });
  return Response.json({ success: true });
}
