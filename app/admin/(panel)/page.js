import { createAdminClient } from '@/lib/supabase';

const kd = (n) => Number(n || 0).toFixed(3);

async function count(admin, table, filters = (q) => q) {
  const { count } = await filters(
    admin.from(table).select('*', { count: 'exact', head: true })
  );
  return count || 0;
}

export default async function AdminOverview() {
  const admin = createAdminClient();

  const [creators, verified, pendingVer, pendingPayouts, paidTips] = await Promise.all([
    count(admin, 'creators'),
    count(admin, 'creators', (q) => q.eq('is_verified', true)),
    count(admin, 'creators', (q) => q.eq('verification_status', 'under_review')),
    count(admin, 'payouts',  (q) => q.eq('status', 'pending')),
    count(admin, 'tips',     (q) => q.eq('status', 'paid')),
  ]);

  // volume + platform revenue from paid tips (MVP-scale aggregation)
  const { data: paid } = await admin
    .from('tips').select('gross_amount_kd, platform_fee_kd').eq('status', 'paid').limit(10000);
  const volume  = (paid || []).reduce((s, t) => s + Number(t.gross_amount_kd || 0), 0);
  const revenue = (paid || []).reduce((s, t) => s + Number(t.platform_fee_kd || 0), 0);

  const cards = [
    ['إجمالي العمولة', kd(revenue), 'KD', 'bg-qahwa-accent text-qahwa-black'],
    ['حجم المعاملات',  kd(volume),  'KD', 'dash-surface border border-white/10'],
    ['قهاوي مدفوعة',   paidTips,    '',   'dash-surface border border-white/10'],
    ['المبدعون',       creators,    '',   'dash-surface border border-white/10'],
    ['موثّقون',        verified,    '',   'dash-surface border border-white/10'],
    ['بانتظار التحقق', pendingVer,  '',   pendingVer ? 'bg-qahwa-orange/20 border border-qahwa-orange' : 'dash-surface border border-white/10'],
    ['سحوبات معلّقة',  pendingPayouts, '', pendingPayouts ? 'bg-qahwa-orange/20 border border-qahwa-orange' : 'dash-surface border border-white/10'],
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl">نظرة عامة</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(([label, value, unit, cls]) => (
          <div key={label} className={`rounded-2xl p-5 ${cls}`}>
            <div className="text-sm font-bold opacity-70">{label}</div>
            <div className="mt-1 font-num text-3xl font-bold">
              {value} {unit && <span className="text-base opacity-60">{unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
