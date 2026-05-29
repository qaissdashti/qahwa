'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';
import Spinner from '@/components/Spinner';

const VER_COLOR = {
  approved:     'text-qahwa-accent',
  under_review: 'text-qahwa-orange',
  pending:      'text-white/40',
  rejected:     'text-qahwa-red',
};

export default function CreatorRow({ creator }) {
  const router = useRouter();
  const { t } = useLang();
  const [disabled, setDisabled] = useState(creator.is_disabled);
  const [busy, setBusy] = useState(false);
  const verCls = VER_COLOR[creator.verification_status] || 'text-white/40';

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
        <div className="text-xs text-white/40 font-num">@{creator.handle} · {creator.email}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`font-bold ${verCls}`}>{t(`admin.cr.ver.${creator.verification_status}`)}</span>
        {disabled && <span className="block text-xs text-qahwa-red font-bold">{t('admin.cr.disabled')}</span>}
      </td>
      <td className="px-4 py-3 font-num">{fmtKd(creator.balance_kd)}</td>
      <td className="px-4 py-3 font-num text-white/60">{fmtKd(creator.total_earned_kd)}</td>
      <td className="px-4 py-3">
        <button onClick={toggle} disabled={busy}
          className={`text-xs font-bold rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 min-h-[32px] ${disabled ? 'bg-qahwa-accent text-qahwa-black' : 'bg-qahwa-red/20 text-qahwa-red border border-qahwa-red/40'}`}>
          {busy && <Spinner size={12} />}
          {busy ? t('common.processing') : disabled ? t('admin.cr.enable') : t('admin.cr.disable')}
        </button>
      </td>
    </tr>
  );
}
