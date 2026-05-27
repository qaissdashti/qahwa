// Uploads a creator avatar to the public `avatars` bucket and stores the URL.
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('avatar');
  if (!file || typeof file === 'string') {
    return Response.json({ error: 'لا توجد صورة' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return Response.json({ error: 'صيغة غير مدعومة (JPG/PNG/WebP)' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'حجم الصورة كبير (الحد 4MB)' }, { status: 400 });
  }

  const ext  = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from('avatars')
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) {
    console.error('[creator/avatar] upload', upErr);
    return Response.json({ error: 'تعذّر رفع الصورة' }, { status: 500 });
  }

  // avatars bucket is public → public URL is fine
  const { data } = admin.storage.from('avatars').getPublicUrl(path);
  await admin.from('creators').update({ avatar_url: data.publicUrl }).eq('id', user.id);

  return Response.json({ success: true, url: data.publicUrl });
}
