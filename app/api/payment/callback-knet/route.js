// ============================================================
// FILE: /app/api/payment/callback-knet/route.js
// PURPOSE: KNET KPAY posts the payer's browser back here after payment.
//          We decrypt + verify the response SERVER-SIDE (amount + result),
//          then mark the tip paid and email the creator — exactly once.
//
// Parallel to /app/api/payment/callback-card/route.js — same atomic
// mark-paid pattern and same destinations. KNET differs: it's a
// server-to-server URL-encoded form POST, the payment result arrives
// encrypted in the `trandata` param, and per the KNET manual (K-064 §5)
// we must NOT reply with an HTTP redirect — instead we return a 200
// plain-text "REDIRECT=<absolute url>" line and KNET redirects the
// customer's browser itself.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { decryptTrandata } from '@/lib/knet';
import { notifyCreatorNewTip } from '@/lib/adminNotify';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// KNET reads a plain-text "REDIRECT=<url>" line from our 200 response and
// redirects the customer's browser itself (K-064 §5). We must NOT reply
// with an HTTP redirect on this server-to-server notification.
function knetRedirect(url) {
  return new Response(`REDIRECT=${url}`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

export async function POST(req) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // KNET sends a URL-encoded body to the responseURL, but its
    // Content-Type header isn't reliably one that req.formData() accepts
    // (it throws a TypeError on anything but multipart / x-www-form-
    // urlencoded). So read the RAW body and parse it as URL-encoded
    // ourselves — header-agnostic. Same field names (trandata, Error, …).
    const raw = await req.text();
    const form = new URLSearchParams(raw);

    // ── 1. GATEWAY-LEVEL ERROR ───────────────────────────────
    // If KNET couldn't even process the request it returns Error/ErrorText
    // instead of trandata. Never mark anything paid in this case.
    const errorParam = form.get('Error');
    const errorText  = form.get('ErrorText');
    if (errorParam || errorText) {
      console.error('[callback-knet] KNET returned error:', {
        Error: errorParam, ErrorText: errorText,
      });
      return knetRedirect(`${appUrl}/error?reason=payment_failed`);
    }

    // ── 2. DECRYPT THE RESPONSE ──────────────────────────────
    // Extract the encrypted trandata hex robustly. Normally KNET posts
    // "trandata=<hex>", but in practice it sometimes posts the BARE hex
    // blob with no field name — URLSearchParams then parses the whole hex
    // as a single key with an empty value, so form.get('trandata') is ''.
    // Prefer the named field; else fall back to the raw body as the hex
    // directly (strip '=' padding + whitespace — valid hex has neither).
    let trandataHex = form.get('trandata') || '';
    if (!trandataHex) {
      trandataHex = raw.replace(/=/g, '').replace(/\s+/g, '');
    }

    // Decryption failure = tampered/garbage payload → fail closed.
    let data;
    try {
      data = decryptTrandata(trandataHex);
    } catch (decryptErr) {
      console.error('[callback-knet] trandata decrypt failed:', decryptErr);
      return knetRedirect(`${appUrl}/error?reason=payment_failed`);
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
      return knetRedirect(`${appUrl}/error?reason=tip_not_found`);
    }

    // ── 4. VERIFY AMOUNT ─────────────────────────────────────
    // Guard against a tampered amount — compare at 3-decimal (fils) precision.
    if (Number(amt).toFixed(3) !== Number(tip.gross_amount_kd).toFixed(3)) {
      console.error('[callback-knet] amount mismatch — not marking paid', {
        trackid, received: amt, expected: tip.gross_amount_kd,
      });
      return knetRedirect(`${appUrl}/error?reason=payment_failed`);
    }

    // ── 5. VERIFY RESULT ─────────────────────────────────────
    // Only CAPTURED is a successful payment. Anything else (NOT CAPTURED,
    // CANCELED, HOST TIMEOUT, …) is a failure — do NOT mark paid.
    if (result !== 'CAPTURED') {
      console.error('[callback-knet] non-captured result — not marking paid', { trackid, result });
      return knetRedirect(`${appUrl}/error?reason=payment_failed`);
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

    // Tell KNET where to send the payer's browser — thank-you screen.
    return knetRedirect(`${appUrl}/${tip.creators.handle}?success=1&tip=${tip.id}`);

  } catch (err) {
    console.error('[callback-knet] Error:', err);
    return knetRedirect(`${appUrl}/error?reason=unexpected`);
  }
}
