// Creator requests a payout. Bank details come from the creator's saved
// settings (entered once); the request itself only carries amount + method.
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption';
import { notifyPayoutRequested } from '@/lib/adminNotify';

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount, method } = await req.json();
  const admin = createAdminClient();

  const [{ data: creator }, { data: settings }] = await Promise.all([
    admin.from('creators')
      .select('balance_kd, bank_name, account_holder, iban_encrypted, full_name, handle, email')
      .eq('id', user.id).maybeSingle(),
    admin.from('platform_settings').select('min_payout_kd, payout_fee_kd, payouts_enabled').eq('id', 1).maybeSingle(),
  ]);

  if (!settings?.payouts_enabled) {
    return Response.json({ error: 'السحوبات معطّلة حالياً' }, { status: 403 });
  }

  // Saved bank details are required — directs the user to settings if missing.
  if (!creator?.iban_encrypted || !creator?.account_holder) {
    return Response.json({ error: 'أضف تفاصيل حسابك البنكي في الإعدادات أولاً' }, { status: 400 });
  }

  const amt = Number(amount);
  const minPayout = Number(settings?.min_payout_kd ?? 5);
  const balance   = Number(creator?.balance_kd ?? 0);
  // Snapshot the current payout fee — stored on the row so reporting stays
  // accurate even if the admin changes the setting later.
  const fee       = Number(settings?.payout_fee_kd ?? 0);

  if (!(amt > 0))      return Response.json({ error: 'مبلغ غير صحيح' }, { status: 400 });
  if (amt < minPayout) return Response.json({ error: `الحد الأدنى للسحب ${minPayout} د.ك` }, { status: 400 });
  // Can't withdraw an amount at or below the fee — net would be zero/negative.
  if (amt <= fee)      return Response.json({ error: `المبلغ يجب أن يكون أكبر من رسوم السحب (${fee.toFixed(3)} د.ك)` }, { status: 400 });
  if (amt > balance)   return Response.json({ error: 'المبلغ أكبر من رصيدك' }, { status: 400 });

  // Block a second pending request (race-safe via partial unique index).
  const { data: existing } = await admin
    .from('payouts').select('id').eq('creator_id', user.id).eq('status', 'pending').maybeSingle();
  if (existing) {
    return Response.json({ error: 'لديك طلب سحب قيد المراجعة' }, { status: 409 });
  }

  // Snapshot the saved bank details onto the payout row (decrypt IBAN once
  // so the admin can act on it without re-decrypting later).
  let ibanPlain;
  try { ibanPlain = decrypt(creator.iban_encrypted); }
  catch (e) {
    console.error('[creator/payout] iban decrypt:', e);
    return Response.json({ error: 'تعذّر قراءة تفاصيل الحساب' }, { status: 500 });
  }

  const { error } = await admin.from('payouts').insert({
    creator_id: user.id,
    amount_kd: Number(amt.toFixed(3)),
    fee_kd: Number(fee.toFixed(3)),
    bank_name: creator.bank_name || null,
    account_holder: creator.account_holder,
    iban: ibanPlain,
    method: method === 'knet_send' ? 'knet_send' : 'bank_transfer',
    status: 'pending',
  });

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'لديك طلب سحب قيد المراجعة' }, { status: 409 });
    }
    console.error('[creator/payout]', error);
    return Response.json({ error: 'تعذّر إنشاء الطلب' }, { status: 500 });
  }

  // Fire-and-forget: confirmation to creator + notification to admin.
  // Helper swallows its own errors so a notification fault never breaks
  // payout creation.
  notifyPayoutRequested({
    creatorEmail: creator.email || user.email,
    fullName:     creator.full_name,
    handle:       creator.handle,
    amount:       amt,
    fee,
    bankName:     creator.bank_name,
  }).catch((err) => console.error('[creator/payout] notify', err));

  return Response.json({ success: true });
}
