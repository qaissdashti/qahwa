// ============================================================
// LANDING PAGE — Flewd palette, AR/EN, neo-brutalist + GSAP.
//
// Motion lives in:
//   • useLandingGsap.js   — page-level timeline + ScrollTriggers
//   • MagneticButton.js   — magnetic CTAs
//   • Marquee.js          — infinite brand strip
// All of it respects prefers-reduced-motion and RTL, and is cleaned up
// on unmount via a single gsap.context().revert().
//
// Sections (top → bottom):
//   1. Sticky nav (logo + lang toggle + login + signup CTA)
//   2. Hero (word-reveal headline + floating pixel logo w/ steam +
//      parallax brand badges + cursor-tilt phone with an EMAIL notif)
//   3. Marquee strip
//   4. "How it works" — 3 numbered steps (pinned scrub on desktop)
//   5. Feature strip (KNET / instant email notifications / no account)
//   6. Marquee strip
//   7. "Trusted by Kuwait creators" — handle pill row
//   8. Footer
// ============================================================
'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';
import Logo from '@/components/Logo';
import { trackEvent } from '@/lib/mixpanel';
import MagneticButton from '@/components/landing/MagneticButton';
import Marquee from '@/components/landing/Marquee';
import useLandingGsap from '@/components/landing/useLandingGsap';

const F = { bg: '#F5F0FF', card: '#FFFFFF', ink: '#0D0D0D', accent: '#C8F55A', purple: '#7B2FBE', violet: '#9B4DCA', soft: '#EDE4FB' };

// ── i18n: local STR dict (same pattern as TippingClient). Keeps the
//    landing page self-contained instead of polluting lib/i18n.js. ──
const STR = {
  ar: {
    dir: 'rtl',
    nav: { login: 'تسجيل الدخول', cta: 'أنشئ صفحتك' },
    hero: {
      title1: 'خلّي متابعينك',
      title2: 'يشترونلك قهوة ☕',
      sub: 'منصّة كويتية لدعم المبدعين. متابعينك يدفعون بالدينار عبر كي نت — بدون حساب، بضغطة وحدة. ويوصلك إشعار بالبريد لحظة وصول كل قهوة.',
      ctaPrimary: '↗ أنشئ صفحتك',
      ctaSecondary: 'عندي حساب',
      microcopy: 'مجاناً · ٤ دقائق · بدون بطاقة',
    },
    phone: {
      time: '9:41',
      mail: 'قهوة · البريد',
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
        { n: '١', t: 'شارك رابطك', d: 'حط qahwa.kw/handle في الباي‌و أو الستوري.' },
        { n: '٢', t: 'متابعك يدفع', d: 'يفتح الرابط، يختار عدد القهوات، ويدفع كي نت في ثواني.' },
        { n: '٣', t: 'يوصلك إشعار', d: 'يوصلك إشعار بالبريد لحظة وصول القهوة.' },
      ],
    },
    features: [
      ['💳', 'كي نت بالدينار', 'دفع محلي عبر MyFatoorah — كي نت، Apple Pay، فيزا.'],
      ['📧', 'إشعارات فورية', 'يوصلك إشعار بالبريد لحظة وصول كل قهوة.'],
      ['🔒', 'بدون حساب للداعم', 'متابعك يدفع بضغطة وحدة، ما يحتاج تسجيل.'],
    ],
    proof: {
      title: 'مبدعون كويتيون يستخدمون قهوة',
      sub: 'انضم لهم اليوم.',
    },
    footer: 'قهوة · صُنع في الكويت ☕',
  },
  en: {
    dir: 'ltr',
    nav: { login: 'Sign in', cta: 'Create your page' },
    hero: {
      title1: 'Let your followers',
      title2: 'buy you a coffee ☕',
      sub: 'A Kuwaiti platform for supporting creators. Your fans pay in KD via KNET — no account needed, one tap. You get notified by email the moment a coffee lands.',
      ctaPrimary: '↗ Create your page',
      ctaSecondary: 'I have an account',
      microcopy: 'Free · 4 minutes · no card needed',
    },
    phone: {
      time: '9:41',
      mail: 'Qahwa · Mail',
      notif1Title: 'You just received a coffee! ☕',
      notif1Body: 'Ahmed sent you a coffee · 2.0 KD',
      notif2Title: 'You just received a coffee! ☕',
      notif2Body: 'Noura sent you 3 coffees · 6.0 KD',
      now: 'now',
    },
    how: {
      title: 'How Qahwa works',
      sub: 'Three steps. That’s it.',
      steps: [
        { n: '1', t: 'Share your link', d: 'Put qahwa.kw/handle in your bio or story.' },
        { n: '2', t: 'They pay', d: 'A tap opens your page, they pick coffees, pay KNET in seconds.' },
        { n: '3', t: 'You’re notified', d: 'An email lands the moment a coffee comes in.' },
      ],
    },
    features: [
      ['💳', 'KNET in KD', 'Local payments via MyFatoorah — KNET, Apple Pay, Visa.'],
      ['📧', 'Instant notifications', 'Get an email the moment every coffee lands.'],
      ['🔒', 'No supporter account', 'One tap to pay — no signup needed.'],
    ],
    proof: {
      title: 'Kuwaiti creators trust Qahwa',
      sub: 'Join them today.',
    },
    footer: 'Qahwa · Made in Kuwait ☕',
  },
};

