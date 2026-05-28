// ============================================================
// FILE: /app/api/payment/initiate/route.js
// PURPOSE: Called when supporter taps "Send Coffee"
//          1. Reads platform fee from platform_settings
//          2. Inserts tip row as 'pending'
//          3. Creates MyFatoorah invoice
//          4. Updates tip with invoice ID
//          5. Returns payment URL to redirect supporter
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createInvoice } from '@/lib/myfatoorah';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Local test mode: simulate a successful payment without MyFatoorah so the
// full post-payment flow (success screen + confetti) can be exercised.
// Gated by DEV_OTP_BYPASS and hard-disabled in production.
const TEST_MODE = process.env.DEV_OTP_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

export async function POST(req) {
  const { creatorHandle, cups, isAmazing, grossAmount, message, supporterName, supporterPhone } =
    await req.json();

  // ── 1. VALIDATE INPUT ────────────────────────────────────
  if (!creatorHandle || (!cups && !isAmazing) || !grossAmount) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // ── 2. FETCH CREATOR + PLATFORM SETTINGS ─────────────────
  const [{ data: creator }, { data: settings }] = await Promise.all([
    supabase
      .from('creators')
      .select('id, full_name, handle, coffee_price_kd, is_active, is_disabled, is_verified, verification_status')
      .eq('handle', creatorHandle.toLowerCase())
      .single(),
    supabase
      .from('platform_settings')
      .select('platform_fee_pct, amazing_max_kd, amazing_min_kd, maintenance_mode')
      .eq('id', 1)
      .single(),
  ]);

  if (!creator) {
    return Response.json({ error: 'Creator not found' }, { status: 404 });
  }
  if (!creator.is_active || creator.is_disabled) {
    return Response.json({ error: 'This page is not accepting tips right now' }, { status: 403 });
  }
  // Defense in depth — the public page hides the tipping UI for
  // unapproved creators; this also blocks any direct API call.
  if (!creator.is_verified || creator.verification_status !== 'approved') {
    return Response.json({ error: 'This page is not approved to accept tips yet' }, { status: 403 });
  }
  if (settings?.maintenance_mode) {
    return Response.json({ error: 'Platform is in maintenance mode' }, { status: 503 });
  }

  // ── 3. VALIDATE AMOUNT ───────────────────────────────────
  const amount      = Number(Number(grossAmount).toFixed(3));
  const feePct      = settings?.platform_fee_pct ?? 7.00;
  const platformFee = Number((amount * feePct / 100).toFixed(3));
  const netAmount   = Number((amount - platformFee).toFixed(3));

  if (isAmazing) {
    const min = settings?.amazing_min_kd ?? 0.500;
    const max = settings?.amazing_max_kd ?? 50.000;
    if (amount < min || amount > max) {
      return Response.json({ error: `Amount must be between ${min} and ${max} KD` }, { status: 400 });
    }
  } else {
    // Validate cup amount matches coffee price
    const expected = Number((creator.coffee_price_kd * cups).toFixed(3));
    if (Math.abs(amount - expected) > 0.001) {
      return Response.json({ error: 'Amount mismatch' }, { status: 400 });
    }
  }

  // ── 4. INSERT TIP ROW AS 'PENDING' ───────────────────────
  const { data: tip, error: tipError } = await supabase
    .from('tips')
    .insert({
      creator_id:       creator.id,
      cups:             isAmazing ? 0 : cups,
      is_amazing:       Boolean(isAmazing),
      gross_amount_kd:  amount,
      platform_fee_kd:  platformFee,
      net_amount_kd:    netAmount,
      fee_pct:          feePct,
      message:          message || null,
      supporter_name:   supporterName || null,
      supporter_phone:  supporterPhone || null,
      status:           'pending',
    })
    .select()
    .single();

  if (tipError) {
    console.error('[initiate] Failed to insert tip:', tipError);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }

  // ── TEST MODE: simulate a paid tip, skip MyFatoorah ──────
  // Marks the tip paid (fires the balance trigger), then returns a URL
  // straight to the success screen — mirrors the post-payment redirect.
  if (TEST_MODE) {
    await supabase
      .from('tips')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: 'test',
        myfatoorah_invoice_id: `TEST-${tip.id}`,
        myfatoorah_payment_id: `TEST-${Date.now()}`,
      })
      .eq('id', tip.id);

    const base = process.env.NEXT_PUBLIC_BASE_URL || '';
    return Response.json({
      paymentUrl: `${base}/${creator.handle}?success=1&tip=${tip.id}`,
      tipId: tip.id,
      testMode: true,
    });
  }

  // ── 5. CREATE MYFATOORAH INVOICE ─────────────────────────
  let invoiceId, paymentUrl;
  try {
    ({ invoiceId, paymentUrl } = await createInvoice({
      tipId:       tip.id,
      amount,
      creatorName: creator.full_name,
      handle:      creator.handle,
      cups:        isAmazing ? 0 : cups,
    }));
  } catch (err) {
    console.error('[initiate] MyFatoorah error:', err);
    // Clean up the pending tip row
    await supabase.from('tips').delete().eq('id', tip.id);
    return Response.json({ error: 'Payment gateway error' }, { status: 502 });
  }

  // ── 6. SAVE INVOICE ID TO TIP ROW ────────────────────────
  await supabase
    .from('tips')
    .update({ myfatoorah_invoice_id: invoiceId })
    .eq('id', tip.id);

  // ── 7. RETURN PAYMENT URL ────────────────────────────────
  return Response.json({ paymentUrl, tipId: tip.id });
}
