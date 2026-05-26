// ============================================================
// FILE: /app/api/payment/callback/route.js
// PURPOSE: MyFatoorah redirects supporter here after payment.
//          We verify via API (backup to webhook) then redirect
//          to thank-you page or error page.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { getPaymentStatus } from '@/lib/myfatoorah';
import { redirect } from 'next/navigation';

const supabase = createClient(
  process.env.SUPABASE_URL,
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

    // Find the tip
    const { data: tip } = await supabase
      .from('tips')
      .select('id, creator_id, status, creators(handle)')
      .eq('myfatoorah_invoice_id', invoiceId)
      .single();

    if (!tip) redirect('/error?reason=tip_not_found');

    // Webhook may have already marked it paid — that is fine
    // If not (webhook delayed), mark it now
    if (tip.status !== 'paid') {
      await supabase
        .from('tips')
        .update({
          status:    'paid',
          paid_at:   new Date().toISOString(),
          myfatoorah_payment_id: paymentId,
        })
        .eq('id', tip.id);
    }

    // Redirect supporter to thank-you screen
    redirect(`/${tip.creators.handle}?success=1&tip=${tip.id}`);

  } catch (err) {
    console.error('[callback] Error:', err);
    redirect('/error?reason=unexpected');
  }
}
