import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req) {
  if (!(await getAdminUser())) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { creatorId, action, notes } = await req.json();
  if (!creatorId || !['approve', 'reject'].includes(action)) {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (action === 'approve') {
    await admin.from('creators')
      .update({ is_verified: true, verification_status: 'approved' })
      .eq('id', creatorId);
    await admin.from('verifications')
      .update({ status: 'approved', reviewed_at: now, reviewer_notes: notes || null })
      .eq('creator_id', creatorId);
  } else {
    await admin.from('creators')
      .update({ is_verified: false, verification_status: 'rejected' })
      .eq('id', creatorId);
    await admin.from('verifications')
      .update({ status: 'rejected', reviewed_at: now, reviewer_notes: notes || null })
      .eq('creator_id', creatorId);
  }

  return Response.json({ success: true });
}
