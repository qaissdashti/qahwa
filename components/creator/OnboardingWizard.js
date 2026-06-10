// ============================================================
// 5-step creator onboarding wizard. Each step saves to the DB on Next
// so drop-offs are captured. Flewd light palette + neo-brutalist.
// ============================================================
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';
import Spinner from '@/components/Spinner';
import { xhrUpload } from '@/lib/xhrUpload';
import { KUWAIT_BANKS, bankLabel } from '@/lib/kuwaitBanks';
import { COFFEE_PRICE_OPTIONS } from '@/lib/coffeePrices';

const STEP_KEYS = ['onb.step.basic', 'onb.step.bank', 'onb.step.phone', 'onb.step.identity', 'onb.step.review'];
const EMOJI_PRESETS = ['☕', '🎨', '🎙️', '📚', '🎮', '🎵', '✨', '🌟'];

// Selfie upload constraints — kept in sync with /api/verify/selfie/route.js
// (mirror MAX_BYTES + ALLOWED there). Client-side pre-validation against
// these stops oversized / wrong-type files from ever being POSTed.
const MAX_SELFIE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_SELFIE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Pre-upload check — runs before any network. Returns an i18n key for the
// first problem found, or null if the file is fine. Type first because
// a wrong-type file is a clearer error than "too large" for, say, a HEIC.
function validateSelfieFile(file) {
  if (!file) return null;
  if (!ALLOWED_SELFIE_TYPES.includes(file.type)) return 'onb.s4.err.unsupportedType';
  if (file.size > MAX_SELFIE_BYTES) return 'onb.s4.err.tooLarge';
  return null;
}

// Map an HTTP status from a failed selfie upload to the right i18n key.
// 413 (Payload Too Large) and 415 (Unsupported Media Type) are what the
// route now returns for size/type failures; auth / server-error / default
// fall through the obvious buckets.
function selfieErrorKeyFromStatus(status) {
  if (status === 413) return 'onb.s4.err.tooLarge';
  if (status === 415) return 'onb.s4.err.unsupportedType';
  if (status === 401 || status === 403) return 'onb.s4.err.sessionExpired';
  if (typeof status === 'number' && status >= 500) return 'onb.s4.err.serverErr';
  return 'onb.s4.err.uploadFailed';
}

// IBAN format check intentionally relaxed — accept any non-empty text for
// now. Add proper Kuwait IBAN validation before production.
const PHONE_KW = /^\+?965\d{8}$/;

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Preserve the raw Supabase error metadata if the route surfaced any
    // — onboarding catches this and renders the details below the friendly
    // message so devs can see what's actually failing on Vercel.
    const e = new Error(json.error || 'Request failed');
    e.url = url;
    e.status = res.status;
    e.details = json.details || null;
    console.error('[postJson] failed', url, res.status, json);
    throw e;
  }
  return json;
}

// Map Supabase auth errors into friendly localised messages. Raw message
// is kept on `err.message` so the caller can append it to the displayed
// text (useful when a generic trigger error fires during signUp).
function friendlyAuthError(t, err) {
  const msg = String(err?.message || err || '');
  if (/rate.*limit/i.test(msg) || /too.*many.*request/i.test(msg)) return t('onb.err.rateLimit');
  if (/invalid/i.test(msg) && /email/i.test(msg))                  return t('onb.err.emailInvalid');
  if (/already.*regist|user.*exists|already.*registered/i.test(msg)) return t('onb.err.userExists');
  if (/password/i.test(msg) && /(weak|short|at least)/i.test(msg))   return t('onb.err.passwordWeak');
  // The signature Supabase Auth message when our handle_new_user() DB
  // trigger raises — usually a column/RLS mismatch on the creators table.
  // Include the raw text so the dev sees exactly what failed on Vercel.
  if (/database error/i.test(msg)) return `${msg} — likely a creators-table trigger / RLS issue on the server. Check Vercel function logs for [creator/init].`;
  return msg || t('common.somethingWrong');
}

// Compose a single error string that includes both the friendly message
// and the raw Supabase metadata (when present). Devs can see code/hint
// immediately — end users still see a localised summary.
function errorWithDetails(e) {
  if (!e?.details) return e?.message || 'Error';
  const d = e.details;
  const code = d.code ? ` [${d.code}]` : '';
  const hint = d.hint ? ` · hint: ${d.hint}` : '';
  return `${e.message || 'Error'} — ${d.message || ''}${code}${hint}`.trim();
}

