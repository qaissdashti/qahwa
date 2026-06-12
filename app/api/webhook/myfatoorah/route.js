// ============================================================
// FILE: /app/api/webhook/myfatoorah/route.js  (Next.js App Router)
// PURPOSE: Receive MyFatoorah payment confirmation webhook,
//          mark tip as paid, email the creator about the new tip
// ============================================================

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { notifyCreatorNewTip } from '@/lib/adminNotify';

// Use service role key — bypasses RLS, only safe on server
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const rawBody = await req.text();

  // ── 1. VERIFY WEBHOOK SIGNATURE ──────────────────────────
  // MyFatoorah signs every webhook with HMAC-SHA256
  const signature = req.headers.get('x-myfatoorah-signature');
  const expectedSig = crypto
    .createHmac('sha256', process.env.MYFATOORAH_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSig) {
    console.error('[webhook] Invalid signature — rejected');
    return new Response('Unauthorized', { status: 401 });
  }

  // ── 2. PARSE PAYLOAD ─────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const { InvoiceId, InvoiceStatus, PaymentMethod, ReferenceId } = payload;

  // Only process successful payments
  if (InvoiceStatus !== 'Paid') {
    console.log(`[webhook] InvoiceStatus=${InvoiceStatus} — skipping`);
    return new Response('OK', { status: 200 });
  }

  // ── 3. FIND THE TIP ROW ──────────────────────────────────
  const { data: tip, error: tipError } = await supabase
    .from('tips')
    .select(`
      *,
      creators (
        id, full_name, handle, email, whatsapp_number,
        phone, thankyou_template, balance_kd
      )
    `)
    .eq('myfatoorah_invoice_id', String(InvoiceId))
    .single();

  if (tipError || !tip) {
    console.error('[webhook] Tip not found for InvoiceId:', InvoiceId, tipError);
    return new Response('Not Found', { status: 404 });
  }

  // Guard against duplicate webhook delivery
  if (tip.status === 'paid') {
    console.log('[webhook] Already processed — idempotent return');
    return new Response('OK', { status: 200 });
  }

  // ── 4. MARK TIP AS PAID ──────────────────────────────────
  // The trigger update_creator_balance() fires automatically on this update
  const { error: updateError } = await supabase
    .from('tips')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      myfatoorah_payment_id: String(ReferenceId),
      payment_method: normaliseMethod(PaymentMethod),
    })
    .eq('id', tip.id);

  if (updateError) {
    console.error('[webhook] Failed to update tip:', updateError);
    return new Response('DB Error', { status: 500 });
  }

  // ── 5. EMAIL THE CREATOR ABOUT THE NEW TIP ───────────────
  // Replaces the old WhatsApp notification. notifyCreatorNewTip
  // swallows its own errors, but we still guard here so a notify
  // failure never fails the webhook (payment is already confirmed).
  try {
    const creator = tip.creators || {};
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
    // Don't fail the webhook — payment already confirmed.
    // Notification failure is non-critical and can be retried.
    console.error('[webhook] Creator tip email failed:', notifyError);
  }

  return new Response('OK', { status: 200 });
}

function normaliseMethod(method = '') {
  const m = method.toLowerCase();
  if (m.includes('knet'))   return 'knet';
  if (m.includes('apple'))  return 'apple_pay';
  if (m.includes('visa'))   return 'visa';
  if (m.includes('master')) return 'mastercard';
  return m;
}
