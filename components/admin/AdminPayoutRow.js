'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const kd = (n) => Number(n || 0).toFixed(3);
const STATUS = {
  pending:  ['قيد المراجعة', 'text-qahwa-orange'],
  approved: ['تمت الموافقة', 'text-qahwa-blue'],
  paid:     ['تم التحويل',   'text-qahwa-accent'],
  rejected: ['مرفوض',        'text-qahwa-red'],
};

export default function AdminPayoutRow({ payout: p }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(p.status);
  const [label, cls] = STATUS[status] || [status, 'text-white/40'];

  async function act(action) {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/payout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId: p.id, action }),
      });
      if (res.ok) router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="dash-surface rounded-2xl border border-white/10 p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <div className="min-w-0">
        <div className="font-bold">
          {p.creators?.full_name || '—'}{' '}
          <span className="text-white/40 font-num text-sm" dir="ltr">@{p.creators?.handle}</span>
        </div>
        <div className="text-xs text-white/40 font-num" dir="ltr">
          {p.account_holder} · {p.bank_name || '—'} · {p.iban}
        </div>
        <div className="text-xs text-white/30">{p.method === 'knet_send' ? 'كي نت' : 'تحويل بنكي'}</div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-left">
          <div className="font-num text-xl font-bold">{kd(p.amount_kd)} <span className="text-sm">KD</span></div>
          <div className={`text-xs font-bold ${cls}`}>{label}</div>
        </div>

        {status === 'pending' && (
          <div className="flex gap-1.5">
            <button onClick={() => act('approve')} disabled={busy}
                    className="text-xs font-bold rounded-lg bg-qahwa-blue/20 text-qahwa-blue border border-qahwa-blue/40 px-3 py-1.5">موافقة</button>
            <button onClick={() => act('pay')} disabled={busy}
                    className="text-xs font-bold rounded-lg bg-qahwa-accent text-qahwa-black px-3 py-1.5">تم التحويل</button>
            <button onClick={() => act('reject')} disabled={busy}
                    className="text-xs font-bold rounded-lg bg-qahwa-red/20 text-qahwa-red border border-qahwa-red/40 px-3 py-1.5">رفض</button>
          </div>
        )}
        {status === 'approved' && (
          <button onClick={() => act('pay')} disabled={busy}
                  className="text-xs font-bold rounded-lg bg-qahwa-accent text-qahwa-black px-3 py-1.5">تم التحويل</button>
        )}
      </div>
    </div>
  );
}
