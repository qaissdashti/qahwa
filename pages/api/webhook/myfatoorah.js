/**
 * pages/api/webhook/myfatoorah.js
 * POST /api/webhook/myfatoorah
 *
 * This is the most critical file in the entire platform.
 * MyFatoorah calls this URL after every payment (success or failure).
 *
 * Full flow on SUCCESS:
 *  1. Verify webhook signature (HMAC-SHA256)
 *  2. Extract invoice ID from payload
 *  3. Find matching pending tip in Supabase
 *  4. Mark tip as paid (triggers DB function → updates creator balance)
 *  5. Fire WhatsApp notification to creator
 *  6. Log WA message in whatsapp_messages table
 *  7. Return 200 immediately (MyFatoorah retries on non-200)
 *
 * IMPORTANT: Always return 200 quickly. Do heavy work async.
 */

import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabase';
import { notifyCreatorNewTip } from '../../../lib/whatsapp';

// MyFatoorah sends the raw body for signature verification
export const config = { api: { bodyParser: false } };

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signature) {
  const secret = process.env.MYFATOORAH_WEBHOOK_SECRET;
  if (!secret) return true; // skip in local dev if not set
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
}

// ─── main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── 1. read + verify ──────────────────────────────────────────────────────
  const rawBody = await getRawBody(req);
  const signature = req.headers['x-myfatoorah-signature'] || '';

  if (!verifySignature(rawBody, signature)) {
    console.warn('[webhook] Invalid signature — ignoring');
    return res.status(200).end(); // return 200 to stop retries, but do nothing
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    return res.status(200).end();
  }

  // MyFatoorah sends different event types — we only care about payment success
  const { Event, Data } = payload;
  if (Event !== 'PaymentSucceeded') {
    return res.status(200).json({ received: true, skipped: Event });
  }

  const invoiceId = String(Data?.InvoiceId);
  const myfatoorahPaymentId = String(Data?.PaymentId || '');
  const gateway = Data?.PaymentGateway || '';
  const paidAt = Data?.TransactionDate || new Date().toISOString();

  // ── respond immediately so MyFatoorah doesn't retry ──────────────────────
  res.status(200).json({ received: true });

  // ── 2. process async (after response sent) ────────────────────────────────
  try {
    await processPaidTip({ invoiceId, myfatoorahPaymentId, gateway, paidAt });
  } catch (err) {
    // Log but don't crash — we already returned 200
    console.error('[webhook] processPaidTip error:', err);
  }
}

// ─── core processing ──────────────────────────────────────────────────────────

async function processPaidTip({ invoiceId, myfatoorahPaymentId, gateway, paidAt }) {

  // ── 3. find the pending tip ───────────────────────────────────────────────
  const { data: tip, error: findErr } = await supabaseAdmin
    .from('tips')
    .select(`
      id, creator_id, cups, is_amazing, gross_amount_kd, net_amount_kd,
      platform_fee_kd, supporter_name, supporter_phone, message, status,
      creators (
        id, full_name, handle, whatsapp_number, balance_kd,
        thankyou_template, amazing_message
      )
    `)
    .eq('myfatoorah_invoice_id', invoiceId)
    .eq('status', 'pending')
    .single();

  if (findErr || !tip) {
    console.warn(`[webhook] No pending tip for invoice ${invoiceId}`, findErr);
    return;
  }

  // Guard against double-processing (idempotency)
  if (tip.status !== 'pending') {
    console.log(`[webhook] Tip ${tip.id} already processed — skipping`);
    return;
  }

  const creator = tip.creators;

  // ── 4. mark tip as paid ───────────────────────────────────────────────────
  // The DB trigger update_creator_balance() fires here automatically.
  const { error: updateErr } = await supabaseAdmin
    .from('tips')
    .update({
      status:                  'paid',
      paid_at:                  paidAt,
      payment_method:           normaliseMethod(gateway),
      myfatoorah_payment_id:    myfatoorahPaymentId,
      whatsapp_notified_at:     null, // will set below
    })
    .eq('id', tip.id);

  if (updateErr) throw updateErr;

  console.log(`[webhook] Tip ${tip.id} marked as paid — ${tip.gross_amount_kd} KD → ${creator.handle}`);

  // ── 5. send WhatsApp notification to creator ──────────────────────────────
  if (!creator.whatsapp_number) {
    console.warn(`[webhook] Creator ${creator.id} has no WA number — skipping notification`);
    return;
  }

  let waMessageId = null;
  try {
    waMessageId = await notifyCreatorNewTip({
      creatorPhone: creator.whatsapp_number,
      tip: {
        id:             tip.id,
        cups:           tip.cups,
        isAmazing:      tip.is_amazing,
        grossAmountKd:  tip.gross_amount_kd,
        netAmountKd:    tip.net_amount_kd,
        supporterName:  tip.supporter_name || 'داعم익명',
        message:        tip.message,
      },
      creator: {
        full_name:  creator.full_name,
        balance_kd: creator.balance_kd,
      },
    });

    // Mark WA notification sent
    await supabaseAdmin
      .from('tips')
      .update({ whatsapp_notified_at: new Date().toISOString() })
      .eq('id', tip.id);

  } catch (waErr) {
    console.error(`[webhook] WA notification failed for tip ${tip.id}:`, waErr);
    // Don't throw — payment is confirmed, WA failure is non-critical
  }

  // ── 6. log WA message ─────────────────────────────────────────────────────
  if (waMessageId) {
    await supabaseAdmin.from('whatsapp_messages').insert({
      tip_id:              tip.id,
      creator_id:          creator.id,
      direction:           'outbound',
      recipient_phone:     creator.whatsapp_number,
      message_type:        'tip_notification',
      content:             `New tip: ${tip.gross_amount_kd} KD from ${tip.supporter_name || 'anonymous'}`,
      provider_message_id: waMessageId,
      status:              'sent',
    });
  }

  console.log(`[webhook] Done — tip ${tip.id} fully processed`);
}

function normaliseMethod(gateway) {
  if (!gateway) return null;
  const g = gateway.toLowerCase();
  if (g.includes('knet')) return 'knet';
  if (g.includes('apple')) return 'apple_pay';
  if (g.includes('visa')) return 'visa';
  if (g.includes('master')) return 'mastercard';
  return g;
}
