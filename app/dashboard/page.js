import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const kd = (n) => Number(n || 0).toFixed(3);

export default async function DashboardOverview() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  const admin = createAdminClient();
  const { data: creator } = await admin
    .from('creators')
    .select('full_name, balance_kd, total_earned_kd, total_tips_count')
    .eq('id', user.id)
    .maybeSingle();

  const { data: recentTips } = await admin
    .from('tips')
    .select('supporter_name, cups, is_amazing, gross_amount_kd, net_amount_kd, message, paid_at')
    .eq('creator_id', user.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(8);

  const stats = [
    ['الرصيد المتاح', kd(creator?.balance_kd), 'KD', 'bg-qahwa-accent text-qahwa-black'],
    ['إجمالي الأرباح', kd(creator?.total_earned_kd), 'KD', 'dash-surface border border-white/10'],
    ['عدد القهاوي', creator?.total_tips_count ?? 0, '', 'dash-surface border border-white/10'],
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl">هلا {creator?.full_name?.split(' ')[0]} 👋</h1>
      </header>

      {/* stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map(([label, value, unit, cls]) => (
          <div key={label} className={`rounded-2xl p-5 ${cls}`}>
            <div className="text-sm font-bold opacity-70">{label}</div>
            <div className="mt-1 font-num text-3xl font-bold">
              {value} <span className="text-base font-bold opacity-60">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* recent tips */}
      <section className="dash-surface rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg mb-3">آخر القهاوي</h2>
        {(!recentTips || recentTips.length === 0) ? (
          <div className="text-center py-10 text-white/40">
            <div className="text-4xl mb-2">☕</div>
            <p className="font-medium">لا توجد قهاوي بعد. شارك رابط صفحتك!</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {recentTips.map((t, i) => (
              <li key={i} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold truncate">
                    {t.supporter_name || 'داعم'}{' '}
                    <span className="text-white/40 font-medium">
                      · {t.is_amazing ? 'مبلغ حر' : `${t.cups} قهوة`}
                    </span>
                  </div>
                  {t.message && <p className="text-sm text-white/60 mt-0.5 line-clamp-2">"{t.message}"</p>}
                </div>
                <div className="text-left shrink-0">
                  <div className="font-num font-bold text-qahwa-accent">+{kd(t.net_amount_kd)} KD</div>
                  <div className="text-xs text-white/30 font-num">
                    {t.paid_at ? new Date(t.paid_at).toLocaleDateString('ar-KW') : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
