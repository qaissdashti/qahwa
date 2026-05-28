// Updates the authenticated creator's public-page settings + bank details.
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { encrypt, maskIban } from '@/lib/encryption';

const HEX     = /^#[0-9a-fA-F]{6}$/;
const IBAN_KW = /^KW\d{2}[A-Z0-9]{22}$/i; // Kuwait IBAN is 30 chars
const clampStr = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const admin = createAdminClient();

  // coffee price is bounded by the platform max
  const { data: settings } = await admin
    .from('platform_settings').select('max_coffee_price_kd').eq('id', 1).maybeSingle();
  const maxPrice = Number(settings?.max_coffee_price_kd ?? 10);

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
    const price = Number(body.coffee_price_kd);
    if (!(price > 0) || price > maxPrice) {
      return Response.json({ error: `سعر القهوة لازم بين 0 و ${maxPrice} د.ك` }, { status: 400 });
    }
    update.coffee_price_kd = Number(price.toFixed(3));
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
    const raw = String(body.iban || '').replace(/\s+/g, '').toUpperCase();
    if (raw === '') {
      update.iban_encrypted = null;
      update.iban_masked    = null;
    } else {
      if (!IBAN_KW.test(raw)) {
        return Response.json({ error: 'رقم آيبان كويتي غير صحيح (يبدأ بـ KW وطوله 30 خانة)' }, { status: 400 });
      }
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