// ── Brand badges floating around the hero. Real brand colors so they
//    read at a glance. Each badge has an OUTER layer (cursor parallax,
//    via GSAP quickTo) and an INNER layer (gentle drift loop) so the two
//    transforms never fight. Desktop only. ──
const BRANDS = [
  { name: 'YouTube',   bg: '#FF0000', glyph: '▶',  pos: { top: 8,   left: 12 } },
  { name: 'Instagram', bg: 'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', glyph: '📷', pos: { top: '46%', left: '-8px' } },
  { name: 'TikTok',    bg: '#0D0D0D', glyph: '🎵', pos: { bottom: 24, left: '32%' } },
  { name: 'X',         bg: '#0D0D0D', glyph: '𝕏',  pos: { top: 8,   right: 12 } },
  { name: 'Snapchat',  bg: '#FFFC00', glyph: '👻', pos: { bottom: 0, right: 16, color: '#0D0D0D' } },
];

// Split a headline string into clip-wrapped words for the GSAP reveal.
// Each word slides up out of its overflow-hidden wrapper. Spaces are kept
// as real text nodes so wrapping + RTL flow stay native.
function Words({ text }) {
  const parts = text.split(' ');
  return parts.map((w, i) => (
    <span key={i}>
      <span className="lc-word-wrap"><span className="lc-word">{w}</span></span>
      {i < parts.length - 1 ? ' ' : ''}
    </span>
  ));
}

