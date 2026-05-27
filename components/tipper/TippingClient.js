// ============================================================
// TIPPING CLIENT COMPONENT
// Handles: language toggle (AR/EN), cup selection, amazing box,
//          payment initiation, success screen with confetti
// ============================================================
'use client';

import { useState, useEffect } from 'react';

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
    amazingDefault: 'أنت رائع! حدد مبلغًا بإرادتك',
    minErr: (m) => `الحد الأدنى ${m} KD`,
    genericErr: 'حدث خطأ',
    recentSupporters: 'آخر الداعمين 🤍',
    supporterDefault: 'داعم',
    boughtAmazing: 'أرسل مبلغًا حرًا',
    bought: (n) => `اشترى ${n} ${n === 1 ? 'قهوة' : 'قهوات'}`,
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
    amazingDefault: "You're amazing! Pick any amount",
    minErr: (m) => `Minimum ${m} KD`,
    genericErr: 'Something went wrong',
    recentSupporters: 'Recent supporters 🤍',
    supporterDefault: 'Someone',
    boughtAmazing: 'sent a custom amount',
    bought: (n) => `bought ${n} ${n === 1 ? 'coffee' : 'coffees'}`,
    successTitle: 'Your coffee is on its way!',
    successBody: (n) => `You'll get a personal reply from ${n} soon 🤍`,
    sendAnother: '☕ Send another coffee',
  },
};

