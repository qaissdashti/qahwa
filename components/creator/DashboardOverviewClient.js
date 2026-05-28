'use client';

import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';

export default function DashboardOverviewClient({ creator, recentTips }) {
  const { t, lang } = useLang();
  const stats = [
    [t('dash.balance'),     fmtKd(creator?.balance_kd),       'KD', 'bg-qahwa-accent text-qahwa-black'],
    [t('dash.totalEarned'), fmtKd(creator?.total_earned_kd),  'KD', 'dash-surface border border-white/10'],
    [t('dash.totalTips'),   creator?.total_tips_count ?? 0,   '',   'dash-surface border border-white/10'],
  ];
  const dateLoc = lang === 'ar' ? 'ar-KW' : 'en-GB';
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl">{t('dash.greeting', { name: creator?.full_name?.split(' ')[0] || '' })}</h1>
      </header>

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

      <section className="dash-surface rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg mb-3">{t('dash.recentTips')}</h2>
        {(!recentTips || recentTips.length === 0) ? (
          <div className="text-center py-10 text-white/40">
            <div className="text-4xl mb-2">☕</div>
            <p className="font-medium">{t('dash.noTips')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {recentTips.map((tip, i) => (
              <li key={i} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold truncate">
                    {tip.supporter_name || t('dash.supporterDefault')}{' '}
                    <span className="text-white/40 font-medium">
                      · {tip.is_amazing ? t('dash.amazing') : t('dash.cupsN', { n: tip.cups })}
                    </span>
                  </div>
                  {tip.message && <p className="text-sm text-white/60 mt-0.5 line-clamp-2">&quot;{tip.message}&quot;</p>}
                </div>
                <div className="text-left shrink-0">
                  <div className="font-num font-bold text-qahwa-accent">+{fmtKd(tip.net_amount_kd)} KD</div>
                  <div className="text-xs text-white/30 font-num">
                    {tip.paid_at ? new Date(tip.paid_at).toLocaleDateString(dateLoc) : ''}
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
