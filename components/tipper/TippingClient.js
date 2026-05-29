// ============================================================
// TIPPING CLIENT COMPONENT — Flewd palette (light only)
// language toggle (AR/EN), pill cup selector, custom amount,
// payment initiation, success screen with confetti
// ============================================================
'use client';

import { useState, useEffect } from 'react';
import Spinner from '@/components/Spinner';

// ── Flewd palette (fixed, light-only) ───────────────────────
const C = {
  bg:     '#F5F0FF', // very light lavender page background
  card:   '#FFFFFF',
  ink:    '#0D0D0D', // black borders/text
  accent: '#C8F55A', // yellow-green CTA
  purple: '#7B2FBE', // primary purple (selected state)
  violet: '#9B4DCA', // secondary violet
  soft:   '#EDE4FB', // soft lavender fill
  muted:  '#6B6680',
};

// ── i18n strings ────────────────────────────────────────────
const STR = {
  ar: {
    dir: 'rtl', other: 'EN', otherName: 'English',
    totalCoffees: 'إجمالي القهوات',
    chooseCoffees: 'اختر عدد القهوات ☕',
    cupLabel: { 1: 'قهوة', 3: '٣ قهوات', 5: '٥ قهوات' },
    leaveMessage: 'اترك رسالة 💬',
    messagePlaceholder: (n) => `اترك رسالة لـ ${n}...`,
    namePlaceholder: 'اسمك (اختياري)',
    phonePlaceholder: '+965 XXXX XXXX (لتلقي الرد)',
    payBtn: (amt) => `☕ أرسل القهوة · ${amt} KD`,
    processing: 'جاري المعالجة...',
    amazingDefault: 'أنت رائع! حدد مبلغًا بإرادتك',
    minErr: (m) => `الحد الأدنى ${m} KD`,
    genericErr: 'حدث خطأ',
    recentSupporters: 'آخر الداعمين 🤍',
    supporterDefault: 'داعم',
    boughtAmazing: 'أرسل مبلغًا حرًا',
    bought: (n) => `اشترى ${n} ${n === 1 ? 'قهوة' : 'قهوات'}`,
    todayProof: (n, name) => `☕ اشترى ${n} ${n === 2 ? 'شخصان' : 'أشخاص'} اليوم قهوة لـ ${name}!`,
    closeAria: 'إغلاق',
    successTitle: 'وصلت قهوتك!',
    successBody: (n) => `ستتلقى ردًا شخصيًا من ${n} قريباً 🤍`,
    sendAnother: '☕ أرسل قهوة أخرى',
  },
  en: {
    dir: 'ltr', other: 'ع', otherName: 'العربية',
    totalCoffees: 'Total coffees',
    chooseCoffees: 'Choose how many ☕',
    cupLabel: { 1: 'coffee', 3: '3 coffees', 5: '5 coffees' },
    leaveMessage: 'Leave a message 💬',
    messagePlaceholder: (n) => `Leave a message for ${n}...`,
    namePlaceholder: 'Your name (optional)',
    phonePlaceholder: '+965 XXXX XXXX (to get a reply)',
    payBtn: (amt) => `☕ Send coffee · ${amt} KD`,
    processing: 'Processing...',
    amazingDefault: "You're amazing! Pick any amount",
    minErr: (m) => `Minimum ${m} KD`,
    genericErr: 'Something went wrong',
    recentSupporters: 'Recent supporters 🤍',
    supporterDefault: 'Someone',
    boughtAmazing: 'sent a custom amount',
    bought: (n) => `bought ${n} ${n === 1 ? 'coffee' : 'coffees'}`,
    todayProof: (n, name) => `☕ ${n} people have bought ${name} a coffee today!`,
    closeAria: 'Close',
    successTitle: 'Your coffee is on its way!',
    successBody: (n) => `You'll get a personal reply from ${n} soon 🤍`,
    sendAnother: '☕ Send another coffee',
  },
};

