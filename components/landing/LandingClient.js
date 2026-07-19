// ============================================================
// LANDING PAGE — Flewd palette, AR/EN, neo-brutalist.
//
// Sections (top → bottom):
//   1. Top nav (logo + lang toggle + login + signup CTA)
//   2. Hero (headline + sub + CTAs + iPhone notification mockup)
//   3. "How it works" — 3 numbered steps
//   4. Feature strip (KNET / email notifications / no-account-for-supporter)
//   5. Footer
// ============================================================
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';
import Logo from '@/components/Logo';
import { trackEvent } from '@/lib/mixpanel';

const F = { bg: '#F5F0FF', card: '#FFFFFF', ink: '#0D0D0D', accent: '#C8F55A', purple: '#7B2FBE', violet: '#9B4DCA', soft: '#EDE4FB' };

// ── i18n: local STR dict (same pattern as TippingClient). Keeps the
//    landing page self-contained instead of polluting lib/i18n.js. ──
const STR = {
  ar: {
    dir: 'rtl',
    nav: { login: 'تسجيل الدخول', cta: 'أنشئ صفحتك' },
    hero: {
      title1: 'خلّي متابعينك',
      title2: 'يعزمونك على قهوة',
      sub: 'منصّة كويتية لدعم المبدعين. متابعينك يدفعون بالدينار عبر كي نت — بدون حساب، بضغطة وحدة. ويوصلك إشعار بالبريد لحظة وصول كل قهوة.',
      ctaPrimary: '↗ أنشئ صفحتك',
      ctaSecondary: 'عندي حساب',
      microcopy: 'مجاناً · ٤ دقائق · بدون بطاقة',
    },
    phone: {
      time: '9:41',
      app: 'قهوة',
      notif1Title: 'وصلك فنجان قهوة! ☕',
      notif1Body: 'أحمد أرسل لك قهوة · 2.0 KD',
      notif2Title: 'وصلك فنجان قهوة! ☕',
      notif2Body: 'نورة أرسلت لك ٣ قهوات · 6.0 KD',
      now: 'الآن',
    },
    how: {
      title: 'كيف تشتغل قهوة؟',
      sub: 'ثلاث خطوات. لا أكثر.',
      steps: [
        { n: '١', t: 'شارك رابطك', d: 'حط buymeqahwa.com/handle في الباي‌و أو الستوري.' },
        { n: '٢', t: 'متابعك يدفع', d: 'يفتح الرابط، يختار عدد القهوات، ويدفع بكي نت أو بطاقة في ثواني.' },
        { n: '٣', t: 'يوصلك إشعار', d: 'يوصلك إيميل في صندوق بريدك لحظة وصول القهوة.' },
      ],
    },
    features: [
      ['💳', 'كي نت بالدينار', 'دفع محلي عبر كي نت وفيزا وماستركارد.'],
      ['📧', 'إشعارات فورية', 'يوصلك إيميل بكل قهوة تستلمها.'],
      ['🔒', 'بدون حساب للداعم', 'متابعك يدفع بضغطة وحدة، ما يحتاج تسجيل.'],
    ],
    footer: 'قهوة · صُنع في الكويت ☕',
  },
  en: {
    dir: 'ltr',
    nav: { login: 'Sign in', cta: 'Create your page' },
    hero: {
      title1: 'Let your followers',
      title2: 'buy you a coffee',
      sub: 'A Kuwaiti platform for supporting creators. Your fans pay in KD via KNET — no account needed, one tap. You get notified by email the moment a coffee lands.',
      ctaPrimary: '↗ Create your page',
      ctaSecondary: 'I have an account',
      microcopy: 'Free · 4 minutes · no card needed',
    },
    phone: {
      time: '9:41',
      app: 'Qahwa',
      notif1Title: 'You just received a coffee! ☕',
      notif1Body: 'Ahmed sent you a coffee · 2.0 KD',
      notif2Title: 'You just received a coffee! ☕',
      notif2Body: 'Noura sent you 3 coffees · 6.0 KD',
      now: 'now',
    },
    how: {
      title: 'How BuyMeQahwa works',
      sub: 'Three steps. That’s it.',
      steps: [
        { n: '1', t: 'Share your link', d: 'Put buymeqahwa.com/handle in your bio or story.' },
        { n: '2', t: 'They pay', d: 'A tap opens your page, they pick coffees, pay by KNET or card in seconds.' },
        { n: '3', t: 'You’re notified', d: 'An email lands in your inbox the moment a coffee arrives.' },
      ],
    },
    features: [
      ['💳', 'KNET in KD', 'Local payments via KNET, Visa and Mastercard.'],
      ['📧', 'Instant notifications', 'Get an email for every coffee you receive.'],
      ['🔒', 'No supporter account', 'One tap to pay — no signup needed.'],
    ],
    footer: 'Qahwa · Made in Kuwait ☕',
  },
};

