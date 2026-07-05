// ============================================================
// FILE: /app/api/payment/callback-card/route.js
// PURPOSE: MPGS returns the supporter here after the hosted card page.
//          We verify the order SERVER-SIDE via the MPGS REST API (the
//          browser redirect is never trusted on its own), then mark the
//          tip paid and email the creator — exactly once.
//
// Parallel to /app/api/webhook/myfatoorah/route.js — same atomic
// mark-paid pattern so balance credit + notification fire once.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { getOrderStatus } from '@/lib/mpgs';
import { notifyCreatorNewTip } from '@/lib/adminNotify';
import { redirect } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    redirect('/error?reason=no_order_id');
  }

  try {
    // ── VERIFY SERVER-SIDE ───────────────────────────────────
    // Source of truth: ask MPGS directly. Never trust the redirect.
    const { isPaid, transactionId, brand } = await getOrderStatus(orderId);

    if (!isPaid) {
      redirect('/error?reason=payment_failed');
    }

    // Find the tip — pull the supporter/tip details + creator email &
    // name so we can fire the "new tip" email from here (this callback
    // is the primary confirmation path for the card rail).
    const { data: tip } = await supabase
      .from('tips')
      .select(`
        id, creator_id, status,
        supporter_name, cups, gross_amount_kd, message,
        creators(handle, email, full_name)
      `)
      .eq('mpgs_order_id', String(orderId))
      .single();

    if (!tip) redirect('/error?reason=tip_not_found');

    // Mark-paid atomically: the .neq('status','paid') makes the not-paid →
    // paid transition win-once. .select() returns the affected row only to
    // the winner; a duplicate return (supporter refreshes) gets an empty
    // array and skips the email — guaranteeing exactly one notification and
    // one balance credit. The trigger update_creator_balance() fires on this update.
    const { data: claimed } = await supabase
      .from('tips')
      .update({
        status:    'paid',
        paid_at:   new Date().toISOString(),
        mpgs_transaction_id: transactionId,
        payment_method: normaliseBrand(brand),
      })
      .eq('id', tip.id)
      .neq('status', 'paid')
      .select('id');

    if (claimed && claimed.length > 0) {
      // We won the race — send the creator's tip notification email.
      // The helper swallows its own errors, but we still guard so a
      // notify failure can never block the supporter's redirect. Awaited
      // so it completes before redirect() ends the serverless invocation.
      try {
        const creator = tip.creators || {};
        console.log('[callback-card] tip marked paid — sending new-tip email', {
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
        console.error('[callback-card] new-tip email failed:', notifyError);
      }
    } else {
      console.log('[callback-card] tip already paid — skipping email (duplicate return)', { tipId: tip.id });
    }

    // Redirect supporter to thank-you screen
    redirect(`/${tip.creators.handle}?success=1&tip=${tip.id}`);

  } catch (err) {
    // next/navigation's redirect() works by throwing a NEXT_REDIRECT error.
    // Re-throw it so Next.js can perform the redirect instead of treating
    // an intended redirect as an unexpected failure.
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    console.error('[callback-card] Error:', err);
    redirect('/error?reason=unexpected');
  }
}

function normaliseBrand(brand = '') {
  const b = brand.toLowerCase();
  if (b.includes('master')) return 'mastercard';
  if (b.includes('visa'))   return 'visa';
  if (b.includes('amex') || b.includes('american')) return 'amex';
  // No brand reported → generic 'card'.
  return b || 'card';
}
