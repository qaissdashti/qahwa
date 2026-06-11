'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/components/LangProvider';
import Spinner from '@/components/Spinner';
import { trackEvent } from '@/lib/mixpanel';

export default function PayoutForm({
  balance, minPayout, payoutsEnabled, hasPending,
  hasBank, bankName, accountHolder, ibanMasked,
}) {
  const router = useRouter();
  const { t } = useLang();
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const disabled = !payoutsEnabled || hasPending || balance < minPayout || !hasBank;

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/creator/payout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Method is fixed to bank_transfer for now — KNET-send isn't
        // actually supported, so we don't expose a choice.
        body: JSON.stringify({ amount, method: 'bank_transfer' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t('common.somethingWrong'));
      trackEvent('Payout Requested', { amount: Number(amount) });
      setDone(true);
      router.refresh();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="q-card p-5 text-qahwa-black">
        <div className="text-3xl mb-2">✅</div>
        <h2 className="text-lg mb-1">{t('pof.sentTitle')}</h2>
        <p className="text-sm text-black/60 font-medium">{t('pof.sentBody')}</p>
      </div>
    );
  }

  if (!hasBank) {
    return (
      <div className="q-card p-5 text-qahwa-black space-y-3">
        <h2 className="text-lg">{t('pof.title')}</h2>
        <p className="text-sm text-black/70 font-medium">{t('pof.noBankTitle')}</p>
        <Link href="/dashboard/settings" className="q-btn-black inline-flex text-sm">
          {t('pof.goToSettings')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="q-card p-5 text-qahwa-black space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg">{t('pof.title')}</h2>
        {!payoutsEnabled && <p className="q-error">{t('pof.disabled')}</p>}
        {payoutsEnabled && hasPending && <p className="q-error">{t('pof.hasPending')}</p>}
      </div>

      <div className="bg-black/5 border-2 border-qahwa-black/20 rounded-xl p-3 text-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-black/70">{t('pof.savedAccount')}</span>
          <Link href="/dashboard/settings" className="text-xs font-bold underline text-qahwa-purple">
            {t('pof.editInSettings')}
          </Link>
        </div>
        <div className="font-bold">{accountHolder}</div>
        <div className="text-xs text-black/60">{bankName || '—'}</div>
        <div className="text-xs text-black/60 font-num" dir="ltr">{ibanMasked}</div>
      </div>

      <div>
        <label className="q-label">{t('pof.amount')}</label>
        <input className="q-input font-num" dir="ltr" inputMode="decimal" value={amount}
               onChange={(e) => setAmount(e.target.value)} placeholder={`${minPayout}.000`} disabled={disabled} />
      </div>

      {payoutsEnabled && !hasPending && balance < minPayout &&
        <p className="q-error">{t('pof.minErr', { min: minPayout })}</p>}
      {error && <p className="q-error">{error}</p>}

      <button className="q-btn-black w-full inline-flex items-center justify-center gap-2" disabled={disabled || loading}>
        {loading && <Spinner size={16} color="#FAFAF7" />}
        {loading ? t('common.processing') : t('pof.submit')}
      </button>
    </form>
  );
}
