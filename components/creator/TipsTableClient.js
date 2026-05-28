'use client';

import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';

const STATUS_COLOR = {
  paid:     'text-qahwa-accent',
  pending:  'text-yellow-400',
  failed:   'text-qahwa-red',
  refunded: 'text-white/40',
};

export default function TipsTableClient({ tips }) {
  const { t, lang } = useLang();
  const dateLoc = lang === 'ar' ? 'ar-KW' : 'en-GB';
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('tips.title')}</h1>
      <div className="dash-surface rounded-2xl border border-white/10 overflow-hidden">
        {(!tips || tips.length === 0) ? (
          <div className="text-center py-16 text-white/40">
            <div className="text-4xl mb-2">☕</div>
            <p className="font-medium">{t('tips.empty')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-white/40 text-start">
              <tr className="border-b border-white/10">
                <th className="font-bold px-4 py-3">{t('tips.col.supporter')}</th>
                <th className="font-bold px-4 py-3">{t('tips.col.type')}</th>
                <th className="font-bold px-4 py-3">{t('tips.col.amount')}</th>
                <th className="font-bold px-4 py-3">{t('tips.col.net')}</th>
                <th className="font-bold px-4 py-3">{t('tips.col.status')}</th>
                <th className="font-bold px-4 py-3">{t('tips.col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {tips.map((tp, i) => {
                const cls = STATUS_COLOR[tp.status] || 'text-white/40';
                return (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-bold">{tp.supporter_name || t('dash.supporterDefault')}</div>
                      {tp.message && <div className="text-white/50 text-xs line-clamp-1 max-w-[200px]">&quot;{tp.message}&quot;</div>}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {tp.is_amazing ? t('dash.amazing') : t('dash.cupsN', { n: tp.cups })}
                    </td>
                    <td className="px-4 py-3 font-num">{fmtKd(tp.gross_amount_kd)}</td>
                    <td className="px-4 py-3 font-num text-qahwa-accent">{fmtKd(tp.net_amount_kd)}</td>
                    <td className={`px-4 py-3 font-bold ${cls}`}>{t(`tips.status.${tp.status}`)}</td>
                    <td className="px-4 py-3 font-num text-white/40 whitespace-nowrap">
                      {new Date(tp.created_at).toLocaleDateString(dateLoc)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
