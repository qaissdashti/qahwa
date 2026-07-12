// ============================================================
// FILE: /app/api/payment/callback-knet/route.js
// PURPOSE: KNET KPAY posts the payer's browser back here after payment.
//          We decrypt + verify the response SERVER-SIDE (amount + result),
//          then mark the tip paid and email the creator — exactly once.
//
// Parallel to /app/api/payment/callback-card/route.js — same atomic
// mark-paid pattern, same redirect destinations, same NEXT_REDIRECT
// re-throw handling. KNET differs: it's a URL-encoded form POST, and
// the payment result arrives encrypted in the `trandata` param.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { decryptTrandata } from '@/lib/knet';
import { notifyCreatorNewTip } from '@/lib/adminNotify';
import { redirect } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    // KNET sends a URL-encoded form POST to the responseURL (via the
    // payer's browser), not JSON or query params.
    const form = await req.formData();

    // ── 1. GATEWAY-LEVEL ERROR ───────────────────────────────
    // If KNET couldn't even process the request it returns Error/ErrorText
    // instead of trandata. Never mark anything paid in this case.
    const errorParam = form.get('Error');
    const errorText  = form.get('ErrorText');
    if (errorParam || errorText) {
      console.error('[callback-knet] KNET returned error:', {
        Error: errorParam, ErrorText: errorText,
      });
      redirect('/error?reason=payment_failed');
    }

    // ── 2. DECRYPT THE RESPONSE ──────────────────────────────
    // Decryption failure = tampered/garbage payload → fail closed.
    let data;
    try {
      data = decryptTrandata(String(form.get('trandata') || ''));
    } catch (decryptErr) {
      console.error('[callback-knet] trandata decrypt failed:', decryptErr);
      redirect('/error?reason=payment_failed');
    }

    // The manual mandates merchants log the full response. It contains no
    // card data (PAN/CVV are never returned) — only payment identifiers.
    console.log('[callback-knet] KNET response:', data);

    const { result, trackid, paymentid, tranid, ref, amt } = data;

    // ── 3. FIND THE TIP ──────────────────────────────────────
    // Pull the supporter/tip details + creator email & name so we can fire
    // the "new tip" email from here (this callback is the confirmation path).
    const { data: tip } = await supabase
      .from('tips')
      .select(`
        id, creator_id, status,
        supporter_name, cups, gross_amount_kd, message,
        creators(handle, email, full_name)
      `)
      .eq('knet_track_id', String(trackid))
      .single();

    if (!tip) {
      console.error('[callback-knet] tip not found for trackid:', trackid);
      redirect('/error?reason=tip_not_found');
    }

    // ── 4. VERIFY AMOUNT ─────────────────────────────────────
    // Guard against a tampered amount — compare at 3-decimal (fils) precision.
    if (Number(amt).toFixed(3) !== Number(tip.gross_amount_kd).toFixed(3)) {
      console.error('[callback-knet] amount mismatch — not marking paid', {
        trackid, received: amt, expected: tip.gross_amount_kd,
      });
      redirect('/error?reason=payment_failed');
    }

    // ── 5. VERIFY RESULT ─────────────────────────────────────
    // Only CAPTURED is a successful payment. Anything else (NOT CAPTURED,
    // CANCELED, HOST TIMEOUT, …) is a failure — do NOT mark paid.
    if (result !== 'CAPTURED') {
      console.error('[callback-knet] non-captured result — not marking paid', { trackid, result });
      redirect('/error?reason=payment_failed');
    }

    // ── 6. MARK TIP AS PAID (ATOMIC) ─────────────────────────
    // The .neq('status','paid') makes the not-paid → paid transition
    // win-once. .select() returns the affected row only to the winner; a
    // duplicate POST (payer refreshes) gets an empty array and skips the
    // email — guaranteeing exactly one notification and one balance credit.
    // The trigger update_creator_balance() fires on this update.
    const { data: claimed } = await supabase
      .from('tips')
      .update({
        status:    'paid',
        paid_at:   new Date().toISOString(),
        knet_payment_id:     paymentid || null,
        knet_transaction_id: tranid    || null,
        knet_ref:            ref       || null,
        payment_method:      'knet',
      })
      .eq('id', tip.id)
      .neq('status', 'paid')
      .select('id');

    if (claimed && claimed.length > 0) {
      // We won the race — send the creator's tip notification email.
      // The helper swallows its own errors, but we still guard so a
      // notify failure can never block the payer's redirect. Awaited so
      // it completes before redirect() ends the serverless invocation.
      try {
        const creator = tip.creators || {};
        console.log('[callback-knet] tip marked paid — sending new-tip email', {
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
        console.error('[callback-knet] new-tip email failed:', notifyError);
      }
    } else {
      console.log('[callback-knet] tip already paid — skipping email (duplicate POST)', { tipId: tip.id });
    }

    // Redirect payer to thank-you screen
    redirect(`/${tip.creators.handle}?success=1&tip=${tip.id}`);

  } catch (err) {
    // next/navigation's redirect() works by throwing a NEXT_REDIRECT error.
    // Re-throw it so Next.js can perform the redirect instead of treating
    // an intended redirect as an unexpected failure.
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    console.error('[callback-knet] Error:', err);
    redirect('/error?reason=unexpected');
  }
}
