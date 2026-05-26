'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const kd = (n) => Number(n || 0).toFixed(3);

const VER = {
  approved:     ['موثّق',         'text-qahwa-accent'],
  under_review: ['قيد المراجعة',  'text-qahwa-orange'],
  pending:      ['لم يكمل',       'text-white/40'],
  rejected:     ['مرفوض',         'text-qahwa-red'],
};

export default function CreatorRow({ creator }) {
  const router = useRouter();
  const [disabled, setDisabled] = useState(creator.is_disabled);
  const [busy, setBusy] = useState(false);
  const [ver] = [VER[creator.verification_status] || [creator.verification_status, 'text-white/40']];

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/creator-toggle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: creator.id, disabled: !disabled }),
      });
      if (res.ok) { setDisabled(!disabled); router.refresh(); }
    } finally { setBusy(false); }
  }

  return (
    <tr className="border-b border-white/5 hover:bg-white/5">
      <td className="px-4 py-3">
        <div className="font-bold">{creator.full_name || '—'}</div>
        <div className="text-xs text-white/40 font-num" dir="ltr">@{creator.handle} · {creator.email}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`font-bold ${ver[1]}`}>{ver[0]}</span>
        {disabled && <span className="block text-xs text-qahwa-red font-bold">معطّل</span>}
      </td>
      <td className="px-4 py-3 font-num">{kd(creator.balance_kd)}</td>
      <td className="px-4 py-3 font-num text-white/60">{kd(creator.total_earned_kd)}</td>
      <td className="px-4 py-3">
        <button onClick={toggle} disabled={busy}
          className={`text-xs font-bold rounded-lg px-3 py-1.5 ${disabled ? 'bg-qahwa-accent text-qahwa-black' : 'bg-qahwa-red/20 text-qahwa-red border border-qahwa-red/40'}`}>
          {busy ? '...' : disabled ? 'تفعيل' : 'تعطيل'}
        </button>
      </td>
    </tr>
  );
}