export default function LandingClient() {
  // Pull just the lang code — we use our own STR dict, not the global one.
  const { lang } = useLang();
  const t = STR[lang === 'en' ? 'en' : 'ar'];

  useEffect(() => { trackEvent('Landing Page Viewed'); }, []);

  return (
    <main className="min-h-screen flex flex-col" dir={t.dir} style={{ background: F.bg, color: F.ink }}>
      {/* ─── Top nav ─── */}
      <header className="flex items-center justify-between px-5 sm:px-6 py-4 max-w-6xl mx-auto w-full">
        <Link href="/" className="text-2xl font-extrabold inline-flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)' }}>
          <Logo size={32} />
          <span>{lang === 'ar' ? 'قهوة' : 'BuyMeQahwa'}</span>
        </Link>
        <nav className="flex items-center gap-2.5 sm:gap-3">
          <LangToggle />
          <Link href="/login" onClick={() => trackEvent('Sign In Clicked')} className="font-bold text-sm hidden sm:inline">{t.nav.login}</Link>
          <Link href="/onboard" onClick={() => trackEvent('Create Page Clicked')} className="q-btn-accent text-xs sm:text-sm py-2 px-3 sm:px-4">{t.nav.cta}</Link>
        </nav>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative max-w-6xl mx-auto w-full px-5 sm:px-6 py-10 sm:py-16 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-12 items-center">
        {/* hero text */}
        <div className="text-start relative z-10">
          {/* Pixel-art brand mark above the headline — replaces the
              previous emoji ☕ above the heading. Uses the detailed
              "large" variant with قهوة Arabic text on the cup. */}
          <div className="mb-5">
            <Logo variant="large" size={140} alt="Qahwa logo" style={{ height: 140, width: 'auto' }} />
          </div>
          <div className="inline-block text-xs font-extrabold tracking-wider uppercase mb-4 px-3 py-1.5 rounded-full"
               style={{ background: F.soft, color: F.purple, border: `2px solid ${F.purple}` }}>
            Kuwait · KWD · KNET
          </div>
          {/* Explicit weight 800 — overrides the global h1 rule's tight -0.04em
              tracking that was making the headline read as condensed/stretched.
              Slightly looser letter-spacing + tighter line-height = bold and
              punchy without the vertical-stretch feel. */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl mb-5"
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                lineHeight: 1.05,
              }}>
            {t.hero.title1}<br/>
            <span className="inline-flex items-center gap-2 align-middle">
              {t.hero.title2}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/coffee-cup.png" alt="" className="inline-block align-middle w-auto" style={{ height: 56, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))' }} />
            </span>
          </h1>
          <p className="text-base sm:text-lg max-w-xl mb-7 font-medium" style={{ color: 'rgba(13,13,13,0.65)' }}>
            {t.hero.sub}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/onboard" onClick={() => trackEvent('Create Page Clicked')} className="q-btn-accent text-base sm:text-lg px-6 sm:px-7 py-3.5 sm:py-4">
              {t.hero.ctaPrimary}
            </Link>
            <Link href="/login" onClick={() => trackEvent('Sign In Clicked')} className="q-btn-white text-base sm:text-lg px-6 sm:px-7 py-3.5 sm:py-4">
              {t.hero.ctaSecondary}
            </Link>
          </div>
          <p className="text-xs font-bold mt-4" style={{ color: F.violet }}>{t.hero.microcopy}</p>
        </div>

        {/* phone mockup */}
        <div className="flex justify-center lg:justify-end relative z-10">
          <PhoneMockup strings={t.phone} dir={t.dir} />
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="max-w-5xl mx-auto w-full px-5 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl mb-2">{t.how.title}</h2>
          <p className="font-medium" style={{ color: 'rgba(13,13,13,0.55)' }}>{t.how.sub}</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
          {t.how.steps.map((s, i) => (
            <div key={i} className="q-card p-5 sm:p-6 text-start relative" style={{ background: F.card }}>
              <div className="absolute -top-3 -start-3 w-10 h-10 rounded-full grid place-items-center font-extrabold text-lg"
                   style={{ background: F.accent, color: F.ink, border: `2px solid ${F.ink}`, boxShadow: `2px 2px 0 ${F.ink}`, fontFamily: 'var(--font-sans)' }}>
                {s.n}
              </div>
              <h3 className="text-lg sm:text-xl mb-1.5 mt-1">{s.t}</h3>
              <p className="text-sm font-medium" style={{ color: 'rgba(13,13,13,0.65)' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Feature strip ─── */}
      <section className="max-w-5xl mx-auto w-full px-5 sm:px-6 pb-12 sm:pb-16 grid sm:grid-cols-3 gap-4">
        {t.features.map(([emoji, title, desc]) => (
          <div key={title} className="q-card p-5 text-start" style={{ background: F.card }}>
            <div className="text-3xl mb-2">
              {/* The payments card (keyed by the 💳 marker) shows the KNET +
                  Visa + Mastercard logos instead of an emoji; all other cards keep theirs. */}
              {emoji === '💳' ? (
                <span className="inline-flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/knet-logo.png" alt="KNET" className="w-auto" style={{ height: 22 }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/visa-logo.png" alt="Visa" className="w-auto" style={{ height: 22 }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/mastercard-logo.png" alt="Mastercard" className="w-auto" style={{ height: 22 }} />
                </span>
              ) : emoji}
            </div>
            <h3 className="text-lg mb-1">{title}</h3>
            <p className="text-sm font-medium" style={{ color: 'rgba(13,13,13,0.6)' }}>{desc}</p>
          </div>
        ))}
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t-2 py-6 text-center text-sm font-medium" style={{ borderColor: 'rgba(13,13,13,0.1)', color: 'rgba(13,13,13,0.45)' }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
          <span>{t.footer}</span>
          <span className="hidden sm:inline" style={{ opacity: 0.5 }}>·</span>
          <Link href="/terms" className="underline font-bold hover:text-qahwa-purple transition-colors">
            {lang === 'ar' ? 'الشروط والأحكام' : 'Terms and Conditions'}
          </Link>
          <span className="hidden sm:inline" style={{ opacity: 0.5 }}>·</span>
          <Link href="/contact" className="underline font-bold hover:text-qahwa-purple transition-colors">
            {lang === 'ar' ? 'تواصل معنا' : 'Contact'}
          </Link>
        </div>
      </footer>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// iPhone-ish frame with a status bar and two notification cards
// stacked at the same anchor. Each card animates via the global
// .qahwa-notif / .qahwa-notif-late classes (8s cycle: gentle
// 0.4s slide-in → 3s hold → 1s fade-out; second card offset 4s
// so the two alternate sequentially without overlap).
// ─────────────────────────────────────────────────────────────
function PhoneMockup({ strings, dir }) {
  return (
    <div style={{
      width: 270, maxWidth: '90%',
      aspectRatio: '9 / 19',
      background: F.ink, borderRadius: 42, padding: 10,
      boxShadow: `8px 8px 0 ${F.ink}, 0 16px 40px rgba(123,47,190,0.25)`,
      position: 'relative',
    }}>
      {/* notch */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        width: 96, height: 22, background: F.ink, borderRadius: 14, zIndex: 2,
      }} />
      {/* screen */}
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(160deg, #C0AAEC 0%, #EDE4FB 55%, #F5F0FF 100%)',
        borderRadius: 34, overflow: 'hidden', position: 'relative',
        fontFamily: 'var(--font-sans)',
      }}>
        {/* status bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px 0', color: F.ink, fontWeight: 800, fontSize: 13 }}>
          <span>{strings.time}</span>
          <span style={{ fontSize: 11, letterSpacing: '0.05em' }}>● ● ● 5G</span>
        </div>

        {/* notifications stack */}
        <div style={{ position: 'absolute', top: 64, insetInlineStart: 14, insetInlineEnd: 14, display: 'grid' }}>
          <Notif strings={strings} dir={dir} title={strings.notif1Title} body={strings.notif1Body} cls="qahwa-notif" />
          <Notif strings={strings} dir={dir} title={strings.notif2Title} body={strings.notif2Body} cls="qahwa-notif-late" />
        </div>
      </div>
    </div>
  );
}

function Notif({ strings, dir, title, body, cls }) {
  return (
    <div className={cls} dir={dir}
      style={{
        gridArea: '1 / 1',
        background: 'rgba(255,255,255,0.86)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: `1.5px solid rgba(13,13,13,0.08)`,
        borderRadius: 16,
        padding: '10px 12px',
        boxShadow: '0 8px 18px rgba(13,13,13,0.12)',
        color: F.ink,
        willChange: 'transform, opacity',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: F.purple, color: '#fff',
          display: 'grid', placeItems: 'center',
          fontSize: 12, fontWeight: 900,
        }}>✉</span>
        <span style={{ fontSize: 11, fontWeight: 800 }}>{strings.app}</span>
        <span style={{ marginInlineStart: 'auto', fontSize: 10, opacity: 0.55 }}>{strings.now}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.8, lineHeight: 1.4 }}>{body}</div>
    </div>
  );
}

