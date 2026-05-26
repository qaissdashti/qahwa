// Returns a short-lived signed URL for a creator's selfie (private bucket).
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req) {
  if (!(await getAdminUser())) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { creatorId } = await req.json();
  if (!creatorId) return Response.json({ error: 'creatorId required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: v } = await admin
    .from('verifications').select('selfie_url').eq('creator_id', creatorId).maybeSingle();

  if (!v?.selfie_url) return Response.json({ error: 'لا توجد صورة' }, { status: 404 });

  const { data, error } = await admin.storage
    .from('selfies')
    .createSignedUrl(v.selfie_url, 60 * 5); // 5 minutes

  if (error || !data) return Response.json({ error: 'تعذّر إنشاء الرابط' }, { status: 500 });
  return Response.json({ url: data.signedUrl });
}
