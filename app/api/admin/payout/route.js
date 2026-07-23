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

  // When a payout flips to 'paid', email the creator with the full
  // transfer breakdown (amount + bank + masked-IBAN tail + 24h SLA).
  // The payouts row already snapshots bank_name and the plain `iban`
  // at request time (see /api/creator/payout) so we don't need to
  // re-decrypt the encrypted column on creators.
  if (status === 'paid') {
    try {
      const { data: po } = await admin
        .from('payouts')
        .select('amount_kd, fee_kd, bank_name, iban, creators(email, full_name)')
        .eq('id', payoutId)
        .maybeSingle();
      const creatorEmail = po?.creators?.email;
      if (creatorEmail) {
        await notifyPayoutPaid({
          creatorEmail,
          fullName:   po.creators.full_name,
          amount:     po.amount_kd,
          fee:        po.fee_kd,
          bankName:   po.bank_name,
          // notifier handles the last-4 masking itself; we just pass
          // whatever IBAN snapshot the payout row has (plain or already
          // masked — both end up rendered as "ending in XXXX").
          ibanMasked: po.iban,
        }).catch((err) => console.error('[admin/payout] notify paid', err));
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
