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

// Show only the last 4 digits of the IBAN (the rest stays masked).
function maskIban(iban) {
  if (!iban) return '—';
  const s = String(iban).replace(/\s+/g, '');
  return s.length <= 4 ? s : `•••• ${s.slice(-4)}`;
}

export default function PayoutsPageClient({
  balance, minPayout, payoutFee, payoutsEnabled, hasPending,
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
          balance={balance} minPayout={minPayout} payoutFee={payoutFee}
          payoutsEnabled={payoutsEnabled} hasPending={hasPending}
          hasBank={hasBank} bankName={bankName}
          accountHolder={accountHolder} ibanMasked={ibanMasked}
        />
      </div>

      <p className="text-sm text-white/55 font-medium bg-qahwa-purple/15 border border-qahwa-purple/40 rounded-xl px-4 py-3">
        {t('po.netNote', { fee: fmtKd(payoutFee) })}
      </p>

      <section className="dash-surface rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg mb-3">{t('po.history')}</h2>
        {(!payouts || payouts.length === 0) ? (
          <p className="text-white/40 font-medium py-6 text-center">{t('po.empty')}</p>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="md:hidden divide-y divide-white/10">
              {payouts.map((p, i) => {
                const cls = STATUS_COLOR[p.status] || 'text-white/40';
                return (
                  <li key={p.id || i} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-num font-bold">{fmtKd(p.amount_kd)} KD</div>
                      {Number(p.fee_kd) > 0 && (
                        <div className="text-[10px] text-white/40 font-num">
                          {t('po.netReceived')}: {fmtKd(Number(p.amount_kd) - Number(p.fee_kd))} KD
                          <span className="text-white/25"> · {t('po.col.fee')} {fmtKd(p.fee_kd)}</span>
                        </div>
                      )}
                      <div className="text-xs text-white/40 truncate">
                        {p.bank_name || (p.method === 'knet_send' ? t('po.method.knet') : t('po.method.bank'))}
                        {p.iban && <span className="font-num"> · {maskIban(p.iban)}</span>}
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className={`font-bold ${cls}`}>{t(`po.status.${p.status}`)}</div>
                      <div className="text-xs text-white/30 font-num">{new Date(p.created_at).toLocaleDateString(dateLoc)}</div>
                      {p.paid_at && (
                        <div className="text-[10px] text-qahwa-accent font-num">
                          {t('po.col.paidDate')}: {new Date(p.paid_at).toLocaleDateString(dateLoc)}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="text-white/40">
                  <tr className="border-b border-white/10">
                    <th className="font-bold px-3 py-2.5 text-start">{t('po.col.date')}</th>
                    <th className="font-bold px-3 py-2.5 text-end">{t('po.col.amount')}</th>
                    <th className="font-bold px-3 py-2.5 text-end">{t('po.col.fee')}</th>
                    <th className="font-bold px-3 py-2.5 text-end">{t('po.col.net')}</th>
                    <th className="font-bold px-3 py-2.5 text-start">{t('po.col.bank')}</th>
                    <th className="font-bold px-3 py-2.5 text-start">{t('po.col.iban')}</th>
                    <th className="font-bold px-3 py-2.5 text-start">{t('po.col.status')}</th>
                    <th className="font-bold px-3 py-2.5 text-start">{t('po.col.paidDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p, i) => {
                    const cls = STATUS_COLOR[p.status] || 'text-white/40';
                    return (
                      <tr key={p.id || i} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-3 py-2.5 font-num text-white/60 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString(dateLoc)}</td>
                        <td className="px-3 py-2.5 font-num text-end font-bold whitespace-nowrap">{fmtKd(p.amount_kd)} <span className="text-xs text-white/40">KD</span></td>
                        <td className="px-3 py-2.5 font-num text-end text-white/50 whitespace-nowrap">{Number(p.fee_kd) > 0 ? `-${fmtKd(p.fee_kd)}` : '—'}</td>
                        <td className="px-3 py-2.5 font-num text-end text-qahwa-accent font-bold whitespace-nowrap">{fmtKd(Number(p.amount_kd) - Number(p.fee_kd || 0))}</td>
                        <td className="px-3 py-2.5 text-white/70">{p.bank_name || (p.method === 'knet_send' ? t('po.method.knet') : t('po.method.bank'))}</td>
                        <td className="px-3 py-2.5 font-num text-white/50 whitespace-nowrap">{maskIban(p.iban)}</td>
                        <td className={`px-3 py-2.5 font-bold ${cls}`}>{t(`po.status.${p.status}`)}</td>
                        <td className="px-3 py-2.5 font-num text-white/40 whitespace-nowrap">
                          {p.paid_at ? new Date(p.paid_at).toLocaleDateString(dateLoc) : t('po.notPaid')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
