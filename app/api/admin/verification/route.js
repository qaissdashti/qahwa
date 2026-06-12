import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';
import { notifyCreatorApproved, notifyCreatorRejected } from '@/lib/adminNotify';
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

  // Grab handle + email + full_name up-front so we know which public
  // page to revalidate AND can fire the post-decision creator email
  // without a second round-trip after the updates land. terms_accepted_at
  // is pulled for the approval safety-net check below.
  const { data: cInfo } = await admin.from('creators')
    .select('handle, full_name, email, terms_accepted_at').eq('id', creatorId).maybeSingle();

  // Safety net: never approve a creator who hasn't accepted the Terms &
  // Conditions, even if the admin UI filter is bypassed. (Rejection is
  // always allowed — it doesn't activate the page.)
  if (approved && !cInfo?.terms_accepted_at) {
    return Response.json(
      { error: 'Creator has not accepted Terms and Conditions' },
      { status: 422 }
    );
  }

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

  // Fire-and-forget creator email — same pattern as notifyPayoutPaid
  // in app/api/admin/payout/route.js. The helper swallows its own
  // errors so a misconfigured email provider can never break the admin
  // action. Language preference isn't stored anywhere, so the notifier
  // falls back to an Arabic-script heuristic on the display name and
  // ultimately to English.
  if (cInfo?.email) {
    const args = {
      creatorEmail: cInfo.email,
      fullName:     cInfo.full_name,
      handle:       cInfo.handle,
    };
    if (approved) {
      notifyCreatorApproved(args)
        .catch((err) => console.error('[admin/verification] notifyApproved', err));
    } else {
      notifyCreatorRejected({ ...args, reasonNote: notes })
        .catch((err) => console.error('[admin/verification] notifyRejected', err));
    }
  }

  return Response.json({ success: true });
}
