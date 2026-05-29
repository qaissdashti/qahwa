'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';

const VER_COLOR = {
  approved:     'text-qahwa-accent',
  under_review: 'text-qahwa-orange',
  pending:      'text-white/40',
  rejected:     'text-qahwa-red',
};

// Mobile counterpart of CreatorRow — stacked card layout for narrow screens.
export default function CreatorCard({ creator }) {
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
    <li className="dash-surface rounded-xl border border-white/10 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold truncate">{creator.full_name || '—'}</div>
          <div className="text-xs text-white/40 font-num truncate">@{creator.handle}</div>
          <div className="text-[10px] text-white/30 font-num truncate">{creator.email}</div>
        </div>
        <div className="text-end shrink-0">
          <div className={`text-xs font-bold ${verCls}`}>{t(`admin.cr.ver.${creator.verification_status}`)}</div>
          {disabled && <div className="text-[10px] text-qahwa-red font-bold">{t('admin.cr.disabled')}</div>}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="text-white/40">{t('admin.cr.col.balance')}</span>
          <span className="font-num font-bold ms-1.5">{fmtKd(creator.balance_kd)}</span>
        </div>
        <div>
          <span className="text-white/40">{t('admin.cr.col.earnings')}</span>
          <span className="font-num font-bold ms-1.5">{fmtKd(creator.total_earned_kd)}</span>
        </div>
        <button onClick={toggle} disabled={busy}
          className={`text-xs font-bold rounded-lg px-3 py-2 min-h-[36px]
            ${disabled ? 'bg-qahwa-accent text-qahwa-black' : 'bg-qahwa-red/20 text-qahwa-red border border-qahwa-red/40'}`}>
          {busy ? t('common.loading') : disabled ? t('admin.cr.enable') : t('admin.cr.disable')}
        </button>
      </div>
    </li>
  );
}
