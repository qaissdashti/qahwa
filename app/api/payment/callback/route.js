// ============================================================
// FILE: /app/api/payment/callback/route.js
// PURPOSE: MyFatoorah redirects supporter here after payment.
//          We verify via API (backup to webhook) then redirect
//          to thank-you page or error page.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { getPaymentStatus } from '@/lib/myfatoorah';
import { notifyCreatorNewTip } from '@/lib/adminNotify';
import { redirect } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get('paymentId');

  if (!paymentId) {
    redirect('/error?reason=no_payment_id');
  }

  try {
    // Verify with MyFatoorah API directly
    const { isPaid, invoiceId } = await getPaymentStatus(paymentId);

    if (!isPaid) {
      redirect('/error?reason=payment_failed');
    }

    // Find the tip — pull the supporter/tip details + creator email &
    // name so we can fire the "new tip" email here too (the webhook is
    // the primary path, but in sandbox it often never fires).
    const { data: tip } = await supabase
      .from('tips')
      .select(`
        id, creator_id, status,
        supporter_name, cups, gross_amount_kd, message,
        creators(handle, email, full_name)
      `)
      .eq('myfatoorah_invoice_id', invoiceId)
      .single();

    if (!tip) redirect('/error?reason=tip_not_found');

    // Webhook may have already marked it paid — that is fine.
    // If not (webhook delayed or, in sandbox, never fires), mark it now
    // AND send the creator's tip notification email. Gating both on the
    // not-yet-paid status keeps it idempotent: if the webhook already
    // ran, it already marked paid + emailed, so we skip here and never
    // double-send.
    if (tip.status !== 'paid') {
      await supabase
        .from('tips')
        .update({
          status:    'paid',
          paid_at:   new Date().toISOString(),
          myfatoorah_payment_id: paymentId,
        })
        .eq('id', tip.id);

      // Tip notification email (replaces the old WhatsApp notify). The
      // helper swallows its own errors, but we still guard so a notify
      // failure can never block the supporter's redirect. Awaited so it
      // completes before redirect() ends the serverless invocation.
      try {
        const creator = tip.creators || {};
        console.log('[callback] tip marked paid — sending new-tip email', {
          tipId: tip.id,
          creatorEmail: creator.email || '(none)',
        });
        await notifyCreatorNewTip({
          creatorEmail:  creator.email,
          fullName:      creator.full_name,
          supporterName: tip.supporter_name,
          cups:          tip.cups,
          amount:        tip.gross_amount_kd,
          message:       tip.message,
          handle:        creator.handle,
        });
        await supabase
          .from('tips')
          .update({ whatsapp_notified_at: new Date().toISOString() })
          .eq('id', tip.id);
      } catch (notifyError) {
        console.error('[callback] new-tip email failed:', notifyError);
      }
    }

    // Redirect supporter to thank-you screen
    redirect(`/${tip.creators.handle}?success=1&tip=${tip.id}`);

  } catch (err) {
    // next/navigation's redirect() works by throwing a NEXT_REDIRECT error.
    // Re-throw it so Next.js can perform the redirect instead of treating
    // an intended redirect as an unexpected failure.
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    console.error('[callback] Error:', err);
    redirect('/error?reason=unexpected');
  }
}
