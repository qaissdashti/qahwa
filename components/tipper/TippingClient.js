// ============================================================
// TIPPING CLIENT COMPONENT — Flewd palette (light only)
// language toggle (AR/EN), pill cup selector, custom amount,
// payment initiation, success screen with confetti
// ============================================================
'use client';

import { useState, useEffect } from 'react';
import Spinner from '@/components/Spinner';
import { trackEvent } from '@/lib/mixpanel';

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
    phonePlaceholder: '+965 XXXX XXXX',
    phoneRequired: 'رقم الهاتف مطلوب',
    phoneInvalid: 'أدخل رقم كويتي صحيح (٨ أرقام)',
    payBtn: (amt) => `☕ أرسل القهوة · ${amt} KD`,
    processing: 'جاري المعالجة...',
    payWith: 'طريقة الدفع',
    pmKnet: 'كي نت',
    pmCard: 'بطاقة ائتمان',
    comingSoon: 'قريباً',
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
    successBodyMsg:   (n) => `اسمك ورسالتك وصلت لـ ${n} 🤍`,
    successBodyNoMsg: (n) => `قهوتك في طريقها لـ ${n} ☕`,
    shareBtn:    'مشاركة على واتساب',
    copyBtn:     'نسخ الرابط',
    copiedBtn:   '✓ تم النسخ',
    shareText:   (n, url) => `ادعم ${n} على قهوة: ${url} ☕`,
    shareIgBtn:  '📸 شارك على ستوري انستجرام',
    shareIgBusy: 'جاري إنشاء البطاقة...',
    shareIgSaved:'احفظ الصورة وشاركها في ستوري انستجرام 📸',
    shareIgErr:  'تعذّر إنشاء الصورة، حاول مرة ثانية',
    shareCardLine1: '☕ اشتريت لـ',
    shareCardLine2: 'قهوة!',
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
    phonePlaceholder: '+965 XXXX XXXX',
    phoneRequired: 'Phone number is required',
    phoneInvalid: 'Enter a valid Kuwait number (8 digits)',
    payBtn: (amt) => `☕ Send coffee · ${amt} KD`,
    processing: 'Processing...',
    payWith: 'Payment method',
    pmKnet: 'KNET',
    pmCard: 'Credit Card',
    comingSoon: 'coming soon',
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
    successBodyMsg:   (n) => `Your name and message reached ${n} 🤍`,
    successBodyNoMsg: (n) => `Your coffee is on its way to ${n} ☕`,
    shareBtn:    'Share on WhatsApp',
    copyBtn:     'Copy link',
    copiedBtn:   '✓ Copied',
    shareText:   (n, url) => `Support ${n} on Qahwa: ${url} ☕`,
    shareIgBtn:  '📸 Share to Instagram Story',
    shareIgBusy: 'Building card…',
    shareIgSaved:'Save this image and share it to your Instagram Story 📸',
    shareIgErr:  'Couldn\'t build the image — try again',
    shareCardLine1: '☕ I just bought',
    shareCardLine2: 'a coffee!',
    sendAnother: '☕ Send another coffee',
  },
};

