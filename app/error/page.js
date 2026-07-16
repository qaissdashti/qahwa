'use client';

// ============================================================
// FILE: /app/error/page.js
// PURPOSE: Payment-failure landing page — a NORMAL route, NOT a
//          Next.js error boundary. The payment callbacks redirect
//          here with ?reason=... (&handle=... optional). Bilingual
//          AR/EN, self-contained like TippingClient.
// ============================================================

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

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
    title: 'لم تكتمل عملية الدفع',
    reason: {
      payment_failed: 'لم تتم عملية الدفع. لم يُخصم أي مبلغ منك.',
      tip_not_found:  'لم نتمكّن من العثور على هذه العملية. لم يُخصم أي مبلغ منك.',
      unexpected:     'حدث خطأ غير متوقع. لم يُخصم أي مبلغ منك.',
      generic:        'لم تتم عملية الدفع. لم يُخصم أي مبلغ منك.',
    },
    reassure: 'يمكنك المحاولة مرة أخرى في أي وقت ☕',
    tryAgain: '☕ حاول مرة أخرى',
    home: 'العودة للرئيسية',
  },
  en: {
    dir: 'ltr', other: 'ع', otherName: 'العربية',
    title: 'Payment didn’t go through',
    reason: {
      payment_failed: 'The payment didn’t go through. No money was taken.',
      tip_not_found:  'We couldn’t find that transaction. No money was taken.',
      unexpected:     'Something unexpected happened. No money was taken.',
      generic:        'The payment didn’t go through. No money was taken.',
    },
    reassure: 'You can try again whenever you like ☕',
    tryAgain: '☕ Try again',
    home: 'Back to home',
  },
};

function PaymentErrorInner() {
  const params = useSearchParams();
  const reason = params.get('reason') || 'generic';
  const handle = params.get('handle');

  // Language — mirrors TippingClient: default AR, restore the saved
  // choice from localStorage on mount, persist on toggle.
  const [lang, setLang] = useState('ar');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('qahwa_lang');
      if (stored === 'ar' || stored === 'en') setLang(stored);
    } catch {}
  }, []);

  const t   = STR[lang];
  const dir = t.dir;
  const message = t.reason[reason] || t.reason.generic;

  const toggleLang = () => setLang((l) => {
    const next = l === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('qahwa_lang', next); } catch {}
    return next;
  });

  const s = {
    page: { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', fontFamily: 'var(--font-sans)' },
    card: { position: 'relative', background: C.card, border: `2px solid ${C.ink}`, borderRadius: 28, padding: '2.75rem 1.75rem', width: '100%', maxWidth: 430, boxShadow: `5px 5px 0 ${C.ink}`, textAlign: 'center' },
    langBtn: { position: 'absolute', top: 16, insetInlineEnd: 16, border: `2px solid ${C.ink}`, background: C.card, color: C.ink, borderRadius: 999, padding: '5px 13px', fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-sans)', cursor: 'pointer', boxShadow: `2px 2px 0 ${C.ink}` },
    glyph: { width: 92, height: 92, borderRadius: '50%', border: `2px solid ${C.ink}`, boxShadow: `3px 3px 0 ${C.ink}`, background: C.soft, display: 'grid', placeItems: 'center', fontSize: 46, margin: '0 auto 20px' },
    title: { fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: '-0.03em', direction: dir, marginBottom: 10 },
    msg: { fontSize: 15, color: '#4A4458', lineHeight: 1.6, direction: dir, marginBottom: 6 },
    reassure: { fontSize: 13, color: C.violet, fontWeight: 700, direction: dir, marginBottom: 24 },
    btnPrimary: { display: 'block', width: '100%', background: C.accent, color: C.ink, border: `2px solid ${C.ink}`, borderRadius: 999, padding: '15px 16px', fontSize: 16, fontWeight: 800, textDecoration: 'none', boxShadow: `4px 4px 0 ${C.ink}`, marginBottom: 10 },
    btnSecondary: { display: 'block', width: '100%', background: C.card, color: C.ink, border: `2px solid ${C.ink}`, borderRadius: 999, padding: '13px 16px', fontSize: 15, fontWeight: 800, textDecoration: 'none', boxShadow: `3px 3px 0 ${C.ink}` },
  };

  return (
    <div style={s.page} dir={dir}>
      <div style={s.card}>
        <button style={s.langBtn} onClick={toggleLang} aria-label={t.otherName}>{t.other}</button>

        {/* Spilled-coffee motif — warm, not alarming. */}
        <div style={s.glyph} aria-hidden>🫗</div>

        <h1 style={s.title}>{t.title}</h1>
        <p style={s.msg}>{message}</p>
        <p style={s.reassure}>{t.reassure}</p>

        {/* If we know which creator the supporter came from, offer a direct
            retry to their page; otherwise just send them home. */}
        {handle ? (
          <>
            <a href={`/${handle}`} style={s.btnPrimary}>{t.tryAgain}</a>
            <a href="/" style={s.btnSecondary}>{t.home}</a>
          </>
        ) : (
          <a href="/" style={s.btnPrimary}>{t.home}</a>
        )}
      </div>
    </div>
  );
}

export default function PaymentErrorPage() {
  // useSearchParams() must live inside a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <PaymentErrorInner />
    </Suspense>
  );
}