function Confetti() {
  const colors = [C.accent, C.purple, C.violet, '#FF5A5A', '#38BDF8'];
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}>
      <style>{`@keyframes qahwa-fall{0%{transform:translateY(-12vh) rotate(0);opacity:1}100%{transform:translateY(112vh) rotate(720deg);opacity:.85}}@keyframes qahwa-pop{0%{transform:scale(0)}60%{transform:scale(1.25)}100%{transform:scale(1)}}`}</style>
      {Array.from({ length: 70 }).map((_, i) => {
        const size = 6 + Math.random() * 9;
        return (
          <span key={i} style={{
            position: 'absolute', left: `${Math.random() * 100}%`, top: '-12vh',
            width: size, height: size * 0.6, background: colors[i % colors.length], borderRadius: 2,
            animation: `qahwa-fall ${2.6 + Math.random() * 2}s ${Math.random() * 0.5}s linear forwards`,
          }} />
        );
      })}
    </div>
  );
}

// Display-only KD formatter for the tipping page. Shows one decimal
// place (e.g. "1.5 KD") so supporters read a friendly number — the
// underlying value submitted to the payment gateway keeps fils-level
// (3-decimal) precision. Dashboard / admin / receipts still use the
// canonical fmtKd from lib/i18n.js.
const fmtKd1 = (v) => Number(v || 0).toFixed(1);

// ─────────────────────────────────────────────────────────────
// Social-proof toast — animates in at the top of the page on
// load, auto-dismisses after 4s, has an X to close early.
// Flewd palette: lavender bg, purple border, Syne bold headline.
// Render gate (count >= 2) lives in the parent so this stays dumb.
// ─────────────────────────────────────────────────────────────
function SocialProofToast({ message, closeAria, dir }) {
  const [open, setOpen] = useState(true);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Trigger slide-in on the next frame so the initial transform
    // commits before transitioning to the final state.
    const r = requestAnimationFrame(() => setEntered(true));
    const t = setTimeout(() => setOpen(false), 4000);
    return () => { cancelAnimationFrame(r); clearTimeout(t); };
  }, []);

  if (!open) return null;
  return (
    <div role="status" aria-live="polite" dir={dir}
      style={{
        position: 'fixed', top: 12, left: '50%',
        transform: `translateX(-50%) translateY(${entered ? '0' : '-120%'})`,
        opacity: entered ? 1 : 0,
        transition: 'transform .35s cubic-bezier(.2,.9,.3,1.2), opacity .25s',
        background: '#F5F0FF',
        border: '2px solid #7B2FBE',
        color: '#0D0D0D',
        borderRadius: 14,
        boxShadow: '4px 4px 0 #0D0D0D',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        maxWidth: 'min(92vw, 420px)',
        fontFamily: "'Syne', sans-serif",
        fontWeight: 800,
        fontSize: 13.5,
        letterSpacing: '-0.01em',
        lineHeight: 1.35,
        zIndex: 50,
      }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button type="button" onClick={() => setOpen(false)} aria-label={closeAria}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#7B2FBE', fontWeight: 900, fontSize: 18, lineHeight: 1,
          padding: '0 4px',
        }}>×</button>
    </div>
  );
}