// Full-screen confetti for the success screen. ~150 pieces, mixed
// shapes/colors, all complete within ~3s (fall 2.0-2.8s + stagger
// 0-0.4s). Self-unmounts via parent state after 3s so it never lingers.
function Confetti() {
  const colors = [
    C.accent,   // qahwa green
    C.purple,   // Flewd purple
    C.violet,   // Flewd violet
    '#FF5A5A',  // coral
    '#38BDF8',  // sky
    '#FFD166',  // sunflower
    '#FF8FB1',  // pink
    '#76E4B5',  // mint
  ];
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}>
      <style>{`@keyframes qahwa-fall{0%{transform:translateY(-12vh) rotate(0);opacity:1}100%{transform:translateY(112vh) rotate(720deg);opacity:.85}}@keyframes qahwa-pop{0%{transform:scale(0)}60%{transform:scale(1.25)}100%{transform:scale(1)}}`}</style>
      {Array.from({ length: 150 }).map((_, i) => {
        const size = 6 + Math.random() * 11;
        // Mix two shapes — rectangles (most) and small circles (~30%).
        const isCircle = i % 3 === 0;
        return (
          <span key={i} style={{
            position: 'absolute', left: `${Math.random() * 100}%`, top: '-12vh',
            width: size,
            height: isCircle ? size : size * 0.55,
            background: colors[i % colors.length],
            borderRadius: isCircle ? '50%' : 2,
            animation: `qahwa-fall ${2.0 + Math.random() * 0.8}s ${Math.random() * 0.4}s linear forwards`,
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

// ── Kuwait phone helpers ────────────────────────────────────
// Supporter phone is mandatory (creators reply to it). Kuwait mobile
// numbers are 8 digits; we accept input with/without a +965 / 965
// prefix and spaces. normalizeKwPhone strips everything down to the
// 8 local digits; isValidKwPhone gates the pay button on exactly 8.
function normalizeKwPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('965') && d.length > 8) d = d.slice(3);
  return d;
}
function isValidKwPhone(raw) {
  return /^\d{8}$/.test(normalizeKwPhone(raw));
}

// ── MPGS Hosted Checkout loader ─────────────────────────────
// Load Mastercard's Hosted Checkout script once (test host). Cached by
// id so repeated pay attempts never re-inject it; resolves immediately
// if window.Checkout is already present.
const MPGS_CHECKOUT_SRC = 'https://mtf.gateway.mastercard.com/static/checkout/checkout.min.js';
function loadMpgsCheckout() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Checkout) return resolve();
    const existing = document.getElementById('mpgs-checkout-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('MPGS script failed to load')), { once: true });
      return;
    }
    const el = document.createElement('script');
    el.id = 'mpgs-checkout-script';
    el.src = MPGS_CHECKOUT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('MPGS script failed to load'));
    document.body.appendChild(el);
  });
}

