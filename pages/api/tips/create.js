/**
 * pages/api/tips/create.js
 * POST /api/tips/create
 *
 * Called from the tipping page when a supporter clicks "أرسل القهوة".
 * Steps:
 *  1. Validate input
 *  2. Look up creator + platform settings
 *  3. Calculate amounts (gross, fee, net)
 *  4. Insert pending tip row in Supabase
 *  5. Create MyFatoorah invoice
 *  6. Update tip row with invoice ID
 *  7. Return payment URL to redirect the supporter
 */

import { supabaseAdmin } from '../../../lib/supabase';
import { initiatePayment } from '../../../lib/myfatoorah';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { creatorHandle, cups, isAmazing, customAmount, supporterName, supporterPhone, message } = req.body;

  // ── 1. basic validation ───────────────────────────────────────────────────
  if (!creatorHandle) return res.status(400).json({ error: 'creatorHandle required' });
  if (!isAmazing && ![1, 3, 5].includes(cups)) return res.status(400).json({ error: 'cups must be 1, 3 or 5' });

  try {
    // ── 2. fetch creator + platform settings ──────────────────────────────
    const [{ data: creator, error: creatorErr }, { data: settings, error: settingsErr }] = await Promise.all([
      supabaseAdmin
        .from('creators')
        .select('id, handle, coffee_price_kd, whatsapp_number, is_active, is_disabled')
        .eq('handle', creatorHandle.toLowerCase())
        .single(),
      supabaseAdmin
        .from('platform_settings')
        .select('platform_fee_pct, amazing_max_kd, amazing_min_kd, amazing_enabled_global, maintenance_mode')
        .eq('id', 1)
        .single(),
    ]);

    if (creatorErr || !creator) return res.status(404).json({ error: 'Creator not found' });
    if (settingsErr) throw settingsErr;
    if (!creator.is_active || creator.is_disabled) return res.status(403).json({ error: 'This page is not accepting tips right now' });
    if (settings.maintenance_mode) return res.status(503).json({ error: 'Platform is under maintenance' });

    // ── 3. calculate amounts ──────────────────────────────────────────────
    let grossAmount;

    if (isAmazing) {
      if (!settings.amazing_enabled_global) return res.status(403).json({ error: 'Amazing tips are disabled' });
      const amt = parseFloat(customAmount);
      if (isNaN(amt) || amt < parseFloat(settings.amazing_min_kd) || amt > parseFloat(settings.amazing_max_kd)) {
        return res.status(400).json({ error: `Amount must be between ${settings.amazing_min_kd} and ${settings.amazing_max_kd} KD` });
      }
      grossAmount = amt;
    } else {
      grossAmount = parseFloat(creator.coffee_price_kd) * cups;
    }

    const feePct     = parseFloat(settings.platform_fee_pct);
    const platformFee = parseFloat((grossAmount * feePct / 100).toFixed(3));
    const netAmount   = parseFloat((grossAmount - platformFee).toFixed(3));
    grossAmount       = parseFloat(grossAmount.toFixed(3));

    // ── 4. insert pending tip ─────────────────────────────────────────────
    const { data: tip, error: tipErr } = await supabaseAdmin
      .from('tips')
      .insert({
        creator_id:      creator.id,
        cups:            isAmazing ? 0 : cups,
        is_amazing:      isAmazing || false,
        gross_amount_kd: grossAmount,
        platform_fee_kd: platformFee,
        net_amount_kd:   netAmount,
        fee_pct:         feePct,
        supporter_name:  supporterName || null,
        supporter_phone: supporterPhone || null,
        message:         message || null,
        status:          'pending',
      })
      .select('id')
      .single();

    if (tipErr) throw tipErr;

    // ── 5. create MyFatoorah invoice ──────────────────────────────────────
    const { invoiceId, paymentUrl } = await initiatePayment({
      tipId:          tip.id,
      creatorHandle,
      amountKd:       grossAmount,
      cups:           isAmazing ? 0 : cups,
      isAmazing:      isAmazing || false,
      supporterName,
      message,
    });

    // ── 6. save invoice ID to tip ─────────────────────────────────────────
    await supabaseAdmin
      .from('tips')
      .update({ myfatoorah_invoice_id: invoiceId })
      .eq('id', tip.id);

    // ── 7. return redirect URL ────────────────────────────────────────────
    return res.status(200).json({ paymentUrl, tipId: tip.id });

  } catch (err) {
    console.error('[tips/create]', err);
    return res.status(500).json({ error: 'Something went wrong, please try again' });
  }
}
