'use client';

// ============================================================
// FILE: /app/not-found.js
// PURPOSE: Branded 404 page — bilingual AR/EN, same visual language
//          as the tipping pages. Self-contained like TippingClient.
// ============================================================

import { useState, useEffect } from 'react';

// ── Flewd palette (matches TippingClient) ───────────────────
const C = {
  bg:     '#F5F0FF',
  card:   '#FFFFFF',
  ink:    '#0D0D0D',
  accent: '#C8F55A',
  purple: '#7B2FBE',
  violet: '#9B4DCA',
  soft:   '#EDE4FB',
  muted:  '#6B6680',
};

// ── i18n strings ────────────────────────────────────────────
const STR = {
  ar: {
    dir: 'rtl', other: 'EN', otherName: 'English',
    code: '٤٠٤',
    title: 'الصفحة غير موجودة',
    line: 'يبدو أن أحدهم شربها بالفعل ☕',
    home: 'العودة للرئيسية',
  },
  en: {
    dir: 'ltr', other: 'ع', otherName: 'العربية',
    code: '404',
    title: 'Page not found',
    line: 'This page seems to have been drunk already ☕',
    home: 'Back to home',
  },
};

export default function NotFound() {
  // Language — mirrors TippingClient: default AR, restore saved choice
  // from localStorage on mount, persist on toggle.
  const [lang, setLang] = useState('ar');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('qahwa_lang');
      if (stored === 'ar' || stored === 'en') setLang(stored);
    } catch {}
  }, []);

  const t   = STR[lang];
  const dir = t.dir;

  const toggleLang = () => setLang((l) => {
    const next = l === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('qahwa_lang', next); } catch {}
    return next;
  });

  const s = {
    page: { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', fontFamily: 'var(--font-sans)' },
    card: { position: 'relative', background: C.card, border: `2px solid ${C.ink}`, borderRadius: 28, padding: '2.75rem 1.75rem', width: '100%', maxWidth: 430, boxShadow: `5px 5px 0 ${C.ink}`, textAlign: 'center' },
    langBtn: { position: 'absolute', top: 16, insetInlineEnd: 16, border: `2px solid ${C.ink}`, background: C.card, color: C.ink, borderRadius: 999, padding: '5px 13px', fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-sans)', cursor: 'pointer', boxShadow: `2px 2px 0 ${C.ink}` },
    glyph: { width: 92, height: 92, borderRadius: '50%', border: `2px solid ${C.ink}`, boxShadow: `3px 3px 0 ${C.ink}`, background: C.soft, display: 'grid', placeItems: 'center', fontSize: 46, margin: '0 auto 18px' },
    code: { fontFamily: 'var(--font-sans)', fontSize: 56, fontWeight: 800, color: C.purple, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 },
    title: { fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.03em', direction: dir, marginBottom: 10 },
    line: { fontSize: 15, color: '#4A4458', lineHeight: 1.6, direction: dir, marginBottom: 24 },
    btnPrimary: { display: 'block', width: '100%', background: C.accent, color: C.ink, border: `2px solid ${C.ink}`, borderRadius: 999, padding: '15px 16px', fontSize: 16, fontWeight: 800, textDecoration: 'none', boxShadow: `4px 4px 0 ${C.ink}` },
  };

  return (
    <div style={s.page} dir={dir}>
      <div style={s.card}>
        <button style={s.langBtn} onClick={toggleLang} aria-label={t.otherName}>{t.other}</button>

        {/* Empty-cup motif for a page that isn't there. */}
        <div style={s.glyph} aria-hidden>☕</div>

        <div style={s.code}>{t.code}</div>
        <h1 style={s.title}>{t.title}</h1>
        <p style={s.line}>{t.line}</p>

        <a href="/" style={s.btnPrimary}>{t.home}</a>
      </div>
    </div>
  );
}
