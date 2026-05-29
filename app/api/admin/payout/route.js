// Admin moves a payout through its lifecycle. The DB trigger
// deduct_payout_balance() adjusts the creator balance on status change.
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';
import { notifyPayoutPaid } from '@/lib/adminNotify';
import { revalidatePath } from 'next/cache';

const NEXT = {
  approve: 'approved',
  pay:     'paid',
  reject:  'rejected',
};

export async function POST(req) {
  if (!(await getAdminUser())) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { payoutId, action, notes } = await req.json();
  const status = NEXT[action];
  if (!payoutId || !status) return Response.json({ error: 'Bad request' }, { status: 400 });

  const update = { status, reviewer_notes: notes || null };
  if (status === 'paid') update.paid_at = new Date().toISOString();

  const admin = createAdminClient();
  const { error } = await admin
    .from('payouts')
    .update(update)
    .eq('id', payoutId);

  if (error) {
    console.error('[admin/payout]', error);
    return Response.json({ error: 'DB error' }, { status: 500 });
  }

  // When a payout flips to 'paid', email the creator confirming the
  // transfer. Look up amount + creator email from the row + creators join.
  if (status === 'paid') {
    try {
      const { data: po } = await admin
        .from('payouts')
        .select('amount_kd, creators(email)')
        .eq('id', payoutId)
        .maybeSingle();
      const creatorEmail = po?.creators?.email;
      if (creatorEmail) {
        notifyPayoutPaid({ creatorEmail, amount: po.amount_kd })
          .catch((err) => console.error('[admin/payout] notify paid', err));
      }
    } catch (err) {
      console.error('[admin/payout] notify lookup failed', err);
    }
  }

  // creator balance changed (deduct trigger) + payout list/status changed
  revalidatePath('/admin/payouts');
  revalidatePath('/admin');
  return Response.json({ success: true });
}
