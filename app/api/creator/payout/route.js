// Creator requests a payout of their available balance.
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';

const IBAN_KW = /^KW\d{2}[A-Z0-9]{22}$/i; // Kuwait IBAN is 30 chars

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount, bank_name, account_holder, iban, method } = await req.json();
  const admin = createAdminClient();

  const [{ data: creator }, { data: settings }] = await Promise.all([
    admin.from('creators').select('balance_kd').eq('id', user.id).maybeSingle(),
    admin.from('platform_settings').select('min_payout_kd, payouts_enabled').eq('id', 1).maybeSingle(),
  ]);

  if (!settings?.payouts_enabled) {
    return Response.json({ error: 'السحوبات معطّلة حالياً' }, { status: 403 });
  }

  const amt = Number(amount);
  const minPayout = Number(settings?.min_payout_kd ?? 5);
  const balance = Number(creator?.balance_kd ?? 0);

  if (!(amt > 0))            return Response.json({ error: 'مبلغ غير صحيح' }, { status: 400 });
  if (amt < minPayout)      return Response.json({ error: `الحد الأدنى للسحب ${minPayout} د.ك` }, { status: 400 });
  if (amt > balance)        return Response.json({ error: 'المبلغ أكبر من رصيدك' }, { status: 400 });
  if (!account_holder?.trim()) return Response.json({ error: 'اسم صاحب الحساب مطلوب' }, { status: 400 });
  if (!IBAN_KW.test((iban || '').replace(/\s+/g, ''))) {
    return Response.json({ error: 'رقم آيبان كويتي غير صحيح' }, { status: 400 });
  }

  // block a second pending request
  const { data: existing } = await admin
    .from('payouts').select('id').eq('creator_id', user.id).eq('status', 'pending').maybeSingle();
  if (existing) {
    return Response.json({ error: 'لديك طلب سحب قيد المراجعة' }, { status: 409 });
  }

  const { error } = await admin.from('payouts').insert({
    creator_id: user.id,
    amount_kd: Number(amt.toFixed(3)),
    bank_name: bank_name?.trim() || null,
    account_holder: account_holder.trim(),
    iban: (iban || '').replace(/\s+/g, '').toUpperCase(),
    method: method === 'knet_send' ? 'knet_send' : 'bank_transfer',
    status: 'pending',
  });

  if (error) {
    // 23505 = unique_violation on payouts_one_pending_per_creator: a
    // concurrent request already created a pending payout.
    if (error.code === '23505') {
      return Response.json({ error: 'لديك طلب سحب قيد المراجعة' }, { status: 409 });
    }
    console.error('[creator/payout]', error);
    return Response.json({ error: 'تعذّر إنشاء الطلب' }, { status: 500 });
  }

  return Response.json({ success: true });
}
