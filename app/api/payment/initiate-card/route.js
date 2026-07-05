// ============================================================
// FILE: /app/api/payment/initiate-card/route.js
// PURPOSE: Called when supporter chooses to pay by CARD (Visa/Mastercard)
//          1. Reads platform fee from platform_settings
//          2. Inserts tip row as 'pending'
//          3. Creates an MPGS Hosted Checkout session
//          4. Stores the MPGS order id on the tip
//          5. Returns { sessionId, orderId, tipId } to the browser
//
// Parallel to /app/api/payment/initiate/route.js (MyFatoorah/KNET).
// This is ADDITIVE — the KNET rail is untouched.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { createCheckoutSession } from '@/lib/mpgs';
import { getBaseUrl } from '@/lib/baseUrl';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Payment test mode: simulate a successful card payment when MPGS
// isn't configured, so the post-payment flow (balance trigger, success
// screen, confetti) can be exercised end-to-end without real card keys.
//
// Activates when the password is missing AND it's safe to do so:
//   • NODE_ENV !== 'production'        — always-on outside prod
//   • PAYMENT_TEST_MODE === 'true'      — opt-in explicitly (e.g. on a
//                                         Vercel deployment before real
//                                         MPGS creds are wired).
//
// In production with the safety env unset, a missing password produces a
// clean 503 instead of a cryptic MPGS error.
function paymentTestMode() {
  const hasKey = !!(process.env.MPGS_API_PASSWORD && process.env.MPGS_API_PASSWORD.trim());
  if (hasKey) return false;
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.PAYMENT_TEST_MODE === 'true';
}

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
    console.error('[initiate-card] Failed to insert tip:', tipError);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }

  // ── TEST MODE: simulate a paid tip, skip MPGS ────────────
  // Marks the tip paid (fires the balance trigger that credits the
  // creator), then returns a URL straight to the success screen —
  // mirrors the real post-payment redirect from the hosted page.
  if (paymentTestMode()) {
    await supabase
      .from('tips')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: 'test',
        mpgs_order_id: `TEST-${tip.id}`,
        mpgs_transaction_id: `TEST-${Date.now()}`,
      })
      .eq('id', tip.id);

    return Response.json({
      paymentUrl: `${getBaseUrl()}/${creator.handle}?success=1&tip=${tip.id}`,
      tipId: tip.id,
      testMode: true,
    });
  }

  // Production guard: if we're here, real password is required but missing.
  if (!process.env.MPGS_API_PASSWORD) {
    console.error('[initiate-card] MPGS_API_PASSWORD missing and test mode not enabled');
    // Roll back the pending tip so it doesn't sit forever as 'pending'.
    await supabase.from('tips').delete().eq('id', tip.id);
    return Response.json(
      { error: 'Payment system is not configured yet. Please try again later.' },
      { status: 503 },
    );
  }

  // ── 5. CREATE MPGS HOSTED CHECKOUT SESSION ───────────────
  let sessionId, orderId;
  try {
    ({ sessionId, orderId } = await createCheckoutSession({
      tipId:       tip.id,
      amount,
      creatorName: creator.full_name,
      handle:      creator.handle,
    }));
  } catch (err) {
    console.error('[initiate-card] MPGS error:', err);
    // Clean up the pending tip row
    await supabase.from('tips').delete().eq('id', tip.id);
    return Response.json({ error: 'Payment gateway error' }, { status: 502 });
  }

  // ── 6. SAVE ORDER ID TO TIP ROW ──────────────────────────
  await supabase
    .from('tips')
    .update({ mpgs_order_id: orderId })
    .eq('id', tip.id);

  // ── 7. RETURN SESSION ID TO THE BROWSER ──────────────────
  return Response.json({ sessionId, orderId, tipId: tip.id });
}
