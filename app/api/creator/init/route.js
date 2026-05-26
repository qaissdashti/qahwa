// Ensures the authenticated user has a creators row. Idempotent.
// Called right after signup (and as a safety net from /verify) so the
// row exists before anything FK-references it (e.g. otp_codes).
// Belt-and-suspenders alongside the handle_new_user() DB trigger.
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const meta = user.user_metadata || {};
  const full_name = String(body.full_name ?? meta.full_name ?? '').trim();
  let handle = String(body.handle ?? meta.handle ?? '')
    .toLowerCase().replace(/[^a-z0-9_]/g, '');

  const admin = createAdminClient();

  // already has a row (trigger or prior call) → nothing to do
  const { data: existing } = await admin
    .from('creators').select('id').eq('id', user.id).maybeSingle();
  if (existing) return Response.json({ success: true, created: false });

  // only claim the handle if valid and not already taken by someone else
  if (handle.length >= 3 && handle.length <= 30) {
    const { data: taken } = await admin
      .from('creators').select('id').eq('handle', handle).maybeSingle();
    if (taken) handle = null;
  } else {
    handle = null;
  }

  const { error } = await admin.from('creators').insert({
    id: user.id,
    email: user.email,
    full_name,
    handle,
  });

  if (error) {
    console.error('[creator/init]', error);
    return Response.json({ error: 'تعذّر إنشاء الحساب' }, { status: 500 });
  }
  return Response.json({ success: true, created: true });
}
