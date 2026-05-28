'use client';

import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';
import PayoutForm from '@/components/creator/PayoutForm';

const STATUS_COLOR = {
  pending:  'text-yellow-400',
  approved: 'text-qahwa-blue',
  paid:     'text-qahwa-accent',
  rejected: 'text-qahwa-red',
};

export default function PayoutsPageClient({
  balance, minPayout, payoutsEnabled, hasPending,
  hasBank, bankName, accountHolder, ibanMasked, payouts,
}) {
  const { t, lang } = useLang();
  const dateLoc = lang === 'ar' ? 'ar-KW' : 'en-GB';
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('po.title')}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-qahwa-accent text-qahwa-black p-5">
          <div className="text-sm font-bold opacity-70">{t('po.balance')}</div>
          <div className="font-num text-4xl font-bold mt-1">{fmtKd(balance)} <span className="text-lg">KD</span></div>
        </div>

        <PayoutForm
          balance={balance} minPayout={minPayout}
          payoutsEnabled={payoutsEnabled} hasPending={hasPending}
          hasBank={hasBank} bankName={bankName}
          accountHolder={accountHolder} ibanMasked={ibanMasked}
        />
      </div>

      <p className="text-sm text-white/55 font-medium bg-qahwa-purple/15 border border-qahwa-purple/40 rounded-xl px-4 py-3">
        {t('po.netNote')}
      </p>

      <section className="dash-surface rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg mb-3">{t('po.history')}</h2>
        {(!payouts || payouts.length === 0) ? (
          <p className="text-white/40 font-medium py-6 text-center">{t('po.empty')}</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {payouts.map((p, i) => {
              const cls = STATUS_COLOR[p.status] || 'text-white/40';
              return (
                <li key={i} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-num font-bold">{t('po.amountRequested')}: {fmtKd(p.amount_kd)} KD</div>
                    <div className="text-xs text-qahwa-accent font-bold">{t('po.netLabel')}</div>
                    <div className="text-xs text-white/40">{p.method === 'knet_send' ? t('po.method.knet') : t('po.method.bank')}</div>
                  </div>
                  <div className="text-start">
                    <div className={`font-bold ${cls}`}>{t(`po.status.${p.status}`)}</div>
                    <div className="text-xs text-white/30 font-num">{new Date(p.created_at).toLocaleDateString(dateLoc)}</div>
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
