// ============================================================
// TIPPING CLIENT COMPONENT
// Handles: cup selection, amazing box, payment initiation,
//          success animation with confetti
// ============================================================
'use client';

import { useState } from 'react';

export default function TippingClient({ creator, settings, recentTips, showSuccess }) {
  const [selectedCups, setSelectedCups] = useState(1);
  const [isAmazing, setIsAmazing]       = useState(false);
  const [amazingAmt, setAmazingAmt]     = useState('');
  const [message, setMessage]           = useState('');
  const [supporterName, setSupporterName] = useState('');
  const [supporterPhone, setSupporterPhone] = useState('');
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState(showSuccess);
  const [error, setError]               = useState('');

  const price  = Number(creator.coffee_price_kd);
  const bg     = creator.theme_bg   || '#FAFAF7';
  const text   = creator.theme_text || '#0D0D0D';
  const isDark = bg === '#0D0D0D';

  const grossAmount = isAmazing
    ? Number(parseFloat(amazingAmt || 0).toFixed(3))
    : Number((price * selectedCups).toFixed(3));

  const showAmazing =
    creator.amazing_enabled &&
    settings?.amazing_enabled_global !== false;

  async function handlePay() {
    if (loading) return;
    if (isAmazing && (!amazingAmt || grossAmount < (settings?.amazing_min_kd || 0.5))) {
      setError(`الحد الأدنى ${settings?.amazing_min_kd || 0.5} KD`);
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
      if (!res.ok) throw new Error(data.error || 'حدث خطأ');

      // Redirect to MyFatoorah hosted payment page
      window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  // ── STYLES ──────────────────────────────────────────────────
  const s = {
    page: {
      minHeight: '100vh', background: bg, display: 'flex',
      alignItems: 'flex-start', justifyContent: 'center',
      padding: '2rem 1rem 3rem', fontFamily: "'Tajawal', sans-serif",
    },
    card: {
      background: isDark ? '#141414' : '#fff',
      border: `1.5px solid ${isDark ? '#2A2A2A' : '#E0E0D8'}`,
      borderRadius: 24, padding: '2rem 1.75rem',
      width: '100%', maxWidth: 420,
      boxShadow: `4px 4px 0 ${isDark ? '#333' : text}`,
    },
    name: {
      fontFamily: "'Syne', sans-serif", fontSize: 22,
      fontWeight: 800, color: text, letterSpacing: '-0.04em',
      direction: 'rtl', textAlign: 'center',
    },
    bio: {
      fontSize: 14, color: isDark ? '#bbb' : '#444',
      direction: 'rtl', textAlign: 'center', lineHeight: 1.6,
      background: isDark ? '#1A1A1A' : '#FFF8F0',
      borderRadius: 12, padding: '10px 14px',
      border: `1px solid ${isDark ? '#2A2A2A' : '#F0E4D7'}`,
      margin: '10px 0',
    },
    cupBtn: (sel) => ({
      flex: 1, border: `2px solid ${sel ? text : isDark ? '#2A2A2A' : '#E0E0D8'}`,
      borderRadius: 14, background: sel ? text : isDark ? '#1A1A1A' : '#FFF8F0',
      padding: '12px 6px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 3, cursor: 'pointer', transition: 'all .15s',
    }),
    cupAmt: (sel) => ({
      fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800,
      color: sel ? (isDark ? '#C8F55A' : '#FAFAF7') : text,
    }),
    payBtn: {
      width: '100%', background: text, color: bg,
      border: 'none', borderRadius: 16, padding: 16,
      fontFamily: "'Syne', sans-serif", fontSize: 18,
      fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1, direction: 'rtl',
      boxShadow: `3px 3px 0 ${isDark ? '#C8F55A' : '#0D0D0D'}`,
      transition: 'all .15s',
    },
    input: {
      width: '100%', border: `1.5px solid ${isDark ? '#2A2A2A' : '#E0E0D8'}`,
      borderRadius: 12, padding: '10px 14px', fontSize: 14,
      fontFamily: "'Tajawal', sans-serif", direction: 'rtl',
      background: isDark ? '#1A1A1A' : '#FFF8F0',
      color: isDark ? '#FAFAF7' : '#1A1A1A', outline: 'none',
      marginBottom: 10,
    },
    divider: { height: 1, background: isDark ? '#222' : '#F0E4D7', margin: '1rem 0' },
    sectionLabel: { fontSize: 12, fontWeight: 700, color: isDark ? '#666' : '#C09070', textAlign: 'center', direction: 'rtl', marginBottom: 8 },
    errorBox: { background: '#FFF0F0', border: '1px solid #FFB0B0', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#C00', direction: 'rtl', marginBottom: 10 },
    pmRow: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 },
    pmBadge: { border: `1px solid ${isDark ? '#333' : '#E0E0D8'}`, borderRadius: 7, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: isDark ? '#666' : '#888', fontFamily: "'DM Sans', sans-serif" },
  };

  if (success) {
    return (
      <div style={s.page}>
        <div style={{ ...s.card, textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>☕</div>
          <h2 style={{ ...s.name, marginBottom: 8 }}>وصلت قهوتك!</h2>
          <p style={{ ...s.bio }}>
            {message ? `"${message}"\n\n` : ''}
            ستتلقى ردًا شخصيًا من {creator.full_name} قريباً 🤍
          </p>
          <button
            style={{ ...s.payBtn, marginTop: 24, fontSize: 15 }}
            onClick={() => { setSuccess(false); window.history.replaceState({}, '', `/${creator.handle}`); }}
          >
            ☕ أرسل قهوة أخرى
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: `3px solid ${text}`, boxShadow: `3px 3px 0 ${text}`,
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? '#1A1A1A' : '#FFF8F0', fontSize: 36, marginBottom: 10,
          }}>
            {creator.avatar_url
              ? <img src={creator.avatar_url} alt={creator.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (creator.avatar_emoji || '🎙️')}
          </div>
          <div style={s.name}>{creator.full_name} {creator.is_verified && '✓'}</div>
          <div style={{ fontSize: 12, color: isDark ? '#555' : '#aaa', fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>
            qahwa.kw/{creator.handle}
          </div>
          {creator.bio && <div style={s.bio}>{creator.bio}</div>}

          {/* Social links */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
            {creator.instagram && <a href={`https://${creator.instagram}`} target="_blank" rel="noreferrer" style={{ background: text, color: bg, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>📸</a>}
            {creator.twitter   && <a href={`https://${creator.twitter}`}   target="_blank" rel="noreferrer" style={{ background: text, color: bg, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>🐦</a>}
            {creator.youtube   && <a href={`https://${creator.youtube}`}   target="_blank" rel="noreferrer" style={{ background: text, color: bg, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>▶️</a>}
            {creator.tiktok    && <a href={`https://${creator.tiktok}`}    target="_blank" rel="noreferrer" style={{ background: text, color: bg, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>🎵</a>}
          </div>
        </div>

        {/* Total counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1.5px solid ${isDark ? '#333' : text}`, borderRadius: 12, padding: '8px 14px', marginBottom: '1rem', background: isDark ? '#1A1A1A' : '#FFF0D8', boxShadow: `3px 3px 0 ${isDark ? '#333' : text}` }}>
          <span style={{ fontSize: 12, color: isDark ? '#666' : '#B08060' }}>إجمالي القهوات</span>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: text }}>☕ {creator.total_tips_count}</span>
        </div>

        <div style={s.divider} />
        <div style={s.sectionLabel}>اختر عدد القهوات ☕</div>

        {/* Cup selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          {[1, 3, 5].map(cups => {
            const sel = !isAmazing && selectedCups === cups;
            return (
              <button key={cups} style={s.cupBtn(sel)} onClick={() => { setSelectedCups(cups); setIsAmazing(false); }}>
                <span style={{ fontSize: cups === 5 ? 22 : 20 }}>{cups === 1 ? '☕' : cups === 3 ? '☕☕☕' : '🫖'}</span>
                <span style={{ fontSize: 10, color: isDark ? '#666' : '#aaa' }}>{cups === 1 ? 'قهوة' : cups === 3 ? '٣ قهوات' : '٥ قهوات'}</span>
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
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: text, marginBottom: 4, direction: 'rtl' }}>
              {isAmazing ? '✓ ' : ''}☀️ {creator.amazing_message || 'أنت رائع! حدد مبلغًا بإرادتك'}
            </div>
            {isAmazing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                <input
                  type="number"
                  value={amazingAmt}
                  onChange={e => setAmazingAmt(e.target.value)}
                  placeholder={`${settings?.amazing_min_kd || 0.5}`}
                  min={settings?.amazing_min_kd || 0.5}
                  max={settings?.amazing_max_kd || 50}
                  step="0.5"
                  style={{ ...s.input, flex: 1, marginBottom: 0, direction: 'ltr', textAlign: 'center', fontSize: 18, fontWeight: 700 }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#666' : '#888' }}>KD</span>
              </div>
            )}
          </div>
        )}

        <div style={s.sectionLabel}>اترك رسالة 💬</div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={`اترك رسالة لـ ${creator.full_name}...`}
          maxLength={200}
          style={{ ...s.input, minHeight: 64, resize: 'none', lineHeight: 1.55 }}
        />

        <input value={supporterName} onChange={e => setSupporterName(e.target.value)} placeholder="اسمك (اختياري)" style={s.input} />
        <input value={supporterPhone} onChange={e => setSupporterPhone(e.target.value)} placeholder="+965 XXXX XXXX (لتلقي الرد)" style={{ ...s.input, direction: 'ltr' }} />

        {error && <div style={s.errorBox}>{error}</div>}

        <button style={s.payBtn} onClick={handlePay} disabled={loading}>
          {loading ? '...' : `☕ أرسل القهوة · ${grossAmount.toFixed(3)} KD`}
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
            <div style={s.sectionLabel}>آخر الداعمين 🤍</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {recentTips.map((tip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: isDark ? '#666' : '#7A6A5A', direction: 'rtl', background: isDark ? '#1A1A1A' : '#FAF5F0', borderRadius: 10, padding: '7px 12px' }}>
                  <span>☕</span>
                  <span>{tip.supporter_name || 'داعم익'} {tip.is_amazing ? 'أرسل مبلغًا حرًا' : `اشترى ${tip.cups} ${tip.cups === 1 ? 'قهوة' : 'قهوات'}`}</span>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