export default function TippingClient({ creator, settings, recentTips, todayCount = 0, showSuccess }) {
  const [lang, setLang]                 = useState('ar');

  // Persist the supporter's language across the payment redirect (same origin).
  useEffect(() => {
    try {
      const stored = localStorage.getItem('qahwa_lang');
      if (stored === 'ar' || stored === 'en') setLang(stored);
    } catch {}
  }, []);

  const [selectedCups, setSelectedCups] = useState(1);
  const [isAmazing, setIsAmazing]       = useState(false);
  const [amazingAmt, setAmazingAmt]     = useState('');
  const [message, setMessage]           = useState('');
  const [supporterName, setSupporterName] = useState('');
  const [supporterPhone, setSupporterPhone] = useState('');
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState(showSuccess);
  const [error, setError]               = useState('');

  const t   = STR[lang];
  const dir = t.dir;
  const price = Number(creator.coffee_price_kd);

  const grossAmount = isAmazing
    ? Number(parseFloat(amazingAmt || 0).toFixed(3))
    : Number((price * selectedCups).toFixed(3));

  const showAmazing = creator.amazing_enabled && settings?.amazing_enabled_global !== false;

  async function handlePay() {
    if (loading) return;
    if (isAmazing && (!amazingAmt || grossAmount < (settings?.amazing_min_kd || 0.5))) {
      setError(t.minErr(fmtKd1(settings?.amazing_min_kd || 0.5)));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorHandle: creator.handle,
          cups:          isAmazing ? 0 : selectedCups,
          isAmazing,
          grossAmount,
          message:       message || undefined,
          supporterName: supporterName || undefined,
          supporterPhone: supporterPhone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.genericErr);
      window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const toggleLang = () => setLang((l) => {
    const next = l === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('qahwa_lang', next); } catch {}
    return next;
  });

  // ── STYLES (Flewd) ──────────────────────────────────────────
  const s = {
    page: { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem 3rem', fontFamily: "'Tajawal', sans-serif" },
    card: { position: 'relative', background: C.card, border: `2px solid ${C.ink}`, borderRadius: 28, padding: '2rem 1.75rem', width: '100%', maxWidth: 430, boxShadow: `5px 5px 0 ${C.ink}` },
    name: { fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: '-0.04em', direction: dir, textAlign: 'center' },
    bio: { fontSize: 14, color: '#4A4458', direction: dir, textAlign: 'center', lineHeight: 1.6, background: C.soft, borderRadius: 14, padding: '10px 14px', border: `2px solid ${C.ink}`, margin: '12px 0' },
    cupPill: (sel) => ({
      flex: 1, border: `2px solid ${C.ink}`, borderRadius: 999,
      background: sel ? C.purple : C.card, color: sel ? '#fff' : C.ink,
      boxShadow: sel ? `3px 3px 0 ${C.ink}` : 'none',
      padding: '14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      cursor: 'pointer', transition: 'all .15s',
    }),
    cupAmt: { fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800 },
    payBtn: {
      width: '100%', background: C.accent, color: C.ink, border: `2px solid ${C.ink}`,
      borderRadius: 999, padding: 17, fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800,
      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, direction: dir,
      boxShadow: `4px 4px 0 ${C.ink}`, transition: 'all .12s',
    },
    input: { width: '100%', border: `2px solid ${C.ink}`, borderRadius: 14, padding: '11px 14px', fontSize: 14, fontFamily: "'Tajawal', sans-serif", direction: dir, background: C.card, color: C.ink, outline: 'none', marginBottom: 10 },
    divider: { height: 2, background: C.soft, margin: '1.1rem 0', borderRadius: 2 },
    sectionLabel: { fontSize: 12, fontWeight: 800, color: C.purple, textAlign: 'center', direction: dir, marginBottom: 10, letterSpacing: '0.02em' },
    errorBox: { background: '#FFF0F0', border: `2px solid #FF5A5A`, borderRadius: 12, padding: '8px 14px', fontSize: 13, color: '#C00', direction: dir, marginBottom: 10, fontWeight: 700 },
    pmRow: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' },
    pmBadge: { border: `1.5px solid ${C.ink}`, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: "'DM Sans', sans-serif" },
    langBtn: { position: 'absolute', top: 16, insetInlineEnd: 16, border: `2px solid ${C.ink}`, background: C.card, color: C.ink, borderRadius: 999, padding: '5px 13px', fontSize: 13, fontWeight: 800, fontFamily: "'Syne', sans-serif", cursor: 'pointer', zIndex: 2, boxShadow: `2px 2px 0 ${C.ink}` },
    social: { background: C.purple, color: '#fff', border: `2px solid ${C.ink}`, borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' },
  };

  if (success) {
    return (
      <div style={s.page} dir={dir}>
        <Confetti />
        <div style={{ ...s.card, textAlign: 'center', padding: '3rem 2rem' }}>
          <button style={s.langBtn} onClick={toggleLang} aria-label={t.otherName}>{t.other}</button>
          <div style={{ fontSize: 76, marginBottom: 16, animation: 'qahwa-pop .5s ease-out' }}>☕</div>
          <h2 style={{ ...s.name, marginBottom: 8 }}>{t.successTitle}</h2>
          <p style={{ ...s.bio }}>
            {message ? `"${message}"\n\n` : ''}
            {t.successBody(creator.full_name)}
          </p>
          <button
            style={{ ...s.payBtn, marginTop: 24, fontSize: 15 }}
            onClick={() => { setSuccess(false); window.history.replaceState({}, '', `/${creator.handle}`); }}
          >
            {t.sendAnother}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page} dir={dir}>
      {/* Daily social-proof toast — only shown when today's tip count
          is 2+ (i.e. the 3rd+ visitor sees the warmth). Auto-dismisses
          after 4s; key={todayCount} resets state on prop change. */}
      {todayCount >= 2 && (
        <SocialProofToast
          key={`proof-${todayCount}-${lang}`}
          message={t.todayProof(todayCount, creator.full_name)}
          closeAria={t.closeAria}
          dir={dir}
        />
      )}
      <div style={s.card}>
        <button style={s.langBtn} onClick={toggleLang} aria-label={t.otherName}>{t.other}</button>

        {/* Avatar — display:grid + placeItems:center because flex doesn't
            reliably resolve cross-axis percentage heights for replaced
            elements (the <img> collapses to its intrinsic aspect ratio in
            Safari/iOS). Same pattern as PendingApprovalPage + SettingsForm. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
          {/* Avatar + verified badge. The circle keeps overflow:hidden to
              clip the image, so the badge sits on a sibling absolute layer
              of a relatively-positioned wrapper — same trick Twitter/X uses. */}
          <div style={{ position: 'relative', width: 84, height: 84, marginBottom: 12 }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', border: `2px solid ${C.ink}`, boxShadow: `3px 3px 0 ${C.ink}`, overflow: 'hidden', display: 'grid', placeItems: 'center', background: C.soft, fontSize: 38 }}>
              {creator.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={creator.avatar_url} alt={creator.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (creator.avatar_emoji || '🎙️')}
            </div>
            {creator.is_verified && (
              <span
                aria-label="Verified"
                title="Verified"
                style={{
                  position: 'absolute',
                  bottom: -2, right: -2,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#1D9BF0',
                  border: '2px solid #FFFFFF',
                  display: 'grid', placeItems: 'center',
                  color: '#FFFFFF', fontSize: 12, fontWeight: 900,
                  lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                }}>✓</span>
            )}
          </div>
          {/* Name no longer carries the inline ✓ — the avatar badge is the
              dedicated verified signal, and Twitter-blue reads unambiguously. */}
          <div style={s.name}>{creator.full_name}</div>
          <div style={{ fontSize: 12, color: C.violet, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, marginBottom: 6 }}>
            qahwa.kw/{creator.handle}
          </div>
          {creator.bio && <div style={s.bio}>{creator.bio}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
            {creator.instagram && <a href={`https://${creator.instagram}`} target="_blank" rel="noreferrer" style={s.social}>📸</a>}
            {creator.twitter   && <a href={`https://${creator.twitter}`}   target="_blank" rel="noreferrer" style={s.social}>🐦</a>}
            {creator.youtube   && <a href={`https://${creator.youtube}`}   target="_blank" rel="noreferrer" style={s.social}>▶️</a>}
            {creator.tiktok    && <a href={`https://${creator.tiktok}`}    target="_blank" rel="noreferrer" style={s.social}>🎵</a>}
          </div>
        </div>

        {/* Total counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `2px solid ${C.ink}`, borderRadius: 14, padding: '9px 14px', marginBottom: '1.1rem', background: C.soft, boxShadow: `3px 3px 0 ${C.ink}` }}>
          <span style={{ fontSize: 12, color: '#4A4458', fontWeight: 700 }}>{t.totalCoffees}</span>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: C.purple }}>☕ {creator.total_tips_count}</span>
        </div>

        <div style={s.divider} />
        <div style={s.sectionLabel}>{t.chooseCoffees}</div>

        {/* Cup selector — pills */}
        <div style={{ display: 'flex', gap: 9, marginBottom: '1.1rem' }}>
          {[1, 3, 5].map(cups => {
            const sel = !isAmazing && selectedCups === cups;
            return (
              <button key={cups} style={s.cupPill(sel)} onClick={() => { setSelectedCups(cups); setIsAmazing(false); }}>
                <span style={{ fontSize: cups === 5 ? 22 : 20 }}>{cups === 1 ? '☕' : cups === 3 ? '☕☕☕' : '🫖'}</span>
                <span style={{ fontSize: 10, opacity: 0.8 }}>{t.cupLabel[cups]}</span>
                <span style={s.cupAmt}>{fmtKd1(price * cups)}</span>
                <span style={{ fontSize: 9, opacity: 0.7 }}>KD</span>
              </button>
            );
          })}
        </div>

        {/* Custom amount box */}
        {showAmazing && (
          <div style={{ border: `2px solid ${C.ink}`, borderRadius: 18, padding: '12px 14px', marginBottom: '1.1rem', background: isAmazing ? C.soft : C.card, cursor: 'pointer', boxShadow: isAmazing ? `3px 3px 0 ${C.purple}` : 'none', transition: 'all .15s' }}
            onClick={() => setIsAmazing(!isAmazing)}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: isAmazing ? C.purple : C.ink, marginBottom: 4, direction: dir }}>
              {isAmazing ? '✓ ' : ''}☀️ {creator.amazing_message || t.amazingDefault}
            </div>
            {isAmazing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                <input type="number" value={amazingAmt} onChange={e => setAmazingAmt(e.target.value)}
                  placeholder={`${settings?.amazing_min_kd || 0.5}`} min={settings?.amazing_min_kd || 0.5} max={settings?.amazing_max_kd || 50} step="0.5"
                  style={{ ...s.input, flex: 1, marginBottom: 0, direction: 'ltr', textAlign: 'center', fontSize: 18, fontWeight: 700 }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: C.purple }}>KD</span>
              </div>
            )}
          </div>
        )}

        <div style={s.sectionLabel}>{t.leaveMessage}</div>
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t.messagePlaceholder(creator.full_name)} maxLength={200}
          style={{ ...s.input, minHeight: 64, resize: 'none', lineHeight: 1.55 }} />

        <input value={supporterName} onChange={e => setSupporterName(e.target.value)} placeholder={t.namePlaceholder} style={s.input} />
        <input value={supporterPhone} onChange={e => setSupporterPhone(e.target.value)} placeholder={t.phonePlaceholder} style={{ ...s.input, direction: 'ltr' }} />

        {error && <div style={s.errorBox}>{error}</div>}

        <button style={s.payBtn} onClick={handlePay} disabled={loading}
                className={loading ? 'qahwa-pulse' : ''}
                aria-busy={loading}>
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <Spinner size={18} color={C.ink} />
              {t.processing}
            </span>
          ) : t.payBtn(fmtKd1(grossAmount))}
        </button>

        <div style={s.pmRow}>
          {['KNET', 'Apple Pay', 'Visa', 'Mastercard'].map(pm => (
            <span key={pm} style={s.pmBadge}>{pm}</span>
          ))}
        </div>

        {/* Recent tips feed */}
        {recentTips.length > 0 && (
          <>
            <div style={s.divider} />
            <div style={s.sectionLabel}>{t.recentSupporters}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {recentTips.map((tip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4A4458', direction: dir, background: C.soft, border: `2px solid ${C.ink}`, borderRadius: 12, padding: '8px 12px', fontWeight: 600 }}>
                  <span>☕</span>
                  <span>{tip.supporter_name || t.supporterDefault} {tip.is_amazing ? t.boughtAmazing : t.bought(tip.cups)}</span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
