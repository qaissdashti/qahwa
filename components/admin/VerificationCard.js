'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/components/LangProvider';
import Spinner from '@/components/Spinner';
import { trackEvent } from '@/lib/mixpanel';

export default function VerificationCard({
  creatorId, fullName, handle, email, phone, phoneVerified, civilMasked, hasSelfie,
}) {
  const router = useRouter();
  const { t } = useLang();
  const [selfieUrl, setSelfieUrl] = useState(null);
  const [busy, setBusy]   = useState(false);
  const [action, setAction] = useState(null); // 'approve' | 'reject' | null
  const [error, setError] = useState('');

  async function viewSelfie() {
    setError('');
    try {
      const res = await fetch('/api/admin/selfie-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSelfieUrl(json.url);
    } catch (e) { setError(e.message || t('admin.vf.loadFail')); }
  }

  async function decide(a) {
    setBusy(true); setAction(a); setError('');
    try {
      const res = await fetch('/api/admin/verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, action: a }),
      });
      if (!res.ok) throw new Error('failed');
      trackEvent(a === 'approve' ? 'Creator Approved' : 'Creator Rejected', { creatorHandle: handle });
      router.refresh();
    } catch (e) { setError(t('common.somethingWrong')); setBusy(false); setAction(null); }
  }

  return (
    <div className="dash-surface rounded-2xl border border-white/10 p-5 space-y-3">
      <div>
        <div className="font-bold text-lg">{fullName || '—'}</div>
        <div className="text-xs text-white/40 font-num">@{handle} · {email}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Fact label={t('admin.vf.whatsapp')} value={phone || '—'} ok={phoneVerified} />
        <Fact label={t('admin.vf.civilId')} value={civilMasked || '—'} ok={!!civilMasked} />
      </div>

      {selfieUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={selfieUrl} alt="selfie" className="w-full max-h-72 object-contain rounded-xl border border-white/10 bg-black" />
      ) : (
        <button onClick={viewSelfie} disabled={!hasSelfie}
                className="w-full text-sm font-bold rounded-xl bg-white/5 hover:bg-white/10 py-2.5 disabled:opacity-40">
          {hasSelfie ? t('admin.vf.viewSelfie') : t('admin.vf.noPhoto')}
        </button>
      )}

      {error && <p className="text-qahwa-red text-sm font-bold">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={() => decide('approve')} disabled={busy}
                className="flex-1 q-btn-accent text-sm py-2.5 inline-flex items-center justify-center gap-2">
          {busy && action === 'approve' && <Spinner size={14} />}
          {busy && action === 'approve' ? t('common.processing') : t('admin.vf.approve')}
        </button>
        <button onClick={() => decide('reject')} disabled={busy}
                className="flex-1 text-sm font-bold rounded-xl bg-qahwa-red/20 text-qahwa-red border-2 border-qahwa-red/50 py-2.5 inline-flex items-center justify-center gap-2 min-h-[44px]">
          {busy && action === 'reject' && <Spinner size={14} />}
          {busy && action === 'reject' ? t('common.processing') : t('admin.vf.reject')}
        </button>
      </div>
    </div>
  );
}

function Fact({ label, value, ok }) {
  return (
    <div className="bg-black/30 rounded-xl px-3 py-2">
      <div className="text-white/40 text-xs">{label}</div>
      <div className="font-bold font-num flex items-center gap-1">
        <span className={ok ? 'text-qahwa-accent' : 'text-qahwa-red'}>{ok ? '✓' : '✕'}</span>
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
