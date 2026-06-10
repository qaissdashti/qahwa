'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/components/LangProvider';
import Spinner from '@/components/Spinner';
import { xhrUpload } from '@/lib/xhrUpload';
import { KUWAIT_BANKS, bankLabel } from '@/lib/kuwaitBanks';
import { COFFEE_PRICE_OPTIONS } from '@/lib/coffeePrices';

// Flewd palette (mirrors the live tipping page) for the preview panel
const F = { bg: '#F5F0FF', card: '#FFFFFF', ink: '#0D0D0D', accent: '#C8F55A', purple: '#7B2FBE', violet: '#9B4DCA', soft: '#EDE4FB' };

export default function SettingsForm({ creator, maxPrice, amazingGlobal }) {
  const router = useRouter();
  const { t } = useLang();
  const [f, setF] = useState({
    full_name:       creator?.full_name || '',
    avatar_emoji:    creator?.avatar_emoji || '☕',
    bio:             creator?.bio || '',
    coffee_price_kd: creator?.coffee_price_kd ?? 1,
    amazing_enabled: creator?.amazing_enabled ?? true,
    amazing_message: creator?.amazing_message || '',
    instagram:       creator?.instagram || '',
    twitter:         creator?.twitter || '',
    youtube:         creator?.youtube || '',
    tiktok:          creator?.tiktok || '',
    bank_name:       creator?.bank_name || '',
    account_holder:  creator?.account_holder || '',
  });
  // IBAN entry is separate: input starts empty, current value shown masked
  // alongside; sending an empty string keeps the saved one.
  const [ibanNew, setIbanNew] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(creator?.avatar_url || null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPct, setAvatarPct] = useState(0);

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null); setAvatarBusy(true); setAvatarPct(0);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const json = await xhrUpload('/api/creator/avatar', fd, (p) => setAvatarPct(p));
      setAvatarUrl(json.url);
      router.refresh();
    } catch (err) { setMsg({ type: 'err', text: err.message || t('sset.uploadFail') }); }
    finally { setAvatarBusy(false); setAvatarPct(0); }
  }

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((p) => ({ ...p, [k]: v }));
  };

  async function save(e) {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      // Only send `iban` if the user typed a new value — empty keeps the
      // saved one. The route validates + encrypts when present.
      const body = { ...f };
      if (ibanNew.trim()) body.iban = ibanNew.replace(/\s+/g, '').toUpperCase();
      const res = await fetch('/api/creator/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t('common.somethingWrong'));
      setMsg({ type: 'ok', text: t('common.saved') });
      setIbanNew('');
      router.refresh();
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
    finally { setLoading(false); }
  }

  const card = 'dash-surface rounded-2xl border border-white/10 p-5 space-y-3';
  const input = 'w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-qahwa-purple';
  const label = 'block text-sm font-bold text-white/70 mb-1';
  const price = Number(f.coffee_price_kd) || 0;

  return (
    <div className="grid lg:grid-cols-[1fr_auto] gap-5 items-start">
      <form onSubmit={save} className="grid gap-4 max-w-2xl">
        {/* profile */}
        <div className={card}>
          <h2 className="text-lg">{t('sset.profile')}</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-white/15 bg-black/40 grid place-items-center text-3xl shrink-0">
              {avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <span>{f.avatar_emoji || '☕'}</span>}
            </div>
            <label className="text-sm font-bold rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2 cursor-pointer inline-flex items-center gap-2">
              {avatarBusy && <Spinner size={14} />}
              {avatarBusy
                ? (avatarPct > 0 ? t('common.uploading', { pct: avatarPct }) : t('common.processing'))
                : t('sset.uploadAvatar')}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadAvatar} disabled={avatarBusy} />
            </label>
            {avatarUrl && !avatarBusy && <span className="text-xs text-white/40">{t('sset.avatarUsesImage')}</span>}
          </div>
          <div className="flex gap-3">
            <div className="w-20">
              <label className={label}>{t('sset.emoji')}</label>
              <input className={`${input} text-center text-2xl`} maxLength={4} value={f.avatar_emoji} onChange={set('avatar_emoji')} />
            </div>
            <div className="flex-1">
              <label className={label}>{t('sset.name')}</label>
              <input className={input} value={f.full_name} onChange={set('full_name')} />
            </div>
          </div>
          <div>
            <label className={label}>{t('sset.bio')}</label>
            <textarea className={input} rows={2} maxLength={280} value={f.bio} onChange={set('bio')} placeholder={t('sset.bioPlaceholder')} />
          </div>
          <div className="text-xs text-white/40 font-num" dir="ltr">qahwa.kw/{creator?.handle}</div>
        </div>

        {/* pricing */}
        <div className={card}>
          <h2 className="text-lg">{t('sset.pricing')}</h2>
          <div>
            <label className={label}>{t('sset.cupPricePick')}</label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('sset.cupPricePick')}>
              {COFFEE_PRICE_OPTIONS.map((p) => {
                const selected = Number(f.coffee_price_kd) === p;
                return (
                  <button key={p} type="button" role="radio" aria-checked={selected}
                    onClick={() => setF((prev) => ({ ...prev, coffee_price_kd: p }))}
                    className={`px-3.5 py-2 rounded-xl border-2 font-bold font-num text-sm transition-all
                      ${selected
                        ? 'bg-qahwa-purple text-white border-qahwa-purple'
                        : 'bg-black/40 text-white border-white/15 hover:border-white/40'}`}>
                    {p.toFixed(1)} <span className="opacity-70 text-xs">KD</span>
                  </button>
                );
              })}
            </div>
          </div>
          {amazingGlobal && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={f.amazing_enabled} onChange={set('amazing_enabled')} className="w-4 h-4 accent-qahwa-purple" />
                <span className="font-bold text-sm">{t('sset.amazingEnable')}</span>
              </label>
              {f.amazing_enabled && (
                <input className={input} value={f.amazing_message} onChange={set('amazing_message')} placeholder={t('sset.amazingMsg')} maxLength={200} />
              )}
            </>
          )}
        </div>

        {/* bank details (used for payouts) */}
        <div className={card}>
          <h2 className="text-lg">{t('sset.bank')}</h2>
          <p className="text-xs text-white/50 font-medium">{t('sset.bankNote')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={label}>{t('sset.bankName')}</label>
              <select className={input} value={f.bank_name} onChange={set('bank_name')}>
                <option value="">{t('sset.bankNamePh')}</option>
                {/* If the saved value is legacy free-text that doesn't match
                    a known bank, keep it visible so we don't silently lose it. */}
                {f.bank_name && !KUWAIT_BANKS.some((b) => b.value === f.bank_name) && (
                  <option value={f.bank_name}>{f.bank_name}</option>
                )}
                {KUWAIT_BANKS.map((b) => (
                  <option key={b.en} value={b.value}>{bankLabel(b)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>{t('sset.accountHolder')}</label>
              <input className={input} value={f.account_holder} onChange={set('account_holder')} placeholder={t('sset.holderPh')} />
            </div>
          </div>
          <div>
            <label className={label}>{t('sset.iban')}</label>
            {creator?.iban_masked && (
              <div className="text-xs text-qahwa-accent font-num mb-1.5" dir="ltr">{t('sset.ibanSaved', { iban: creator.iban_masked })}</div>
            )}
            <input className={`${input} font-num`} dir="ltr" value={ibanNew}
                   onChange={(e) => setIbanNew(e.target.value.toUpperCase())}
                   placeholder={creator?.iban_masked ? t('sset.ibanPlaceholderSaved') : t('sset.ibanPlaceholderEmpty')} />
          </div>
        </div>

        {/* socials */}
        <div className={card}>
          <h2 className="text-lg">{t('sset.socials')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {['instagram', 'twitter', 'youtube', 'tiktok'].map((sName) => (
              <input key={sName} className={`${input} font-num`} dir="ltr" placeholder={sName} value={f[sName]} onChange={set(sName)} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="q-btn-accent inline-flex items-center justify-center gap-2 min-w-[140px]" disabled={loading}>
            {loading && <Spinner size={16} />}
            {loading ? t('common.processing') : t('common.saveChanges')}
          </button>
          {msg && <span className={`font-bold text-sm ${msg.type === 'ok' ? 'text-qahwa-accent' : 'text-qahwa-red'}`}>{msg.text}</span>}
        </div>
      </form>

      {/* ── Live Flewd page preview (purple-accented panel) ── */}
      <div className="dash-surface rounded-2xl border-2 border-qahwa-purple/60 p-4 lg:w-[340px] w-full">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full" style={{ background: F.purple }} />
          <h2 className="text-sm font-extrabold" style={{ color: F.violet }}>{t('sset.previewTitle')}</h2>
        </div>

        {/* mini tipping card */}
        <div style={{ background: F.bg, borderRadius: 18, padding: 16 }}>
          <div style={{ background: F.card, border: `2px solid ${F.ink}`, borderRadius: 20, boxShadow: `4px 4px 0 ${F.ink}`, padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${F.ink}`, boxShadow: `2px 2px 0 ${F.ink}`, overflow: 'hidden', display: 'grid', placeItems: 'center', background: F.soft, fontSize: 26 }}>
                {avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (f.avatar_emoji || '☕')}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 16, color: F.ink, textAlign: 'center' }}>{f.full_name || t('sset.previewName')}</div>
              <div style={{ fontSize: 10, color: F.violet, fontWeight: 700 }}>qahwa.kw/{creator?.handle}</div>
            </div>

            {/* cup pills */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              {[1, 3, 5].map((n, i) => {
                const sel = i === 0;
                return (
                  <div key={n} style={{ flex: 1, border: `2px solid ${F.ink}`, borderRadius: 999, background: sel ? F.purple : F.card, color: sel ? '#fff' : F.ink, boxShadow: sel ? `2px 2px 0 ${F.ink}` : 'none', padding: '8px 2px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13 }}>☕</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 11 }}>{(price * n).toFixed(3)}</div>
                  </div>
                );
              })}
            </div>

            {/* CTA pill */}
            <div style={{ marginTop: 12, background: F.accent, color: F.ink, border: `2px solid ${F.ink}`, borderRadius: 999, boxShadow: `3px 3px 0 ${F.ink}`, textAlign: 'center', padding: '11px 8px', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 13 }}>
              {t('sset.previewCta', { amt: price.toFixed(3) })}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-white/40 mt-3 leading-relaxed">{t('sset.previewNote')}</p>
      </div>
    </div>
  );
}
