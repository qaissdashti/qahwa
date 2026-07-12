// ============================================================
// FILE: /app/api/payment/initiate-knet/route.js
// PURPOSE: Called when supporter chooses to pay by KNET (direct KPAY)
//          1. Reads platform fee from platform_settings
//          2. Inserts tip row as 'pending'
//          3. Builds an alphanumeric KNET track id from the tip UUID
//          4. Builds the encrypted KNET KPAY redirect URL
//          5. Returns { paymentUrl, tipId } to redirect the supporter
//
// Parallel to /app/api/payment/initiate-card/route.js (MPGS) and
// /app/api/payment/initiate/route.js (MyFatoorah). Additive — the
// other rails are untouched. No test-mode fallback: if KNET env vars
// are missing, buildPaymentUrl throws and hits the same 502 path.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { buildPaymentUrl } from '@/lib/knet';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const { creatorHandle, cups, isAmazing, grossAmount, message, supporterName, supporterPhone } =
    await req.json();

  // ── 1. VALIDATE INPUT ────────────────────────────────────
  if (!creatorHandle || (!cups && !isAmazing) || !grossAmount) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Supporter phone is mandatory (creators reply to it). Normalise to the
  // 8 local Kuwait digits — accept input with/without a +965 / 965 prefix
  // and spaces — and reject anything that isn't exactly 8 digits.
  let phoneDigits = String(supporterPhone || '').replace(/\D/g, '');
  if (phoneDigits.startsWith('965') && phoneDigits.length > 8) phoneDigits = phoneDigits.slice(3);
  if (!/^\d{8}$/.test(phoneDigits)) {
    return Response.json({ error: 'A valid Kuwait phone number is required' }, { status: 400 });
  }
  const normalizedPhone = `+965${phoneDigits}`;

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
      supporter_phone:  normalizedPhone,
      status:           'pending',
    })
    .select()
    .single();

  if (tipError) {
    console.error('[initiate-knet] Failed to insert tip:', tipError);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }

  // KNET rejects spaces/special chars in trackid and caps it at 40 chars.
  // The tip UUID with hyphens stripped is 32 alphanumeric chars — safe.
  const trackId = String(tip.id).replace(/-/g, '');

  // ── 5. BUILD KNET KPAY REDIRECT URL ──────────────────────
  // buildPaymentUrl throws if KNET env vars are missing — caught below
  // and surfaced as a 502, same as the MPGS route's gateway error.
  let paymentUrl;
  try {
    paymentUrl = buildPaymentUrl({
      amount,
      trackId,
      udf1: tip.id,
    });
  } catch (err) {
    console.error('[initiate-knet] KNET error:', err);
    // Clean up the pending tip row
    await supabase.from('tips').delete().eq('id', tip.id);
    return Response.json({ error: 'Payment gateway error' }, { status: 502 });
  }

  // ── 6. SAVE TRACK ID TO TIP ROW ──────────────────────────
  await supabase
    .from('tips')
    .update({ knet_track_id: trackId })
    .eq('id', tip.id);

  // ── 7. RETURN PAYMENT URL ────────────────────────────────
  return Response.json({ paymentUrl, tipId: tip.id });
}
