'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';
import { trackEvent } from '@/lib/mixpanel';

export default function AdminOverviewClient({
  creators, verified, pendingVer, pendingPayouts, paidTips, volume, revenue, owed,
}) {
  const { t } = useLang();
  useEffect(() => { trackEvent('Admin Panel Viewed'); }, []);
  // [label, value, unit, className, href]. href makes the card a drill-down link.
  const cards = [
    [t('admin.ov.platformFees'),    fmtKd(revenue),    'KD', 'bg-qahwa-accent text-qahwa-black', '/admin/fees'],
    [t('admin.ov.float'),           fmtKd(owed),       'KD', owed > 0 ? 'bg-qahwa-purple/25 border border-qahwa-purple' : 'dash-surface border border-white/10', '/admin/payouts'],
    [t('admin.ov.volume'),          fmtKd(volume),     'KD', 'dash-surface border border-white/10', '/admin/fees?metric=volume'],
    [t('admin.ov.paidTips'),        paidTips,          '',   'dash-surface border border-white/10', '/admin/tips'],
    [t('admin.ov.creators'),        creators,          '',   'dash-surface border border-white/10', '/admin/creators'],
    [t('admin.ov.verified'),        verified,          '',   'dash-surface border border-white/10', '/admin/creators'],
    [t('admin.ov.pendingVer'),      pendingVer,        '',   pendingVer ? 'bg-qahwa-orange/20 border border-qahwa-orange' : 'dash-surface border border-white/10', '/admin/verifications'],
    [t('admin.ov.payoutRequests'),  pendingPayouts,    '',   pendingPayouts ? 'bg-qahwa-orange/20 border border-qahwa-orange' : 'dash-surface border border-white/10', '/admin/payouts'],
  ];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('admin.ov.title')}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(([label, value, unit, cls, href]) => {
          const inner = (
            <>
              <div className="text-sm font-bold opacity-70 flex items-center justify-between gap-2">
                {label}
                {href && <span className="opacity-40 text-xs">↗</span>}
              </div>
              <div className="mt-1 font-num text-3xl font-bold">
                {value} {unit && <span className="text-base opacity-60">{unit}</span>}
              </div>
            </>
          );
          return href ? (
            <Link key={label} href={href} prefetch={false}
              className={`block rounded-2xl p-5 transition-transform hover:-translate-y-0.5 ${cls}`}>
              {inner}
            </Link>
          ) : (
            <div key={label} className={`rounded-2xl p-5 ${cls}`}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
