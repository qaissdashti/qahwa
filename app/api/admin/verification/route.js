import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function POST(req) {
  if (!(await getAdminUser())) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { creatorId, action, notes } = await req.json();
  if (!creatorId || !['approve', 'reject'].includes(action)) {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const approved = action === 'approve';

  // Grab the handle up-front so we know which public page to revalidate.
  const { data: cInfo } = await admin.from('creators')
    .select('handle').eq('id', creatorId).maybeSingle();

  // Update creators (is_verified + verification_status) AND the verifications
  // row together; surface an error if either fails so they can't drift.
  const { error: cErr } = await admin.from('creators')
    .update({ is_verified: approved, verification_status: approved ? 'approved' : 'rejected' })
    .eq('id', creatorId);

  const { error: vErr } = await admin.from('verifications')
    .update({ status: approved ? 'approved' : 'rejected', reviewed_at: now, reviewer_notes: notes || null })
    .eq('creator_id', creatorId);

  if (cErr || vErr) {
    console.error('[admin/verification]', cErr || vErr);
    return Response.json({ error: 'Update failed' }, { status: 500 });
  }

  // Bust the cached server renders so the queue + creators list update.
  revalidatePath('/admin/verifications');
  revalidatePath('/admin/creators');
  revalidatePath('/admin');

  // Bust the creator's PUBLIC page cache too — so visitors immediately
  // see the live tipping page (approve) / pending page (reject) without
  // needing to hard-refresh. We hit both the static path and the dynamic
  // segment shape so any cached variant is invalidated.
  if (cInfo?.handle) {
    revalidatePath(`/${cInfo.handle}`);
    revalidatePath('/[username]', 'page');
  }

  return Response.json({ success: true });
}
