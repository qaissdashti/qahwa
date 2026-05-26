/**
 * pages/api/payment/callback.js
 * GET /api/payment/callback?tipId=xxx
 *
 * MyFatoorah redirects the supporter here after payment.
 * The webhook should have already fired and processed the tip.
 * This route is the safety net — it verifies payment status and
 * redirects the supporter to the correct page.
 *
 * Success → /{creatorHandle}?success=1&tipId=xxx
 * Failure → /{creatorHandle}?error=payment_failed
 */

import { supabaseAdmin } from '../../../lib/supabase';
import { getPaymentStatus } from '../../../lib/myfatoorah';

export default async function handler(req, res) {
  const { tipId, paymentId } = req.query;

  if (!tipId) return res.redirect('/');

  try {
    // Fetch the tip from our DB
    const { data: tip, error } = await supabaseAdmin
      .from('tips')
      .select('id, status, myfatoorah_invoice_id, creators(handle)')
      .eq('id', tipId)
      .single();

    if (error || !tip) return res.redirect('/?error=not_found');

    const creatorHandle = tip.creators?.handle || '';

    // If webhook already processed it — great, just redirect
    if (tip.status === 'paid') {
      return res.redirect(`/${creatorHandle}?success=1&tipId=${tipId}`);
    }

    // Webhook may not have fired yet (race condition) — check MyFatoorah directly
    if (tip.myfatoorah_invoice_id) {
      const { isPaid, paymentId: mfPaymentId, method, paidAt } = await getPaymentStatus(tip.myfatoorah_invoice_id);

      if (isPaid) {
        // Manually mark paid (webhook may still come and is idempotent)
        await supabaseAdmin
          .from('tips')
          .update({
            status:                 'paid',
            paid_at:                paidAt || new Date().toISOString(),
            payment_method:         method,
            myfatoorah_payment_id:  mfPaymentId,
          })
          .eq('id', tipId)
          .eq('status', 'pending'); // only update if still pending

        return res.redirect(`/${creatorHandle}?success=1&tipId=${tipId}`);
      }
    }

    // Payment not confirmed
    return res.redirect(`/${creatorHandle}?error=payment_failed`);

  } catch (err) {
    console.error('[callback]', err);
    return res.redirect('/?error=server_error');
  }
}
