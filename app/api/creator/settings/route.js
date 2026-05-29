// Updates the authenticated creator's public-page settings + bank details.
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { encrypt, maskIban } from '@/lib/encryption';
import { COFFEE_PRICE_OPTIONS, isAllowedCoffeePrice } from '@/lib/coffeePrices';

const HEX = /^#[0-9a-fA-F]{6}$/;
// IBAN format intentionally not validated — accept any non-empty text for
// now. Add proper Kuwait IBAN validation before production.
const clampStr = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const admin = createAdminClient();

  // Cup price is now hard-restricted to a fixed set of 0.5-KD multiples
  // (see lib/coffeePrices.js). The legacy platform_settings.max_coffee_price_kd
  // is no longer consulted here — every allowed value is below that ceiling
  // by construction.

  const update = {};

  if (body.full_name !== undefined)      update.full_name = clampStr(body.full_name, 80) || '';
  if (body.bio !== undefined)            update.bio = clampStr(body.bio, 280);
  if (body.avatar_emoji !== undefined)   update.avatar_emoji = clampStr(body.avatar_emoji, 8) || '☕';
  if (body.amazing_message !== undefined) update.amazing_message = clampStr(body.amazing_message, 200);
  if (body.amazing_enabled !== undefined) update.amazing_enabled = !!body.amazing_enabled;

  for (const social of ['instagram', 'twitter', 'youtube', 'tiktok']) {
    if (body[social] !== undefined) update[social] = clampStr(body[social], 80);
  }

  if (body.coffee_price_kd !== undefined) {
    if (!isAllowedCoffeePrice(body.coffee_price_kd)) {
      return Response.json({
        error: `Coffee price must be one of ${COFFEE_PRICE_OPTIONS.map((p) => p.toFixed(1)).join(', ')} KD`,
      }, { status: 400 });
    }
    // Snap to the canonical 1dp value so the DB never holds 1.500000001-style
    // floats coming back from JSON. The set is hard-restricted to multiples
    // of 0.5 — store with 1dp precision instead of 3.
    update.coffee_price_kd = Number(Number(body.coffee_price_kd).toFixed(1));
  }

  for (const themeKey of ['theme_bg', 'theme_text']) {
    if (body[themeKey] !== undefined) {
      if (!HEX.test(body[themeKey])) {
        return Response.json({ error: 'لون غير صالح' }, { status: 400 });
      }
      update[themeKey] = body[themeKey];
    }
  }

  // ── Bank details (used by payout requests) ────────────────────
  if (body.bank_name !== undefined)      update.bank_name      = clampStr(body.bank_name, 80);
  if (body.account_holder !== undefined) update.account_holder = clampStr(body.account_holder, 80);

  if (body.iban !== undefined) {
    // Accept any non-empty IBAN text (no format check for now — pre-prod).
    const raw = String(body.iban || '').trim();
    if (raw === '') {
      update.iban_encrypted = null;
      update.iban_masked    = null;
    } else {
      update.iban_encrypted = encrypt(raw);
      update.iban_masked    = maskIban(raw);
    }
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'لا يوجد تغييرات' }, { status: 400 });
  }

  const { error } = await admin.from('creators').update(update).eq('id', user.id);
  if (error) {
    console.error('[creator/settings]', error);
    return Response.json({ error: 'تعذّر الحفظ' }, { status: 500 });
  }

  return Response.json({ success: true });
}