// Build an Instagram-Story-sized (1080×1920) share card as a PNG blob.
// Lavender Flewd background, purple accent stripes, Plus Jakarta Sans
// headlines + handle. Waits for the page fonts to load before drawing
// so the canvas doesn't fall back to a system serif.
async function buildShareCard({ creatorName, handle, t }) {
  const W = 1080, H = 1920;
  const F = { bg: '#F5F0FF', ink: '#0D0D0D', purple: '#7B2FBE', violet: '#9B4DCA', accent: '#C8F55A', soft: '#EDE4FB', card: '#FFFFFF' };

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'middle';

  // Resolve the actual family names next/font registered (hashed at build
  // time) from the CSS variables on <html>, so the card uses the same
  // Plus Jakarta Sans (Latin) / IBM Plex Sans Arabic (Arabic) as the app.
  const rootStyle = getComputedStyle(document.documentElement);
  const JK   = rootStyle.getPropertyValue('--font-jakarta').trim()     || 'sans-serif';
  const AR   = rootStyle.getPropertyValue('--font-plex-arabic').trim() || 'sans-serif';
  const SANS = `${JK}, ${AR}, sans-serif`;

  // Make sure the fonts are loaded before any fillText — otherwise browsers
  // fall back silently to serif and the card looks broken. (Plus Jakarta Sans
  // tops out at weight 800, so the card uses 800 instead of the old 900.)
  try {
    if (document.fonts?.load) {
      await Promise.all([
        document.fonts.load(`800 110px ${JK}`),
        document.fonts.load(`800 180px ${JK}`),
        document.fonts.load(`800 110px ${AR}`),
        document.fonts.load(`700 56px ${JK}`),
      ]);
      await document.fonts.ready;
    }
  } catch { /* no-op — best effort, fallback fonts still render */ }

  // Background
  ctx.fillStyle = F.bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative purple stripes top + bottom
  ctx.fillStyle = F.purple;
  ctx.fillRect(0, 0, W, 28);
  ctx.fillRect(0, H - 28, W, 28);

  // Soft purple blobs in the corners for warmth
  ctx.fillStyle = F.soft;
  ctx.beginPath(); ctx.arc(0, 0, 360, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W, H, 320, 0, Math.PI * 2); ctx.fill();

  // Brand badge top-center (white pill with bold "قهوة ☕")
  const badgeW = 360, badgeH = 110, badgeY = 130;
  ctx.fillStyle = F.card;
  ctx.strokeStyle = F.ink;
  ctx.lineWidth = 6;
  roundRect(ctx, (W - badgeW) / 2, badgeY, badgeW, badgeH, 999);
  ctx.fill(); ctx.stroke();
  // brutalist shadow
  ctx.fillStyle = F.ink;
  ctx.fillRect((W - badgeW) / 2 + 10, badgeY + badgeH + 4, badgeW, 8);
  ctx.fillStyle = F.ink;
  ctx.font = `800 64px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('قهوة ☕', W / 2, badgeY + badgeH / 2 + 4);

  // Hero row of coffee glyphs
  ctx.font = '110px system-ui, -apple-system, sans-serif';
  ctx.fillText('☕☕☕☕☕', W / 2, 460);

  // Three lines of message: prefix → name → suffix
  ctx.fillStyle = F.ink;
  ctx.textAlign = 'center';

  ctx.font = `800 90px ${SANS}`;
  ctx.fillText(t.shareCardLine1, W / 2, 760);

  // Name auto-shrinks if too long for the canvas width.
  let nameSize = 180;
  ctx.font = `800 ${nameSize}px ${SANS}`;
  while (ctx.measureText(creatorName).width > W - 160 && nameSize > 80) {
    nameSize -= 8;
    ctx.font = `800 ${nameSize}px ${SANS}`;
  }
  ctx.fillStyle = F.purple;
  ctx.fillText(creatorName, W / 2, 940);

  ctx.fillStyle = F.ink;
  ctx.font = `800 90px ${SANS}`;
  ctx.fillText(t.shareCardLine2, W / 2, 1120);

  // Accent CTA pill at the bottom with the handle URL
  const pillW = 720, pillH = 130, pillY = 1450;
  ctx.fillStyle = F.accent;
  ctx.strokeStyle = F.ink;
  ctx.lineWidth = 6;
  roundRect(ctx, (W - pillW) / 2, pillY, pillW, pillH, 999);
  ctx.fill(); ctx.stroke();
  // brutalist shadow
  ctx.fillStyle = F.ink;
  ctx.fillRect((W - pillW) / 2 + 14, pillY + pillH + 6, pillW, 10);
  ctx.fillStyle = F.ink;
  ctx.font = `700 56px ${SANS}`;
  ctx.fillText(`buymeqahwa.com/${handle}`, W / 2, pillY + pillH / 2 + 2);

  // Footer line
  ctx.fillStyle = F.violet;
  ctx.font = `700 36px ${SANS}`;
  ctx.fillText('Support a Kuwaiti creator · ادعم مبدعك المفضل', W / 2, 1740);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png', 0.95);
  });
}

// Small rounded-rectangle path helper for canvas (older Safaris lack
// ctx.roundRect, so this stays portable).
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────
// Success screen — separated out because it now owns its own
// state (confetti gate + copy-feedback) and a fair bit of JSX.
// Pulls C / s / t / dir from the parent to keep the visual
// language identical.
// ─────────────────────────────────────────────────────────────
function SuccessScreen({ C, s, t, dir, creator, message, onSendAnother, onToggleLang }) {
  // Cap the confetti at 3s — the qahwa-fall animation finishes in
  // ~2.4s for every piece, so 3000ms is a safe cutoff with grace.
  const [showConfetti, setShowConfetti] = useState(true);
  const [copied, setCopied] = useState(false);
  // Instagram share state: busy = building canvas; savedHint = shown
  // after a desktop fallback download so the user knows what to do
  // next; err on canvas failure.
  const [igBusy, setIgBusy] = useState(false);
  const [igSaved, setIgSaved] = useState(false);
  const [igErr, setIgErr] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(id);
  }, []);

  const pageUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${creator.handle}`
    : `/${creator.handle}`;
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(t.shareText(creator.full_name, pageUrl))}`;

  // Build the share card, then route to Web Share API (mobile, opens the
  // native sheet which includes Instagram Stories) or fall back to a
  // PNG download (desktop / share-API not supported / file-sharing
  // unsupported by the OS).
  async function shareToInstagram() {
    trackEvent('Share Instagram Clicked', { creatorHandle: creator.handle });
    setIgErr(false); setIgSaved(false); setIgBusy(true);
    try {
      const blob = await buildShareCard({ creatorName: creator.full_name, handle: creator.handle, t });
      const file = new File([blob], `qahwa-${creator.handle}.png`, { type: 'image/png' });

      // navigator.canShare can be missing entirely; guard each step.
      const canShareFile =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (e) {
          // AbortError = user closed the sheet; not an error to surface.
          if (e?.name !== 'AbortError') throw e;
          return;
        }
      }

      // Desktop / unsupported → download + show the "save & share" hint.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qahwa-${creator.handle}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setIgSaved(true);
      setTimeout(() => setIgSaved(false), 6000);
    } catch (err) {
      console.error('[share/ig]', err);
      setIgErr(true);
      setTimeout(() => setIgErr(false), 4000);
    } finally {
      setIgBusy(false);
    }
  }

  async function copyLink() {
    trackEvent('Copy Link Clicked', { creatorHandle: creator.handle });
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / blocked clipboard — fall back to a temp prompt.
      window.prompt(t.copyBtn, pageUrl);
    }
  }

  // Personalised subtitle — message present vs not.
  const subtitle = message
    ? t.successBodyMsg(creator.full_name)
    : t.successBodyNoMsg(creator.full_name);

  // Buttons all share the brutalist 2px black border + 3×3 shadow.
  const baseBtn = {
    border: `2px solid ${C.ink}`, borderRadius: 14,
    padding: '12px 16px', fontFamily: 'var(--font-sans)',
    fontSize: 14, fontWeight: 800, cursor: 'pointer',
    boxShadow: `3px 3px 0 ${C.ink}`, transition: 'all .12s',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%',
  };

  return (
    <div style={s.page} dir={dir}>
      {showConfetti && <Confetti />}
      <div style={{ ...s.card, textAlign: 'center', padding: '3rem 2rem' }}>
        <button style={s.langBtn} onClick={onToggleLang} aria-label={t.otherName}>{t.other}</button>

        {/* Heart-pulsing coffee glyph: pop-in once, then soft heartbeat loop. */}
        <div
          className="qahwa-heart-pulse"
          style={{ fontSize: 76, marginBottom: 16, display: 'inline-block', animationDelay: '.5s' }}
        >☕</div>

        <h2 style={{ ...s.name, marginBottom: 8 }}>{t.successTitle}</h2>

        {/* Quoted message (if any) + personalised subtitle. */}
        {message && (
          <p style={{ ...s.bio, fontStyle: 'italic', marginBottom: 8 }}>
            “{message}”
          </p>
        )}
        <p style={{ ...s.bio, marginTop: message ? 0 : undefined }}>{subtitle}</p>

        {/* Share + copy buttons sit in a stacked column so each gets a
            full-width tap target. WhatsApp = brand green; copy = white
            (flips to accent green on success). Send-another keeps the
            existing accent CTA so it reads as the primary next step. */}
        <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
          <a
            href={shareUrl} target="_blank" rel="noreferrer"
            onClick={() => trackEvent('Share WhatsApp Clicked', { creatorHandle: creator.handle })}
            style={{ ...baseBtn, background: '#25D366', color: '#fff', textDecoration: 'none' }}>
            <span>💬</span><span>{t.shareBtn}</span>
          </a>

          {/* Instagram share — gradient brand bg, brutalist border so
              it still belongs in the Flewd palette. Generates a
              1080×1920 PNG card → native share sheet (mobile) or
              download + hint (desktop). */}
          <button
            type="button" onClick={shareToInstagram} disabled={igBusy}
            style={{
              ...baseBtn,
              background: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)',
              color: '#fff',
              opacity: igBusy ? 0.75 : 1,
              cursor: igBusy ? 'wait' : 'pointer',
            }}>
            {igBusy
              ? <><Spinner size={16} color="#fff" /><span>{t.shareIgBusy}</span></>
              : <span>{t.shareIgBtn}</span>}
          </button>
          {igSaved && (
            <p style={{ fontSize: 12, fontWeight: 700, color: C.purple, margin: '-2px 0 0', lineHeight: 1.4 }}>
              {t.shareIgSaved}
            </p>
          )}
          {igErr && (
            <p style={{ fontSize: 12, fontWeight: 700, color: '#C00', margin: '-2px 0 0' }}>
              {t.shareIgErr}
            </p>
          )}

          <button
            type="button" onClick={copyLink}
            style={{ ...baseBtn, background: copied ? C.accent : C.card, color: C.ink }}>
            {copied ? t.copiedBtn : `🔗 ${t.copyBtn}`}
          </button>
          <button
            type="button" onClick={() => { trackEvent('Send Another Coffee Clicked', { creatorHandle: creator.handle }); onSendAnother(); }}
            style={{ ...baseBtn, background: C.purple, color: '#fff' }}>
            {t.sendAnother}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Social-proof toast — animates in at the top of the page on
// load, auto-dismisses after 4s, has an X to close early.
// Flewd palette: lavender bg, purple border, bold headline.
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
        fontFamily: 'var(--font-sans)',
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
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [payMethod, setPayMethod]       = useState('card'); // 'card' (MPGS) active; 'knet' disabled until MyFatoorah is live
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

  // KNET direct rail is gated behind a build-time flag until it's live.
  // When not 'true', the selector keeps its disabled "coming soon" state.
  const knetEnabled = process.env.NEXT_PUBLIC_KNET_ENABLED === 'true';

  // Supporter phone is mandatory. phoneError only shows once the field
  // has been touched (blur or a pay attempt) so we don't yell on load.
  const phoneValid = isValidKwPhone(supporterPhone);
  const phoneError = phoneTouched && !phoneValid
    ? (normalizeKwPhone(supporterPhone).length === 0 ? t.phoneRequired : t.phoneInvalid)
    : '';

  // Social-proof popup: todayCount is the DISTINCT supporters today
  // (deduped by phone server-side). The "2" is a visibility THRESHOLD,
  // not a floor — show nothing for 0/1, show the true count for 2+.
  const showSocialProof = todayCount >= 2;

  // Analytics — supporters stay anonymous (no identify on this page).
  useEffect(() => {
    trackEvent('Tipping Page Viewed', { creatorHandle: creator.handle });
  }, [creator.handle]);

  // Payment Success fires on the post-redirect success screen. cups/amount
  // are carried across the KNET redirect via sessionStorage (set at initiate),
  // since success is a fresh page load where the form state is reset.
  useEffect(() => {
    if (!success) return;
    let info = {};
    try { info = JSON.parse(sessionStorage.getItem('qahwa_last_tip') || '{}'); } catch {}
    trackEvent('Payment Success', {
      creatorHandle: creator.handle,
      cups: info.cups,
      amount: info.amount,
    });
    try { sessionStorage.removeItem('qahwa_last_tip'); } catch {}
  }, [success, creator.handle]);

  async function handlePay() {
    if (loading) return;
    // Phone is mandatory — block + surface the inline error.
    if (!phoneValid) {
      setPhoneTouched(true);
      setError('');
      return;
    }
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
          supporterPhone: `+965${normalizeKwPhone(supporterPhone)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.genericErr);
      const cupsPaid = isAmazing ? 0 : selectedCups;
      trackEvent('Payment Initiated', {
        cups: cupsPaid,
        amount: grossAmount,
        creatorHandle: creator.handle,
        supporterName: !!supporterName,
      });
      // Carry the amount across the KNET redirect for the Payment Success event.
      try { sessionStorage.setItem('qahwa_last_tip', JSON.stringify({ cups: cupsPaid, amount: grossAmount })); } catch {}
      window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  // Card rail (Visa/Mastercard) via MPGS Hosted Checkout. Mirrors
  // handlePay's validation + tracking, but posts to /initiate-card and
  // opens Mastercard's hosted page instead of the KNET redirect.
  // handlePay stays untouched for when MyFatoorah/KNET goes live.
  async function handlePayCard() {
    if (loading) return;
    // Phone is mandatory — block + surface the inline error.
    if (!phoneValid) {
      setPhoneTouched(true);
      setError('');
      return;
    }
    if (isAmazing && (!amazingAmt || grossAmount < (settings?.amazing_min_kd || 0.5))) {
      setError(t.minErr(fmtKd1(settings?.amazing_min_kd || 0.5)));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payment/initiate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorHandle: creator.handle,
          cups:          isAmazing ? 0 : selectedCups,
          isAmazing,
          grossAmount,
          message:       message || undefined,
          supporterName: supporterName || undefined,
          supporterPhone: `+965${normalizeKwPhone(supporterPhone)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.genericErr);
      const cupsPaid = isAmazing ? 0 : selectedCups;
      trackEvent('Payment Initiated', {
        cups: cupsPaid,
        amount: grossAmount,
        creatorHandle: creator.handle,
        supporterName: !!supporterName,
      });
      // Carry the amount across the hosted-page redirect for Payment Success.
      try { sessionStorage.setItem('qahwa_last_tip', JSON.stringify({ cups: cupsPaid, amount: grossAmount })); } catch {}

      // Test mode returns a paymentUrl straight to the success screen —
      // same redirect as the KNET flow, so it works with no card keys.
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      // Live: open Mastercard's Hosted Checkout with the returned session.
      // showPaymentPage() navigates away, so we leave `loading` set.
      await loadMpgsCheckout();
      window.Checkout.configure({ session: { id: data.sessionId } });
      window.Checkout.showPaymentPage();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  // KNET direct (KPAY) rail. Mirrors handlePayCard's validation + tracking,
  // but posts to /initiate-knet and does a full browser redirect to KNET's
  // hosted page (no checkout.js). handlePay/handlePayCard stay untouched.
  async function handlePayKnet() {
    if (loading) return;
    // Phone is mandatory — block + surface the inline error.
    if (!phoneValid) {
      setPhoneTouched(true);
      setError('');
      return;
    }
    if (isAmazing && (!amazingAmt || grossAmount < (settings?.amazing_min_kd || 0.5))) {
      setError(t.minErr(fmtKd1(settings?.amazing_min_kd || 0.5)));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payment/initiate-knet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorHandle: creator.handle,
          cups:          isAmazing ? 0 : selectedCups,
          isAmazing,
          grossAmount,
          message:       message || undefined,
          supporterName: supporterName || undefined,
          supporterPhone: `+965${normalizeKwPhone(supporterPhone)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.genericErr);
      const cupsPaid = isAmazing ? 0 : selectedCups;
      trackEvent('Payment Initiated', {
        cups: cupsPaid,
        amount: grossAmount,
        creatorHandle: creator.handle,
        supporterName: !!supporterName,
      });
      // Carry the amount across the KNET redirect for the Payment Success event.
      try { sessionStorage.setItem('qahwa_last_tip', JSON.stringify({ cups: cupsPaid, amount: grossAmount })); } catch {}
      // KNET is a redirect flow — send the browser to the hosted page.
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
    page: { minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem 3rem', fontFamily: 'var(--font-sans)' },
    card: { position: 'relative', background: C.card, border: `2px solid ${C.ink}`, borderRadius: 28, padding: '2rem 1.75rem', width: '100%', maxWidth: 430, boxShadow: `5px 5px 0 ${C.ink}` },
    name: { fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: '-0.04em', direction: dir, textAlign: 'center' },
    bio: { fontSize: 14, color: '#4A4458', direction: dir, textAlign: 'center', lineHeight: 1.6, background: C.soft, borderRadius: 14, padding: '10px 14px', border: `2px solid ${C.ink}`, margin: '12px 0' },
    cupPill: (sel) => ({
      flex: 1, border: `2px solid ${C.ink}`, borderRadius: 999,
      background: sel ? C.purple : C.card, color: sel ? '#fff' : C.ink,
      boxShadow: sel ? `3px 3px 0 ${C.ink}` : 'none',
      padding: '14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      cursor: 'pointer', transition: 'all .15s',
    }),
    cupAmt: { fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 800 },
    payBtn: {
      width: '100%', background: C.accent, color: C.ink, border: `2px solid ${C.ink}`,
      borderRadius: 999, padding: 17, fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 800,
      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, direction: dir,
      boxShadow: `4px 4px 0 ${C.ink}`, transition: 'all .12s',
    },
    input: { width: '100%', border: `2px solid ${C.ink}`, borderRadius: 14, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', direction: dir, background: C.card, color: C.ink, outline: 'none', marginBottom: 10 },
    divider: { height: 2, background: C.soft, margin: '1.1rem 0', borderRadius: 2 },
    sectionLabel: { fontSize: 12, fontWeight: 800, color: C.purple, textAlign: 'center', direction: dir, marginBottom: 10, letterSpacing: '0.02em' },
    errorBox: { background: '#FFF0F0', border: `2px solid #FF5A5A`, borderRadius: 12, padding: '8px 14px', fontSize: 13, color: '#C00', direction: dir, marginBottom: 10, fontWeight: 700 },
    pmRow: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' },
    pmBadge: { border: `1.5px solid ${C.ink}`, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: C.muted, fontFamily: 'var(--font-sans)' },
    pmSelectRow: { display: 'flex', gap: 9, marginBottom: '1rem' },
    pmOption: (sel, disabled) => ({
      flex: 1, border: `2px solid ${C.ink}`, borderRadius: 14,
      background: sel ? C.purple : C.card, color: sel ? '#fff' : C.ink,
      boxShadow: sel ? `3px 3px 0 ${C.ink}` : 'none',
      padding: '12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      transition: 'all .15s', direction: dir,
    }),
    pmOptionLabel: { fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 800 },
    pmOptionHint: { fontSize: 9, fontWeight: 700, opacity: 0.75, letterSpacing: '0.02em' },
    langBtn: { position: 'absolute', top: 16, insetInlineEnd: 16, border: `2px solid ${C.ink}`, background: C.card, color: C.ink, borderRadius: 999, padding: '5px 13px', fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-sans)', cursor: 'pointer', zIndex: 2, boxShadow: `2px 2px 0 ${C.ink}` },
    social: { background: C.purple, color: '#fff', border: `2px solid ${C.ink}`, borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 700, textDecoration: 'none' },
  };

  if (success) {
    return <SuccessScreen
      C={C} s={s} t={t} dir={dir}
      creator={creator} message={message}
      onSendAnother={() => { setSuccess(false); window.history.replaceState({}, '', `/${creator.handle}`); }}
      onToggleLang={toggleLang}
    />;
  }

  return (
    <div style={s.page} dir={dir}>
      {/* Daily social-proof toast — only shown when 2+ distinct supporters
          have tipped today; displays the TRUE distinct count. Auto-dismisses
          after 4s; key resets state on prop/lang change. */}
      {showSocialProof && (
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
                // Per spec: no avatar → fall back to the brand mark
                // (NOT the picked emoji). Keeps every creator-page
                // first impression on-brand.
                // eslint-disable-next-line @next/next/no-img-element
                : <img src="/qahwa-logo-navbar.svg" alt={creator.full_name || 'Qahwa'} style={{ width: '72%', height: '72%', objectFit: 'contain', imageRendering: 'pixelated' }} />}
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
          <div style={{ fontSize: 12, color: C.violet, fontFamily: 'var(--font-sans)', fontWeight: 700, marginBottom: 6 }}>
            buymeqahwa.com/{creator.handle}
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
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 800, color: C.purple }}>☕ {creator.total_tips_count}</span>
        </div>

        <div style={s.divider} />
        <div style={s.sectionLabel}>{t.chooseCoffees}</div>

        {/* Cup selector — pills */}
        <div style={{ display: 'flex', gap: 9, marginBottom: '1.1rem' }}>
          {[1, 3, 5].map(cups => {
            const sel = !isAmazing && selectedCups === cups;
            return (
              <button key={cups} style={s.cupPill(sel)} onClick={() => {
                  setSelectedCups(cups); setIsAmazing(false);
                  trackEvent('Coffee Amount Selected', { cups, amount: Number((price * cups).toFixed(3)), creatorHandle: creator.handle });
                }}>
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
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 800, color: isAmazing ? C.purple : C.ink, marginBottom: 4, direction: dir }}>
              {isAmazing ? '✓ ' : ''}☀️ {creator.amazing_message || t.amazingDefault}
            </div>
            {isAmazing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                <input type="number" value={amazingAmt} onChange={e => setAmazingAmt(e.target.value)}
                  onBlur={() => { const a = Number(parseFloat(amazingAmt || 0).toFixed(3)); if (a > 0) trackEvent('Amazing Amount Selected', { amount: a, creatorHandle: creator.handle }); }}
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
        <input
          value={supporterPhone}
          onChange={e => setSupporterPhone(e.target.value)}
          onBlur={() => setPhoneTouched(true)}
          placeholder={t.phonePlaceholder}
          inputMode="tel"
          aria-invalid={!!phoneError}
          aria-required="true"
          style={{
            ...s.input,
            direction: 'ltr',
            marginBottom: phoneError ? 4 : s.input.marginBottom,
            borderColor: phoneError ? '#FF5A5A' : C.ink,
          }}
        />
        {phoneError && (
          <div style={{ fontSize: 12, color: '#C00', fontWeight: 700, direction: dir, marginBottom: 10 }}>
            {phoneError}
          </div>
        )}

        {/* Payment method — KNET is enabled via NEXT_PUBLIC_KNET_ENABLED,
            otherwise it stays disabled ("coming soon"). Credit Card
            (MPGS Hosted Checkout) is the active default. */}
        <div style={s.sectionLabel}>{t.payWith}</div>
        <div style={s.pmSelectRow}>
          {knetEnabled ? (
            <button type="button" onClick={() => setPayMethod('knet')}
                    style={s.pmOption(payMethod === 'knet', false)}>
              <span style={s.pmOptionLabel}>🏧 {t.pmKnet}</span>
            </button>
          ) : (
            <button type="button" disabled style={s.pmOption(false, true)}>
              <span style={s.pmOptionLabel}>🏧 {t.pmKnet}</span>
              <span style={s.pmOptionHint}>{t.comingSoon}</span>
            </button>
          )}
          <button type="button" onClick={() => setPayMethod('card')}
                  style={s.pmOption(payMethod === 'card', false)}>
            <span style={s.pmOptionLabel}>💳 {t.pmCard}</span>
          </button>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        <button style={{ ...s.payBtn, cursor: (loading || !phoneValid) ? 'not-allowed' : 'pointer', opacity: (loading || !phoneValid) ? 0.6 : 1 }}
                onClick={payMethod === 'knet' ? handlePayKnet : handlePayCard} disabled={loading || !phoneValid}
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