async function waitForAuthCookie() {
  for (let i = 0; i < 30; i++) {
    if (typeof document !== 'undefined' && document.cookie.includes('auth-token')) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

export default function OnboardingWizard({ startStep = 1, initial = {}, authed = false, whatsappOk = true, testMode = false }) {
  const router = useRouter();
  const supabase = createClient();
  const { t, dir, lang } = useLang();

  const [step, setStep]     = useState(startStep);
  const [busy, setBusy]     = useState(false);
  // Per-field error map. Keys: fullName, handle, email, password, price.
  // 'form' is reserved for non-field errors (network, signup failure with
  // no obvious field). Cleared on each submit; specific keys cleared
  // individually as users edit.
  const [errors, setErrors] = useState({});
  const setFieldError = (field, message) =>
    setErrors((e) => ({ ...e, [field]: message }));
  const clearFieldError = (field) =>
    setErrors((e) => { if (!e[field]) return e; const n = { ...e }; delete n[field]; return n; });

  // Live handle-availability indicator. Debounced 600ms after the user
  // stops typing. Only meaningful when !authed (existing creators keep
  // whatever handle they signed up with).
  // States: 'idle' | 'short' | 'checking' | 'available' | 'taken'
  const [handleStatus, setHandleStatus] = useState('idle');

  // Step 1 — basic info (also creates auth user when !authed)
  const c0 = initial.creator || {};
  const [fullName, setFullName] = useState(c0.full_name || '');
  const [handle, setHandle]     = useState(c0.handle || '');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  // Cup price is now picked from a fixed chip set (0.5-KD multiples).
  // Stored as a Number so the chip selected-state comparison is exact.
  const [coffeePrice, setCoffeePrice] = useState(Number(c0.coffee_price_kd ?? 1));
  const [bio, setBio]           = useState(c0.bio || '');
  const [avatarEmoji, setAvatarEmoji] = useState(c0.avatar_emoji || '☕');
  const [avatarUrl, setAvatarUrl]     = useState(c0.avatar_url || null);
  const [avatarFile, setAvatarFile]   = useState(null);

  // Step 2 — bank. Payout method is fixed to bank_transfer for now (the
  // KNET-send option was removed since we don't actually support it yet).
  const [bankName, setBankName]           = useState(c0.bank_name || '');
  const [accountHolder, setAccountHolder] = useState(c0.account_holder || '');
  const [iban, setIban]                   = useState('');
  const ibanMasked = c0.iban_masked || null;

  // Step 3 — phone OTP
  const v0 = initial.verification || {};
  const [phone, setPhone]   = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode]     = useState('');

  // Step 4 — civil + selfie
  const [civilId, setCivilId] = useState('');
  const [selfie, setSelfie]   = useState(null);

  // Live upload progress (0–100). Drives the button label when an image
  // is in flight; reset to 0 when idle.
  const [uploadPct, setUploadPct] = useState(0);

  const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_]/g, '');

  // Debounced live availability check — fires 600ms after the user stops
  // typing in the handle field. Skip for already-authed creators (handle
  // is fixed) and for inputs shorter than 3 chars (server min length).
  useEffect(() => {
    if (authed) { setHandleStatus('idle'); return; }
    if (cleanHandle.length < 3) { setHandleStatus('short'); return; }
    setHandleStatus('checking');
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/creator/handle-available?handle=${cleanHandle}`);
        const j = await r.json().catch(() => ({}));
        setHandleStatus(j.available ? 'available' : 'taken');
        // Auto-clear stale per-field error if the new check passes
        if (j.available) clearFieldError('handle');
      } catch {
        setHandleStatus('idle');
      }
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanHandle, authed]);

  // ── step handlers ───────────────────────────────────────────
  async function submitStep1() {
    setErrors({}); setBusy(true);
    try {
      // ── Field-level validation ────────────────────────────────
      const next = {};
      if (!fullName.trim())       next.fullName = t('auth.signup.errName');
      if (cleanHandle.length < 3) next.handle   = t('auth.signup.errHandle');
      const price = Number(coffeePrice);
      if (!COFFEE_PRICE_OPTIONS.includes(Number(price.toFixed(1)))) {
        next.price = t('sset.priceMustBeChip');
      }
      if (!authed && password.length < 8) next.password = t('auth.signup.errPassword');
      // Honour the latest live-check result — saves a round-trip if we
      // already know the handle is taken.
      if (!authed && handleStatus === 'taken') next.handle = t('auth.signup.handleTaken');
      if (Object.keys(next).length) { setErrors(next); return; }

      if (!authed) {
        // Authoritative server check just before sign-up (defensive — the
        // debounced live check may have raced or been bypassed).
        const avail = await fetch(`/api/creator/handle-available?handle=${cleanHandle}`).then((r) => r.json());
        if (!avail.available) {
          setHandleStatus('taken');
          setFieldError('handle', t('auth.signup.handleTaken'));
          return;
        }

        const { data, error: signErr } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { is_creator: 'true', full_name: fullName.trim(), handle: cleanHandle },
            // If email confirmation is enabled in Supabase, the link in
            // the confirmation email comes back to whichever origin the
            // user signed up on — works on localhost, Vercel previews,
            // and production without any code change.
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboard`,
          },
        });
        if (signErr) {
          // Full object in devtools so devs can see status/code/origin —
          // particularly useful when the server returns a generic
          // "Database error saving new user" from the handle_new_user trigger.
          console.error('[onboard] signUp failed', signErr);
          const friendly = friendlyAuthError(t, signErr);
          const raw = (signErr.message || '').toLowerCase();
          if (/email|already|registered|invalid|exists/.test(raw))         setFieldError('email', friendly);
          else if (/password|weak|short|characters/.test(raw))             setFieldError('password', friendly);
          else                                                              setFieldError('form', friendly);
          return;
        }
        if (!data.session) {
          // Email confirmation is on → can't proceed past step 1 in-app.
          setFieldError('email', t('auth.signup.emailSentTitle') + ' (' + email + ')');
          return;
        }
        await waitForAuthCookie();
        await postJson('/api/creator/init', { full_name: fullName.trim(), handle: cleanHandle });
      }

      // Save profile fields (works in both modes)
      await postJson('/api/creator/settings', {
        full_name: fullName.trim(),
        bio,
        avatar_emoji: avatarEmoji,
        coffee_price_kd: price,
      });

      if (avatarFile) {
        const fd = new FormData(); fd.append('avatar', avatarFile);
        // Re-throw the original error so its .details survive into the
        // catch — losing them would mask the actual storage/RLS issue.
        const j = await xhrUpload('/api/creator/avatar', fd, (pct) => setUploadPct(pct));
        setAvatarUrl(j.url);
      }
      setStep(2);
    } catch (e) { setFieldError('form', errorWithDetails(e)); }
    finally { setBusy(false); setUploadPct(0); }
  }

  async function submitStep2() {
    setErrors({}); setBusy(true);
    try {
      if (!accountHolder.trim()) throw new Error(t('sset.accountHolder'));
      // No format validation — accept any non-empty IBAN text for now.
      const ibanToSave = iban ? iban.trim() : null;
      if (!ibanToSave && !ibanMasked) throw new Error('IBAN is required');

      const body = { bank_name: bankName, account_holder: accountHolder };
      if (ibanToSave) body.iban = ibanToSave;
      await postJson('/api/creator/settings', body);
      setStep(3);
    } catch (e) { setFieldError('form', errorWithDetails(e)); }
    finally { setBusy(false); }
  }

  async function sendOtp() {
    setErrors({}); setBusy(true);
    try {
      const num = (phone.startsWith('+965') ? phone : '+965' + phone).replace(/\s+/g, '');
      if (!PHONE_KW.test(num)) throw new Error('Use a Kuwait number: +965XXXXXXXX');
      const r = await postJson('/api/otp/send', { phone: num });
      setOtpSent(true);
      if (r.devCode) setCode(r.devCode);
    } catch (e) { setFieldError('form', errorWithDetails(e)); }
    finally { setBusy(false); }
  }

  async function verifyOtp() {
    setErrors({}); setBusy(true);
    try {
      const num = (phone.startsWith('+965') ? phone : '+965' + phone).replace(/\s+/g, '');
      await postJson('/api/otp/verify', { phone: num, code });
      setStep(4);
    } catch (e) { setFieldError('form', errorWithDetails(e)); }
    finally { setBusy(false); }
  }

  async function submitStep4() {
    setErrors({}); setBusy(true);
    try {
      if (!/^\d{12}$/.test(civilId)) {
        setFieldError('civilId', t('auth.verify.civil.label'));
        return;
      }
      if (!selfie) {
        setFieldError('selfie', t('auth.verify.selfie.noFile'));
        return;
      }

      // Client-side pre-validation — skip the round-trip entirely if the
      // file fails the same checks the server would run. Saves the user
      // a multi-MB upload just to get told "too large".
      const preKey = validateSelfieFile(selfie);
      if (preKey) {
        setFieldError('selfie', t(preKey));
        return;
      }

      await postJson('/api/verify/civil-id', { civilId });

      const fd = new FormData(); fd.append('selfie', selfie);
      try {
        await xhrUpload('/api/verify/selfie', fd, (pct) => setUploadPct(pct));
      } catch (uploadErr) {
        // Server-side rejection — translate HTTP status to a friendly
        // bilingual message and pin it under the selfie field.
        console.error('[onboard/selfie] upload failed', uploadErr);
        setFieldError('selfie', t(selfieErrorKeyFromStatus(uploadErr.status)));
        return;
      }
      setStep(5);
    } catch (e) { setFieldError('form', errorWithDetails(e)); }
    finally { setBusy(false); setUploadPct(0); }
  }

  // ── render ──────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8" dir={dir}
          style={{ background: '#F5F0FF' }}>
      <div className="w-full max-w-xl relative">
        <div className="absolute top-0 inset-inline-end-0 z-10" style={{ insetInlineEnd: 0 }}>
          <LangToggle />
        </div>
        <h1 className="text-center text-2xl font-extrabold mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
          قهوة <span className="text-qahwa-accent">☕</span>
        </h1>
        <p className="text-center text-black/55 font-medium mb-5">{t('onb.title')}</p>

        {/* stepper — on mobile (< sm) only the ACTIVE label is shown so
            the labels don't truncate at 375px width */}
        <div className="flex items-center justify-between mb-6">
          {STEP_KEYS.map((key, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div key={key} className="flex-1 flex flex-col items-center min-w-0">
                <div className={`w-9 h-9 rounded-full border-2 border-qahwa-black grid place-items-center font-bold transition-colors
                  ${done ? 'bg-qahwa-accent text-qahwa-black' : active ? 'bg-qahwa-purple text-white' : 'bg-white text-black/40'}`}
                  style={done || active ? { boxShadow: '2px 2px 0 #0D0D0D' } : {}}>
                  {done ? '✓' : n}
                </div>
                <span className={`text-[10px] mt-1 font-bold text-center px-1 truncate w-full
                  ${active ? 'text-qahwa-purple' : 'text-black/40'}
                  ${active ? '' : 'hidden sm:block'}`}>{t(key)}</span>
              </div>
            );
          })}
        </div>

        <div className="q-card p-6 space-y-4 bg-white">
          {step === 1 && (
            <Step1
              t={t} fullName={fullName} setFullName={setFullName}
              handle={handle} setHandle={setHandle} cleanHandle={cleanHandle}
              email={email} setEmail={setEmail} password={password} setPassword={setPassword}
              authed={authed} coffeePrice={coffeePrice} setCoffeePrice={setCoffeePrice}
              bio={bio} setBio={setBio} avatarEmoji={avatarEmoji} setAvatarEmoji={setAvatarEmoji}
              avatarUrl={avatarUrl} avatarFile={avatarFile} setAvatarFile={setAvatarFile}
              errors={errors} clearFieldError={clearFieldError}
              handleStatus={handleStatus}
            />
          )}
          {step === 2 && (
            <Step2 t={t} bankName={bankName} setBankName={setBankName}
                   accountHolder={accountHolder} setAccountHolder={setAccountHolder}
                   iban={iban} setIban={setIban} ibanMasked={ibanMasked} />
          )}
          {step === 3 && (
            <Step3 t={t} phone={phone} setPhone={setPhone} otpSent={otpSent}
                   code={code} setCode={setCode} sendOtp={sendOtp} busy={busy}
                   whatsappOk={whatsappOk} />
          )}
          {step === 4 && (
            <Step4 t={t} civilId={civilId} setCivilId={setCivilId}
                   selfie={selfie} setSelfie={setSelfie}
                   errors={errors} setFieldError={setFieldError} clearFieldError={clearFieldError} />
          )}
          {step === 5 && (
            <Step5 t={t} fullName={fullName} handle={cleanHandle}
                   avatarEmoji={avatarEmoji} avatarUrl={avatarUrl}
                   coffeePrice={Number(coffeePrice) || 1} />
          )}

          {/* General/non-field errors only — per-field errors render inline
              under their own input (Step 1). */}
          {errors.form && <p className="q-error">{errors.form}</p>}

          {/* TEMPORARY (PAYMENT_TEST_MODE): bypass WhatsApp OTP on step 3 while
              the Meta OTP template is pending approval. Deliberately loud +
              dashed so it can't be mistaken for a production control. Remove
              this block (and the testMode prop) once OTP is approved. */}
          {testMode && step === 3 && (
            <button type="button" onClick={() => setStep(4)}
              className="w-full rounded-xl border-2 border-dashed border-qahwa-orange bg-qahwa-orange/10
                         text-qahwa-black font-bold text-sm py-3 px-4 transition-colors hover:bg-qahwa-orange/20">
              {t('onb.s3.testSkip')}
            </button>
          )}

          <div className="flex items-center gap-2 justify-between pt-2">
            <span className="text-xs text-black/40">{step < 5 ? t('onb.savedAuto') : ''}</span>
            {step === 1 && <WizardBtn busy={busy} pct={uploadPct} onClick={submitStep1} t={t} label={t('onb.next')} />}
            {step === 2 && <WizardBtn busy={busy} onClick={submitStep2} t={t} label={t('onb.next')} />}
            {step === 3 && !whatsappOk && (
              <WizardBtn busy={busy} onClick={() => setStep(4)} t={t} label={t('onb.s3.skip')} />
            )}
            {step === 3 && whatsappOk && !otpSent && (
              <WizardBtn busy={busy} disabled={!phone} onClick={sendOtp} t={t} label={t('auth.verify.phone.send')} />
            )}
            {step === 3 && whatsappOk && otpSent && (
              <WizardBtn busy={busy} disabled={code.length < 6} onClick={verifyOtp} t={t} label={t('auth.verify.confirm')} />
            )}
            {step === 4 && <WizardBtn busy={busy} pct={uploadPct} onClick={submitStep4} t={t} label={t('onb.next')} />}
            {step === 5 && (
              <Link href={`/${cleanHandle || c0.handle || ''}`} className="q-btn-accent">{t('onb.s5.viewPage')}</Link>
            )}
          </div>
        </div>

        {!authed && step === 1 && (
          <p className="text-center text-sm text-black/55 mt-4">
            {t('auth.signup.haveAccount')} <Link href="/login" className="font-bold underline">{t('auth.signup.signIn')}</Link>
          </p>
        )}
      </div>
    </main>
  );
}