export default function LandingClient() {
  // Pull just the lang code — we use our own STR dict, not the global one.
  const { lang } = useLang();
  const t = STR[lang === 'en' ? 'en' : 'ar'];

  const rootRef = useRef(null);

  useEffect(() => { trackEvent('Landing Page Viewed'); }, []);

  // All page-level GSAP (hero timeline, ScrollTriggers, parallax, tilt).
  // Re-runs on lang/dir change so RTL stays correct.
  useLandingGsap(rootRef, { lang, dir: t.dir });

  return (
    <main ref={rootRef} className="min-h-screen flex flex-col" dir={t.dir} style={{ background: F.bg, color: F.ink }}>
      {/* ─── Top nav (sticky; compacts + blurs after 100px) ─── */}
      <header data-lc="nav" className="lc-nav">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 max-w-6xl mx-auto w-full">
          <Link href="/" className="text-2xl font-extrabold inline-flex items-center gap-2" style={{ fontFamily: 'var(--font-sans)' }}>
            <Logo size={32} />
            <span>{lang === 'ar' ? 'قهوة' : 'Qahwa'}</span>
          </Link>
          <nav className="flex items-center gap-2.5 sm:gap-3">
            <LangToggle />
            <Link href="/login" onClick={() => trackEvent('Sign In Clicked')} className="font-bold text-sm hidden sm:inline">{t.nav.login}</Link>
            <MagneticButton href="/onboard" onClick={() => trackEvent('Create Page Clicked')} className="q-btn-accent text-xs sm:text-sm py-2 px-3 sm:px-4">{t.nav.cta}</MagneticButton>
          </nav>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative max-w-6xl mx-auto w-full px-5 sm:px-6 py-10 sm:py-16 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-12 items-center">
        {/* floating brand badges — desktop only. Outer = parallax target,
            inner = drift + visual. */}
        <div className="hidden lg:block absolute inset-0 pointer-events-none" style={{ zIndex: 30 }}>
          {BRANDS.map((b) => (
            <span key={b.name} className="lc-brand-outer absolute" style={{ ...b.pos }} aria-hidden>
              <span
                className="lc-brand-inner"
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: b.bg, color: b.pos.color || '#fff',
                  display: 'grid', placeItems: 'center',
                  fontSize: 22, fontWeight: 800,
                  border: `2px solid ${F.ink}`, boxShadow: `4px 4px 0 ${F.ink}`,
                }}>
                <span>{b.glyph}</span>
              </span>
            </span>
          ))}
        </div>

        {/* hero text */}
        <div className="text-start relative z-10">
          {/* Pixel-art brand mark — floats gently, with pixel steam rising.
              data-lc lives on the wrapper span (Logo doesn't forward props);
              steam particles are siblings so they stay put as the cup bobs. */}
          <div className="mb-5 relative inline-block" style={{ width: 'fit-content' }}>
            <span data-lc="logo" style={{ display: 'inline-block' }}>
              <Logo variant="large" size={140} alt="Qahwa logo" style={{ height: 140, width: 'auto', display: 'block' }} />
            </span>
            {/* steam particles anchored over the cup */}
            <i className="lc-steam" style={{ top: 6, left: '38%' }} />
            <i className="lc-steam" style={{ top: 0, left: '50%' }} />
            <i className="lc-steam" style={{ top: 8, left: '62%' }} />
          </div>

          <div data-lc="hero-fade" className="inline-block text-xs font-extrabold tracking-wider uppercase mb-4 px-3 py-1.5 rounded-full"
               style={{ background: F.soft, color: F.purple, border: `2px solid ${F.purple}` }}>
            Kuwait · KWD · KNET
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl mb-5"
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                lineHeight: 1.05,
              }}>
            <Words text={t.hero.title1} /><br/><Words text={t.hero.title2} />
          </h1>

          <p data-lc="hero-fade" className="text-base sm:text-lg max-w-xl mb-7 font-medium" style={{ color: 'rgba(13,13,13,0.65)' }}>
            {t.hero.sub}
          </p>
          <div data-lc="hero-fade" className="flex flex-wrap items-center gap-3">
            <MagneticButton href="/onboard" onClick={() => trackEvent('Create Page Clicked')} className="q-btn-accent text-base sm:text-lg px-6 sm:px-7 py-3.5 sm:py-4">
              {t.hero.ctaPrimary}
            </MagneticButton>
            <MagneticButton href="/login" onClick={() => trackEvent('Sign In Clicked')} className="q-btn-white text-base sm:text-lg px-6 sm:px-7 py-3.5 sm:py-4">
              {t.hero.ctaSecondary}
            </MagneticButton>
          </div>
          <p data-lc="hero-fade" className="text-xs font-bold mt-4" style={{ color: F.violet }}>{t.hero.microcopy}</p>
        </div>

        {/* phone mockup */}
        <div className="flex justify-center lg:justify-end relative z-10">
          <PhoneMockup strings={t.phone} dir={t.dir} />
        </div>
      </section>

      {/* ─── Marquee ─── */}
      <Marquee text={lang === 'ar' ? 'قهوة ☕ Qahwa ☕' : 'Qahwa ☕ قهوة ☕'} dir={t.dir} />

      {/* ─── How it works (pinned scrub on desktop) ─── */}
      <section data-lc="how" className="max-w-5xl mx-auto w-full px-5 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl mb-2">{t.how.title}</h2>
          <p className="font-medium" style={{ color: 'rgba(13,13,13,0.55)' }}>{t.how.sub}</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
          {t.how.steps.map((s, i) => (
            <div key={i} className="lc-step q-card p-5 sm:p-6 text-start relative" style={{ background: F.card }}>
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

      {/* ─── Feature strip (batch fade-up) ─── */}
      <section className="max-w-5xl mx-auto w-full px-5 sm:px-6 pb-12 sm:pb-16 pt-2 grid sm:grid-cols-3 gap-4">
        {t.features.map(([emoji, title, desc]) => (
          <div key={title} className="lc-feature q-card p-5 text-start" style={{ background: F.card }}>
            <div className="text-3xl mb-2">{emoji}</div>
            <h3 className="text-lg mb-1">{title}</h3>
            <p className="text-sm font-medium" style={{ color: 'rgba(13,13,13,0.6)' }}>{desc}</p>
          </div>
        ))}
      </section>

      {/* ─── Marquee ─── */}
      <Marquee text={lang === 'ar' ? 'ادعم مبدعك ☕ Support a creator ☕' : 'Support a creator ☕ ادعم مبدعك ☕'} dir={t.dir} />

      {/* ─── Social proof ─── */}
      <SocialProof strings={t.proof} dir={t.dir} />

      {/* ─── Footer ─── */}
      <footer className="border-t-2 py-6 text-center text-sm font-medium" style={{ borderColor: 'rgba(13,13,13,0.1)', color: 'rgba(13,13,13,0.45)' }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
          <span>{t.footer}</span>
          <span className="hidden sm:inline" style={{ opacity: 0.5 }}>·</span>
          <Link href="/terms" className="underline font-bold hover:text-qahwa-purple transition-colors">
            {lang === 'ar' ? 'الشروط والأحكام' : 'Terms and Conditions'}
          </Link>
        </div>
      </footer>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// iPhone-ish frame with a status bar and two EMAIL notification cards
// stacked at the same anchor. Each card animates via the global
// .qahwa-notif / .qahwa-notif-late classes (8s cycle). The whole phone
// tilts toward the cursor on desktop (GSAP, see useLandingGsap).
// ─────────────────────────────────────────────────────────────
function PhoneMockup({ strings, dir }) {
  return (
    <div data-lc="phone" style={{
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
        {/* Email-style sender badge (purple ✉) — was the WhatsApp "W". */}
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: F.purple, color: '#fff',
          display: 'grid', placeItems: 'center',
          fontSize: 12, fontWeight: 900,
        }}>✉</span>
        <span style={{ fontSize: 11, fontWeight: 800 }}>{strings.mail}</span>
        <span style={{ marginInlineStart: 'auto', fontSize: 10, opacity: 0.55 }}>{strings.now}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.8, lineHeight: 1.4 }}>{body}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// "Trusted by Kuwait creators" — a soft, no-fabricated-stats
// proof section. Renders a row of handle pills (placeholder set
// for now; swap with real creators once the platform has them).
// ─────────────────────────────────────────────────────────────
function SocialProof({ strings, dir }) {
  const samples = [
    { handle: 'newmoneyguy', emoji: '💰' },
    { handle: 'noura',       emoji: '🎨' },
    { handle: 'numbertwo',   emoji: '🎙️' },
    { handle: 'sara',        emoji: '✨' },
    { handle: 'fahad',       emoji: '🎮' },
  ];
  return (
    <section className="max-w-5xl mx-auto w-full px-5 sm:px-6 py-10 sm:py-14" dir={dir}>
      <div className="text-center mb-7">
        <h2 className="text-2xl sm:text-3xl mb-1.5">{strings.title}</h2>
        <p className="font-medium" style={{ color: 'rgba(13,13,13,0.55)' }}>{strings.sub}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
        {samples.map((s) => (
          <Link key={s.handle} href={`/${s.handle}`}
            className="inline-flex items-center gap-2 rounded-full font-bold text-sm transition-all hover:-translate-y-0.5"
            style={{
              background: F.card, color: F.ink,
              border: `2px solid ${F.ink}`, boxShadow: `2px 2px 0 ${F.ink}`,
              padding: '7px 14px 7px 8px', fontFamily: 'var(--font-sans)',
            }}>
            <span style={{
              width: 26, height: 26, borderRadius: '50%',
              background: F.soft, display: 'grid', placeItems: 'center', fontSize: 14,
            }}>{s.emoji}</span>
            <span dir="ltr">@{s.handle}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
