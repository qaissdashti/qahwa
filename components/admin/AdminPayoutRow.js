'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';
import Spinner from '@/components/Spinner';
import { trackEvent } from '@/lib/mixpanel';

const STATUS_COLOR = {
  pending:  'text-qahwa-orange',
  approved: 'text-qahwa-blue',
  paid:     'text-qahwa-accent',
  rejected: 'text-qahwa-red',
};

export default function AdminPayoutRow({ payout: p }) {
  const router = useRouter();
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [status, setStatus] = useState(p.status);
  const cls = STATUS_COLOR[status] || 'text-white/40';

  async function act(action) {
    setBusy(true); setPendingAction(action);
    try {
      const res = await fetch('/api/admin/payout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId: p.id, action }),
      });
      if (res.ok) {
        if (action === 'pay') {
          trackEvent('Payout Marked Paid', { amount: Number(p.amount_kd), creatorHandle: p.creators?.handle });
        }
        router.refresh();
      }
    } finally { setBusy(false); setPendingAction(null); }
  }

  return (
    <div className="dash-surface rounded-2xl border border-white/10 p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <div className="min-w-0">
        <div className="font-bold">
          {p.creators?.full_name || '—'}{' '}
          <span className="text-white/40 font-num text-sm">@{p.creators?.handle}</span>
        </div>
        <div className="text-xs text-white/40 font-num">
          {p.account_holder} · {p.bank_name || '—'} · {p.iban}
        </div>
        <div className="text-xs text-white/30">{p.method === 'knet_send' ? t('po.method.knet') : t('po.method.bank')}</div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-start">
          <div className="font-num text-xl font-bold">{fmtKd(p.amount_kd)} <span className="text-sm">KD</span></div>
          <div className="text-[10px] text-white/35">{t('admin.po.netNote')}</div>
          <div className={`text-xs font-bold ${cls}`}>{t(`admin.po.status.${status}`)}</div>
        </div>

        {status === 'pending' && (
          <div className="flex gap-1.5">
            <button onClick={() => act('approve')} disabled={busy}
                    className="text-xs font-bold rounded-lg bg-qahwa-blue/20 text-qahwa-blue border border-qahwa-blue/40 px-3 py-1.5 inline-flex items-center gap-1.5 min-h-[36px]">
              {busy && pendingAction === 'approve' && <Spinner size={12} />}
              {t('admin.po.approve')}
            </button>
            <button onClick={() => act('pay')} disabled={busy}
                    className="text-xs font-bold rounded-lg bg-qahwa-accent text-qahwa-black px-3 py-1.5 inline-flex items-center gap-1.5 min-h-[36px]">
              {busy && pendingAction === 'pay' && <Spinner size={12} />}
              {t('admin.po.markPaid')}
            </button>
            <button onClick={() => act('reject')} disabled={busy}
                    className="text-xs font-bold rounded-lg bg-qahwa-red/20 text-qahwa-red border border-qahwa-red/40 px-3 py-1.5 inline-flex items-center gap-1.5 min-h-[36px]">
              {busy && pendingAction === 'reject' && <Spinner size={12} />}
              {t('admin.po.reject')}
            </button>
          </div>
        )}
        {status === 'approved' && (
          <button onClick={() => act('pay')} disabled={busy}
                  className="text-xs font-bold rounded-lg bg-qahwa-accent text-qahwa-black px-3 py-1.5 inline-flex items-center gap-1.5 min-h-[36px]">
            {busy && <Spinner size={12} />}
            {t('admin.po.markPaid')}
          </button>
        )}
      </div>
    </div>
  );
}