function Confetti() {
  const colors = ['#C8F55A', '#FF5A5A', '#8B7FF5', '#38BDF8', '#F59A38'];
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

export default function TippingClient({ creator, settings, recentTips, showSuccess }) {
  const [lang, setLang]                 = useState('ar');

  // Persist the supporter's language across the payment redirect (same
  // origin), so the success screen shows in the language they chose.
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
  const price  = Number(creator.coffee_price_kd);
  const bg     = creator.theme_bg   || '#FAFAF7';
  const text   = creator.theme_text || '#0D0D0D';
  const isDark = bg === '#0D0D0D';

  const grossAmount = isAmazing
    ? Number(parseFloat(amazingAmt || 0).toFixed(3))
    : Number((price * selectedCups).toFixed(3));

  const showAmazing = creator.amazing_enabled && settings?.amazing_enabled_global !== false;

  async function handlePay() {
    if (loading) return;
    if (isAmazing && (!amazingAmt || grossAmount < (settings?.amazing_min_kd || 0.5))) {
      setError(t.minErr(settings?.amazing_min_kd || 0.5));
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
      // Redirect to MyFatoorah hosted page (or, in test mode, straight to success)
      window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  // ── STYLES ──────────────────────────────────────────────────
  const s = {
    page: { minHeight: '100vh', background: bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem 3rem', fontFamily: "'Tajawal', sans-serif" },
    card: { position: 'relative', background: isDark ? '#141414' : '#fff', border: `1.5px solid ${isDark ? '#2A2A2A' : '#E0E0D8'}`, borderRadius: 24, padding: '2rem 1.75rem', width: '100%', maxWidth: 420, boxShadow: `4px 4px 0 ${isDark ? '#333' : text}` },
    name: { fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: text, letterSpacing: '-0.04em', direction: dir, textAlign: 'center' },
    bio: { fontSize: 14, color: isDark ? '#bbb' : '#444', direction: dir, textAlign: 'center', lineHeight: 1.6, background: isDark ? '#1A1A1A' : '#FFF8F0', borderRadius: 12, padding: '10px 14px', border: `1px solid ${isDark ? '#2A2A2A' : '#F0E4D7'}`, margin: '10px 0' },
    cupBtn: (sel) => ({ flex: 1, border: `2px solid ${sel ? text : isDark ? '#2A2A2A' : '#E0E0D8'}`, borderRadius: 14, background: sel ? text : isDark ? '#1A1A1A' : '#FFF8F0', padding: '12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', transition: 'all .15s' }),
    cupAmt: (sel) => ({ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: sel ? (isDark ? '#C8F55A' : '#FAFAF7') : text }),
    payBtn: { width: '100%', background: text, color: bg, border: 'none', borderRadius: 16, padding: 16, fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, direction: dir, boxShadow: `3px 3px 0 ${isDark ? '#C8F55A' : '#0D0D0D'}`, transition: 'all .15s' },
    input: { width: '100%', border: `1.5px solid ${isDark ? '#2A2A2A' : '#E0E0D8'}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: "'Tajawal', sans-serif", direction: dir, background: isDark ? '#1A1A1A' : '#FFF8F0', color: isDark ? '#FAFAF7' : '#1A1A1A', outline: 'none', marginBottom: 10 },
    divider: { height: 1, background: isDark ? '#222' : '#F0E4D7', margin: '1rem 0' },
    sectionLabel: { fontSize: 12, fontWeight: 700, color: isDark ? '#666' : '#C09070', textAlign: 'center', direction: dir, marginBottom: 8 },
    errorBox: { background: '#FFF0F0', border: '1px solid #FFB0B0', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#C00', direction: dir, marginBottom: 10 },
    pmRow: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 },
    pmBadge: { border: `1px solid ${isDark ? '#333' : '#E0E0D8'}`, borderRadius: 7, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: isDark ? '#666' : '#888', fontFamily: "'DM Sans', sans-serif" },
    langBtn: { position: 'absolute', top: 14, insetInlineEnd: 14, border: `1.5px solid ${isDark ? '#2A2A2A' : '#E0E0D8'}`, background: isDark ? '#1A1A1A' : '#FFF8F0', color: text, borderRadius: 10, padding: '5px 12px', fontSize: 13, fontWeight: 800, fontFamily: "'Syne', sans-serif", cursor: 'pointer', zIndex: 2 },
  };

  const toggleLang = () => setLang((l) => {
    const next = l === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('qahwa_lang', next); } catch {}
    return next;
  });

  if (success) {
    return (
      <div style={s.page} dir={dir}>
        <Confetti />
        <div style={{ ...s.card, textAlign: 'center', padding: '3rem 2rem' }}>
          <button style={s.langBtn} onClick={toggleLang} aria-label={t.otherName}>{t.other}</button>
          <div style={{ fontSize: 72, marginBottom: 16, animation: 'qahwa-pop .5s ease-out' }}>☕</div>
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
      <div style={s.card}>
        <button style={s.langBtn} onClick={toggleLang} aria-label={t.otherName}>{t.other}</button>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', border: `3px solid ${text}`, boxShadow: `3px 3px 0 ${text}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#1A1A1A' : '#FFF8F0', fontSize: 36, marginBottom: 10 }}>
            {creator.avatar_url
              ? <img src={creator.avatar_url} alt={creator.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (creator.avatar_emoji || '🎙️')}
          </div>
          <div style={s.name}>{creator.full_name} {creator.is_verified && '✓'}</div>
          <div style={{ fontSize: 12, color: isDark ? '#555' : '#aaa', fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>
            qahwa.kw/{creator.handle}
          </div>
          {creator.bio && <div style={s.bio}>{creator.bio}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
            {creator.instagram && <a href={`https://${creator.instagram}`} target="_blank" rel="noreferrer" style={{ background: text, color: bg, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>📸</a>}
            {creator.twitter   && <a href={`https://${creator.twitter}`}   target="_blank" rel="noreferrer" style={{ background: text, color: bg, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>🐦</a>}
            {creator.youtube   && <a href={`https://${creator.youtube}`}   target="_blank" rel="noreferrer" style={{ background: text, color: bg, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>▶️</a>}
            {creator.tiktok    && <a href={`https://${creator.tiktok}`}    target="_blank" rel="noreferrer" style={{ background: text, color: bg, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>🎵</a>}
          </div>
        </div>

        {/* Total counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1.5px solid ${isDark ? '#333' : text}`, borderRadius: 12, padding: '8px 14px', marginBottom: '1rem', background: isDark ? '#1A1A1A' : '#FFF0D8', boxShadow: `3px 3px 0 ${isDark ? '#333' : text}` }}>
          <span style={{ fontSize: 12, color: isDark ? '#666' : '#B08060' }}>{t.totalCoffees}</span>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: text }}>☕ {creator.total_tips_count}</span>
        </div>

        <div style={s.divider} />
        <div style={s.sectionLabel}>{t.chooseCoffees}</div>

        {/* Cup selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          {[1, 3, 5].map(cups => {
            const sel = !isAmazing && selectedCups === cups;
            return (
              <button key={cups} style={s.cupBtn(sel)} onClick={() => { setSelectedCups(cups); setIsAmazing(false); }}>
                <span style={{ fontSize: cups === 5 ? 22 : 20 }}>{cups === 1 ? '☕' : cups === 3 ? '☕☕☕' : '🫖'}</span>
                <span style={{ fontSize: 10, color: isDark ? '#666' : '#aaa' }}>{t.cupLabel[cups]}</span>
                <span style={s.cupAmt(sel)}>{(price * cups).toFixed(3)}</span>
                <span style={{ fontSize: 9, color: isDark ? '#555' : '#bbb' }}>KD</span>
              </button>
            );
          })}
        </div>

        {/* Amazing box */}
        {showAmazing && (
          <div style={{ border: `2px solid ${isAmazing ? text : isDark ? '#2A2A2A' : '#E0E0D8'}`, borderRadius: 14, padding: '12px 14px', marginBottom: '1rem', background: isDark ? '#1A1A1A' : '#FFFDF0', cursor: 'pointer', boxShadow: isAmazing ? `3px 3px 0 ${text}` : 'none', transition: 'all .15s' }}
            onClick={() => setIsAmazing(!isAmazing)}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: text, marginBottom: 4, direction: dir }}>
              {isAmazing ? '✓ ' : ''}☀️ {creator.amazing_message || t.amazingDefault}
            </div>
            {isAmazing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                <input type="number" value={amazingAmt} onChange={e => setAmazingAmt(e.target.value)}
                  placeholder={`${settings?.amazing_min_kd || 0.5}`} min={settings?.amazing_min_kd || 0.5} max={settings?.amazing_max_kd || 50} step="0.5"
                  style={{ ...s.input, flex: 1, marginBottom: 0, direction: 'ltr', textAlign: 'center', fontSize: 18, fontWeight: 700 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#666' : '#888' }}>KD</span>
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

        <button style={s.payBtn} onClick={handlePay} disabled={loading}>
          {loading ? '...' : t.payBtn(grossAmount.toFixed(3))}
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
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: isDark ? '#666' : '#7A6A5A', direction: dir, background: isDark ? '#1A1A1A' : '#FAF5F0', borderRadius: 10, padding: '7px 12px' }}>
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
