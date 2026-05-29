// Receives the selfie upload, stores it in the private `selfies` bucket,
// and moves the creator into 'under_review' to finalise onboarding.
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { notifyAdminPendingReview } from '@/lib/adminNotify';

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('selfie');
  if (!file || typeof file === 'string') {
    return Response.json({ error: 'لا توجد صورة' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return Response.json({ error: 'صيغة الصورة غير مدعومة' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'حجم الصورة كبير (الحد 6MB)' }, { status: 400 });
  }

  // require phone + civil id already done before finalising
  const supabase = createAdminClient();
  const { data: v } = await supabase
    .from('verifications')
    .select('phone_verified, civil_id_encrypted')
    .eq('creator_id', user.id)
    .maybeSingle();

  // Phone-verification is only required when WhatsApp is actually
  // configured (real Meta token or local dev bypass). On a deployment
  // where WhatsApp isn't wired up yet, step 3 was skipped — so we don't
  // gate selfie submission on phone_verified here.
  const whatsappOk =
    (!!process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_API_TOKEN.trim()) ||
    (process.env.DEV_OTP_BYPASS === 'true' && process.env.NODE_ENV !== 'production');

  if (!v?.civil_id_encrypted || (whatsappOk && !v?.phone_verified)) {
    return Response.json({ error: 'أكمل الخطوات السابقة أولاً' }, { status: 400 });
  }

  const ext  = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/selfie-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('selfies')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (upErr) {
    console.error('[verify/selfie] upload', upErr);
    return Response.json({ error: 'تعذّر رفع الصورة' }, { status: 500 });
  }

  await supabase.from('verifications')
    .update({ selfie_url: path, status: 'under_review' })
    .eq('creator_id', user.id);

  await supabase.from('creators')
    .update({ verification_status: 'under_review' })
    .eq('id', user.id);

  // Fire-and-forget admin notification. Never block the response on it —
  // the notify helper swallows its own errors so onboarding always succeeds.
  try {
    const { data: c } = await supabase
      .from('creators')
      .select('full_name, handle, email')
      .eq('id', user.id)
      .maybeSingle();

    // Don't await — but do log if it rejects (it shouldn't, helper is safe).
    notifyAdminPendingReview({
      fullName: c?.full_name,
      handle:   c?.handle,
      email:    c?.email || user.email,
    }).catch((err) => console.error('[verify/selfie] notifyAdmin', err));
  } catch (err) {
    console.error('[verify/selfie] notify lookup failed', err);
  }

  return Response.json({ success: true });
}