// Shared wizard CTA button — Spinner + smart label (idle / processing /
// uploading X%). Stays disabled while busy so a quick double-tap won't
// fire the handler twice.
function WizardBtn({ busy, disabled, pct = 0, onClick, t, label }) {
  return (
    <button type="button" onClick={onClick}
      disabled={busy || disabled}
      className="q-btn-accent inline-flex items-center justify-center gap-2 min-w-[120px]">
      {busy && <Spinner size={16} />}
      {busy
        ? (pct > 0 ? t('common.uploading', { pct }) : t('common.processing'))
        : label}
    </button>
  );
}

// ── steps ──────────────────────────────────────────────────────

// ── Step 1 helpers ─────────────────────────────────────────────
const ERR_RED = '#FF5A5A';
// Inline red error message under a field (also serves as the aria-describedby
// target — we keep it dumb on purpose, parent decides whether to render it).
function FieldError({ children }) {
  if (!children) return null;
  return <p className="text-sm font-bold mt-1.5" style={{ color: ERR_RED }}>{children}</p>;
}
// Red border for input/textarea when the matching error key is set.
const errorBorder = (err) => (err ? { borderColor: ERR_RED } : undefined);

// Live status pill under the handle field. Color + symbol mirror the
// handleStatus state, not just availability — so users see "checking…"
// the moment they pause typing.
// Live cup-selector preview for Step 1. Mirrors components/tipper/
// TippingClient.js pill geometry exactly (border, padding, radius,
// shadow, font, sizes) so creators see what supporters will actually
// see — purple-selected first pill, white unselected next two, lavender
// brutalist card behind. Always shows 1/3/5 cups regardless of the
// price chip — that's the live tipping page's behavior too.
function CupPreview({ t, price }) {
  const ink = '#0D0D0D', purple = '#7B2FBE', card = '#FFFFFF', soft = '#EDE4FB';
  const pill = (sel) => ({
    flex: 1, border: `2px solid ${ink}`, borderRadius: 999,
    background: sel ? purple : card, color: sel ? '#fff' : ink,
    boxShadow: sel ? `3px 3px 0 ${ink}` : 'none',
    padding: '14px 6px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 2,
  });
  const amt = { fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 800 };
  return (
    <div className="mt-3">
      <div className="text-xs font-bold text-black/50 mb-1.5">{t('onb.s1.previewTitle')}</div>
      <div style={{
        display: 'flex', gap: 9, padding: 12, borderRadius: 16,
        background: soft, border: `2px solid ${ink}`, boxShadow: `3px 3px 0 ${ink}`,
      }}>
        {[1, 3, 5].map((cups, i) => (
          <div key={cups} style={pill(i === 0)}>
            <span style={{ fontSize: cups === 5 ? 22 : 20 }}>
              {cups === 1 ? '☕' : cups === 3 ? '☕☕☕' : '🫖'}
            </span>
            <span style={{ fontSize: 10, opacity: 0.8 }} dir="auto">
              {t(`onb.s1.cup.${cups}`)}
            </span>
            <span style={amt} dir="ltr">{(price * cups).toFixed(1)}</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>KD</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HandleStatusPill({ status, t }) {
  if (status === 'idle' || status === 'short') return null;
  const map = {
    checking:  { text: t('onb.s1.handleChecking'),  color: '#7B2FBE' },
    available: { text: t('onb.s1.handleAvailable'), color: '#27a85a' },
    taken:     { text: t('onb.s1.handleTakenIn'),   color: ERR_RED   },
  };
  const m = map[status];
  return <span className="text-xs font-extrabold ms-2" style={{ color: m.color }}>{m.text}</span>;
}

function Step1({
  t, fullName, setFullName, handle, setHandle, cleanHandle,
  email, setEmail, password, setPassword,
  authed, coffeePrice, setCoffeePrice, bio, setBio,
  avatarEmoji, setAvatarEmoji, avatarUrl, avatarFile, setAvatarFile,
  errors, clearFieldError, handleStatus,
}) {
  const hasImage = !!avatarUrl || !!avatarFile;

  return (
    <>
      <h2 className="text-xl">{t('onb.step.basic')}</h2>
      <p className="text-sm text-black/55 font-medium">{t('onb.s1.subtitle')}</p>

      {/* ── Avatar: big dashed dropzone OR compact preview-with-Change ── */}
      <div className="space-y-3">
        <label className="q-label">{t('onb.s1.profileSec')}</label>

        {hasImage ? (
          // After a file/url is present: small thumbnail + change link.
          <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-qahwa-black"
               style={{ background: '#FAFAF7', boxShadow: '3px 3px 0 #0D0D0D' }}>
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-qahwa-black grid place-items-center shrink-0" style={{ background: '#EDE4FB' }}>
              {avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={URL.createObjectURL(avatarFile)} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="text-xs font-bold text-black/60 truncate flex-1">
              {avatarFile?.name || 'avatar.png'}
            </div>
            <label className="q-btn-white text-xs cursor-pointer">
              {t('onb.s1.uploadChange')}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                     onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        ) : (
          // Empty state: big dashed dropzone, clickable across the whole area.
          <label className="block cursor-pointer text-center px-5 py-8 rounded-2xl transition-all hover:bg-white/60"
                 style={{
                   border: '2.5px dashed #0D0D0D',
                   background: 'rgba(255,255,255,0.5)',
                 }}>
            <div className="text-5xl mb-2">📷</div>
            <div className="text-base font-extrabold" style={{ fontFamily: 'var(--font-sans)' }}>
              {t('onb.s1.uploadCta')}
            </div>
            <div className="text-xs font-medium text-black/50 mt-1">
              {t('onb.s1.uploadHint')}
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                   onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
          </label>
        )}

        {/* Emoji fallback — only shown when no photo is uploaded. Once
            an image is in place it becomes redundant noise. */}
        {!hasImage && (
          <div>
            <div className="text-xs font-bold text-black/50 mb-1.5">{t('onb.s1.orPickEmoji')}</div>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_PRESETS.map((e) => (
                <button key={e} type="button"
                  className={`w-9 h-9 rounded-lg border-2 border-qahwa-black text-xl transition-all
                    ${avatarEmoji === e ? 'bg-qahwa-purple text-white' : 'bg-white'}`}
                  onClick={() => { setAvatarEmoji(e); setAvatarFile(null); }}>{e}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Full name ── */}
      <div>
        <label className="q-label">{t('auth.signup.fullName')}</label>
        <input className="q-input" value={fullName} style={errorBorder(errors.fullName)}
               onChange={(e) => { setFullName(e.target.value); clearFieldError('fullName'); }}
               placeholder={t('auth.signup.fullNamePh')}
               aria-invalid={!!errors.fullName} />
        <FieldError>{errors.fullName}</FieldError>
      </div>

      {/* ── Handle (with live availability pill) ── */}
      <div>
        <label className="q-label flex items-center">
          <span>{t('auth.signup.handle')}</span>
          {!authed && <HandleStatusPill status={handleStatus} t={t} />}
        </label>
        <input className="q-input font-num" dir="ltr" value={cleanHandle} style={errorBorder(errors.handle)}
               onChange={(e) => { setHandle(e.target.value); clearFieldError('handle'); }}
               placeholder={t('auth.signup.handlePh')} autoCapitalize="none"
               aria-invalid={!!errors.handle} />
        <div className="text-xs text-qahwa-purple font-bold font-num mt-1" dir="ltr">
          {t('onb.s1.handlePreview', { handle: cleanHandle || '...' })}
        </div>
        <FieldError>{errors.handle}</FieldError>
      </div>

      {!authed && (
        <>
          <div>
            <label className="q-label">{t('auth.login.email')}</label>
            <input className="q-input font-num" type="email" dir="ltr" value={email}
                   style={errorBorder(errors.email)}
                   onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                   placeholder="you@email.com" autoComplete="email"
                   aria-invalid={!!errors.email} />
            <FieldError>{errors.email}</FieldError>
          </div>
          <div>
            <label className="q-label">{t('auth.login.password')}</label>
            <input className="q-input font-num" type="password" dir="ltr" value={password}
                   style={errorBorder(errors.password)}
                   onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                   placeholder={t('auth.signup.passwordPh')} autoComplete="new-password"
                   aria-invalid={!!errors.password} />
            <FieldError>{errors.password}</FieldError>
          </div>
        </>
      )}

      {/* ── Coffee price chips + live cup-selector preview ── */}
      <div>
        <label className="q-label">{t('sset.cupPricePick')}</label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('sset.cupPricePick')}>
          {COFFEE_PRICE_OPTIONS.map((p) => {
            const selected = Number(coffeePrice) === p;
            return (
              <button key={p} type="button" role="radio" aria-checked={selected}
                onClick={() => { setCoffeePrice(p); clearFieldError('price'); }}
                className={`px-3.5 py-2 rounded-xl border-2 border-qahwa-black font-bold font-num text-sm transition-all
                  ${selected ? 'bg-qahwa-purple text-white' : 'bg-white text-qahwa-black'}`}
                style={{ boxShadow: selected ? '3px 3px 0 #0D0D0D' : 'none' }}>
                {p.toFixed(1)} <span className="opacity-70 text-xs">KD</span>
              </button>
            );
          })}
        </div>
        <FieldError>{errors.price}</FieldError>

        {/* Live preview — pixel-mirrors the TippingClient cup pills so the
            creator sees the exact 1/3/5-cup amounts their supporters will
            see. Re-renders on every chip tap (coffeePrice changes). */}
        <CupPreview t={t} price={Number(coffeePrice)} />
      </div>

      <div>
        <label className="q-label">{t('sset.bio')}</label>
        <textarea className="q-input" rows={2} maxLength={280} value={bio}
                  onChange={(e) => setBio(e.target.value)} placeholder={t('sset.bioPlaceholder')} />
      </div>
    </>
  );
}

function Step2({ t, bankName, setBankName, accountHolder, setAccountHolder, iban, setIban, ibanMasked }) {
  return (
    <>
      <h2 className="text-xl">{t('onb.step.bank')}</h2>
      <p className="text-sm text-black/55 font-medium">{t('onb.s2.subtitle')}</p>
      <div>
        <label className="q-label">{t('sset.bankName')}</label>
        <select className="q-input" value={bankName} onChange={(e) => setBankName(e.target.value)}>
          <option value="">{t('sset.bankNamePh')}</option>
          {KUWAIT_BANKS.map((b) => (
            <option key={b.en} value={b.value}>{bankLabel(b)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="q-label">{t('sset.accountHolder')}</label>
        <input className="q-input" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder={t('sset.holderPh')} />
      </div>
      <div>
        <label className="q-label">{t('sset.iban')}</label>
        {ibanMasked && (
          <div className="text-xs text-qahwa-purple font-num mb-1.5" dir="ltr">{t('sset.ibanSaved', { iban: ibanMasked })}</div>
        )}
        <input className="q-input font-num" dir="ltr" value={iban}
               onChange={(e) => setIban(e.target.value.toUpperCase())}
               placeholder={ibanMasked ? t('sset.ibanPlaceholderSaved') : t('sset.ibanPlaceholderEmpty')} />
      </div>
    </>
  );
}

function Step3({ t, phone, setPhone, otpSent, code, setCode, sendOtp, busy, whatsappOk }) {
  // WhatsApp not configured on the server → render a Skip-only panel so
  // onboarding can complete end-to-end without WhatsApp wired up.
  if (!whatsappOk) {
    return (
      <>
        <h2 className="text-xl">{t('onb.step.phone')}</h2>
        <div className="bg-qahwa-purple/10 border-2 border-qahwa-purple/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl">📵</span>
            <span className="font-extrabold text-qahwa-purple text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
              {t('onb.s3.notConfigured')}
            </span>
          </div>
          <p className="text-sm text-black/60 font-medium">{t('onb.s3.notConfBody')}</p>
        </div>
      </>
    );
  }
  return (
    <>
      <h2 className="text-xl">{t('onb.step.phone')}</h2>
      <p className="text-sm text-black/55 font-medium">{t('onb.s3.subtitle')}</p>
      <div>
        <label className="q-label">{t('onb.s3.phone')}</label>
        <div className="flex gap-2">
          <span className="q-input font-num text-center w-20 shrink-0 grid place-items-center font-bold" style={{ direction: 'ltr' }}>+965</span>
          <input className="q-input font-num flex-1" dir="ltr" value={phone.replace(/^\+?965/, '')}
                 onChange={(e) => setPhone('+965' + e.target.value.replace(/\D/g, '').slice(0, 8))}
                 placeholder="XXXXXXXX" disabled={otpSent} inputMode="numeric" />
        </div>
      </div>
      {otpSent && (
        <div>
          <label className="q-label">{t('auth.verify.code.label')}</label>
          <input className="q-input font-num tracking-[0.4em] text-center" dir="ltr" value={code}
                 onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                 placeholder="••••••" inputMode="numeric" />
          <p className="text-xs text-qahwa-purple font-bold mt-1.5">{t('onb.devOtp')}</p>
        </div>
      )}
    </>
  );
}

function Step4({ t, civilId, setCivilId, selfie, setSelfie, errors = {}, setFieldError = () => {}, clearFieldError = () => {} }) {
  // Pick-time validation: the moment a file lands in state, run the same
  // pre-flight check submitStep4 would, so the user gets instant inline
  // feedback rather than only seeing the error when they hit Next.
  function onPick(file) {
    setSelfie(file);
    if (!file) { clearFieldError('selfie'); return; }
    const key = validateSelfieFile(file);
    if (key) setFieldError('selfie', t(key));
    else clearFieldError('selfie');
  }

  const selfieErr = errors.selfie;
  return (
    <>
      <h2 className="text-xl">{t('onb.step.identity')}</h2>
      <p className="text-sm text-black/55 font-medium">{t('onb.s4.subtitle')}</p>
      <div>
        <label className="q-label">{t('auth.verify.civil.label')}</label>
        <input className="q-input font-num tracking-widest" dir="ltr" value={civilId}
               style={errorBorder(errors.civilId)}
               onChange={(e) => { setCivilId(e.target.value.replace(/\D/g, '').slice(0, 12)); clearFieldError('civilId'); }}
               placeholder="290000000000" inputMode="numeric"
               aria-invalid={!!errors.civilId} />
        <p className="text-xs text-black/40 mt-1">{t('auth.verify.civil.hint')}</p>
        <FieldError>{errors.civilId}</FieldError>
      </div>
      <div>
        <label className="q-label">{t('auth.verify.step.selfie')}</label>
        <label className="block border-2 border-dashed rounded-2xl px-5 py-7 text-center cursor-pointer transition-all hover:bg-black/5"
               style={{
                 background: 'rgba(255,255,255,0.5)',
                 borderColor: selfieErr ? ERR_RED : '#0D0D0D',
               }}>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                 onChange={(e) => onPick(e.target.files?.[0] || null)} />
          <div className="text-5xl mb-2">{selfie && !selfieErr ? '✅' : '🤳'}</div>
          {selfie && !selfieErr ? (
            <span className="text-sm font-bold">{selfie.name}</span>
          ) : (
            <>
              <div className="text-base font-extrabold leading-snug" style={{ fontFamily: 'var(--font-sans)' }}>
                {t('auth.verify.selfie.pick')}
              </div>
              <div className="text-xs font-medium text-black/55 mt-1.5 max-w-xs mx-auto leading-relaxed">
                {t('auth.verify.selfie.hint')}
              </div>
            </>
          )}
        </label>
        <FieldError>{selfieErr}</FieldError>
      </div>
    </>
  );
}

function Step5({ t, fullName, handle, avatarEmoji, avatarUrl, coffeePrice }) {
  const F = { bg: '#F5F0FF', card: '#FFFFFF', ink: '#0D0D0D', accent: '#C8F55A', purple: '#7B2FBE', soft: '#EDE4FB' };
  return (
    <>
      <div className="text-6xl text-center">🕵️</div>
      <h2 className="text-2xl text-center">{t('onb.s5.title')}</h2>
      <p className="text-center text-black/60 font-medium">{t('onb.s5.subtitle')}</p>

      <div className="pt-2">
        <p className="text-xs font-bold text-qahwa-purple mb-2">{t('onb.s5.previewLabel')}</p>
        <div style={{ background: F.bg, borderRadius: 18, padding: 14 }}>
          <div style={{ background: F.card, border: `2px solid ${F.ink}`, borderRadius: 20, boxShadow: `4px 4px 0 ${F.ink}`, padding: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${F.ink}`, boxShadow: `2px 2px 0 ${F.ink}`, overflow: 'hidden', display: 'grid', placeItems: 'center', background: F.soft, fontSize: 24 }}>
                {avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : avatarEmoji}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 14, color: F.ink, textAlign: 'center' }}>{fullName || t('sset.previewName')}</div>
              <div style={{ fontSize: 10, color: F.purple, fontWeight: 700 }}>qahwa.kw/{handle}</div>
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
              {[1, 3, 5].map((n, i) => (
                <div key={n} style={{ flex: 1, border: `2px solid ${F.ink}`, borderRadius: 999, background: i === 0 ? F.purple : F.card, color: i === 0 ? '#fff' : F.ink, boxShadow: i === 0 ? `2px 2px 0 ${F.ink}` : 'none', padding: '7px 2px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 11 }}>
                  {(coffeePrice * n).toFixed(3)}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, background: F.accent, color: F.ink, border: `2px solid ${F.ink}`, borderRadius: 999, boxShadow: `3px 3px 0 ${F.ink}`, textAlign: 'center', padding: '9px 8px', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 12 }}>
              {t('sset.previewCta', { amt: Number(coffeePrice).toFixed(3) })}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <p className="text-xs font-bold text-qahwa-purple mb-1">{t('onb.s5.waMsgLabel')}</p>
        <div className="text-sm bg-qahwa-wa/10 border-2 border-qahwa-wa rounded-xl p-3" dir="auto">
          💬 {t('onb.s5.waMsg', { name: fullName || '...', handle })}
        </div>
      </div>
    </>
  );
}
