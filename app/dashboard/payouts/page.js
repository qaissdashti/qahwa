import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import PayoutForm from '@/components/creator/PayoutForm';

export const metadata = { title: 'السحوبات — قهوة' };
export const dynamic = 'force-dynamic';
const kd = (n) => Number(n || 0).toFixed(3);

const STATUS = {
  pending:  ['قيد المراجعة', 'text-yellow-400'],
  approved: ['تمت الموافقة', 'text-qahwa-blue'],
  paid:     ['تم التحويل',   'text-qahwa-accent'],
  rejected: ['مرفوض',        'text-qahwa-red'],
};

export default async function PayoutsPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  const admin = createAdminClient();
  const [{ data: creator }, { data: settings }, { data: payouts }] = await Promise.all([
    admin.from('creators')
      .select('balance_kd, bank_name, account_holder, iban_masked')
      .eq('id', user.id).maybeSingle(),
    admin.from('platform_settings').select('min_payout_kd, payouts_enabled').eq('id', 1).maybeSingle(),
    admin.from('payouts').select('created_at, amount_kd, method, status, paid_at')
      .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(50),
  ]);

  const balance     = Number(creator?.balance_kd ?? 0);
  const hasPending  = (payouts || []).some((p) => p.status === 'pending');
  const hasBank     = !!(creator?.iban_masked && creator?.account_holder);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl">السحوبات</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-qahwa-accent text-qahwa-black p-5">
          <div className="text-sm font-bold opacity-70">الرصيد المتاح للسحب</div>
          <div className="font-num text-4xl font-bold mt-1">{kd(balance)} <span className="text-lg">KD</span></div>
        </div>

        <PayoutForm
          balance={balance}
          minPayout={Number(settings?.min_payout_kd ?? 5)}
          payoutsEnabled={!!settings?.payouts_enabled}
          hasPending={hasPending}
          hasBank={hasBank}
          bankName={creator?.bank_name}
          accountHolder={creator?.account_holder}
          ibanMasked={creator?.iban_masked}
        />
      </div>

      <p className="text-sm text-white/55 font-medium bg-qahwa-purple/15 border border-qahwa-purple/40 rounded-xl px-4 py-3">
        💡 رصيدك <b>صافٍ بعد رسوم المنصة</b> — رسوم قهوة (٧٪) تُخصم من كل قهوة وقت الدفع، فأي مبلغ تطلبه تستلمه كاملاً.
      </p>

      <section className="dash-surface rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg mb-3">سجل السحوبات</h2>
        {(!payouts || payouts.length === 0) ? (
          <p className="text-white/40 font-medium py-6 text-center">لا توجد سحوبات بعد</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {payouts.map((p, i) => {
              const [label, cls] = STATUS[p.status] || [p.status, 'text-white/40'];
              return (
                <li key={i} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-num font-bold">المبلغ المطلوب: {kd(p.amount_kd)} KD</div>
                    <div className="text-xs text-qahwa-accent font-bold">صافٍ بعد رسوم المنصة — تستلمه كاملاً</div>
                    <div className="text-xs text-white/40">{p.method === 'knet_send' ? 'كي نت' : 'تحويل بنكي'}</div>
                  </div>
                  <div className="text-left">
                    <div className={`font-bold ${cls}`}>{label}</div>
                    <div className="text-xs text-white/30 font-num">{new Date(p.created_at).toLocaleDateString('ar-KW')}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
