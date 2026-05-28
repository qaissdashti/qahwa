'use client';

import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';

export default function AdminOverviewClient({
  creators, verified, pendingVer, pendingPayouts, paidTips, volume, revenue, owed,
}) {
  const { t } = useLang();
  const cards = [
    [t('admin.ov.platformFees'),    fmtKd(revenue),    'KD', 'bg-qahwa-accent text-qahwa-black'],
    [t('admin.ov.float'),           fmtKd(owed),       'KD', owed > 0 ? 'bg-qahwa-purple/25 border border-qahwa-purple' : 'dash-surface border border-white/10'],
    [t('admin.ov.volume'),          fmtKd(volume),     'KD', 'dash-surface border border-white/10'],
    [t('admin.ov.paidTips'),        paidTips,          '',   'dash-surface border border-white/10'],
    [t('admin.ov.creators'),        creators,          '',   'dash-surface border border-white/10'],
    [t('admin.ov.verified'),        verified,          '',   'dash-surface border border-white/10'],
    [t('admin.ov.pendingVer'),      pendingVer,        '',   pendingVer ? 'bg-qahwa-orange/20 border border-qahwa-orange' : 'dash-surface border border-white/10'],
    [t('admin.ov.payoutRequests'),  pendingPayouts,    '',   pendingPayouts ? 'bg-qahwa-orange/20 border border-qahwa-orange' : 'dash-surface border border-white/10'],
  ];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('admin.ov.title')}</h1>
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
