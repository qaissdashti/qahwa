// ============================================================
// 5-step creator onboarding wizard. Each step saves to the DB on Next
// so drop-offs are captured. Flewd light palette + neo-brutalist.
// ============================================================
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';

const STEP_KEYS = ['onb.step.basic', 'onb.step.bank', 'onb.step.phone', 'onb.step.identity', 'onb.step.review'];
const EMOJI_PRESETS = ['☕', '🎨', '🎙️', '📚', '🎮', '🎵', '✨', '🌟'];

// IBAN format check intentionally relaxed — accept any non-empty text for
// now. Add proper Kuwait IBAN validation before production.
const PHONE_KW = /^\+?965\d{8}$/;

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

// Map Supabase auth errors into friendly localised messages.
function friendlyAuthError(t, err) {
  const msg = String(err?.message || err || '');
  if (/rate.*limit/i.test(msg) || /too.*many.*request/i.test(msg)) return t('onb.err.rateLimit');
  if (/invalid/i.test(msg) && /email/i.test(msg))                  return t('onb.err.emailInvalid');
  if (/already.*regist|user.*exists|already.*registered/i.test(msg)) return t('onb.err.userExists');
  if (/password/i.test(msg) && /(weak|short|at least)/i.test(msg))   return t('onb.err.passwordWeak');
  return msg || t('common.somethingWrong');
}

async function waitForAuthCookie() {
  for (let i = 0; i < 30; i++) {
    if (typeof document !== 'undefined' && document.cookie.includes('auth-token')) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

export default function OnboardingWizard({ startStep = 1, initial = {}, authed = false, whatsappOk = true }) {
  const router = useRouter();
  const supabase = createClient();
  const { t, dir, lang } = useLang();

  const [step, setStep]     = useState(startStep);
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');

  // Step 1 — basic info (also creates auth user when !authed)
  const c0 = initial.creator || {};
  const [fullName, setFullName] = useState(c0.full_name || '');
  const [handle, setHandle]     = useState(c0.handle || '');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [coffeePrice, setCoffeePrice] = useState(String(c0.coffee_price_kd ?? '1'));
  const [bio, setBio]           = useState(c0.bio || '');
  const [avatarEmoji, setAvatarEmoji] = useState(c0.avatar_emoji || '☕');
  const [avatarUrl, setAvatarUrl]     = useState(c0.avatar_url || null);
  const [avatarFile, setAvatarFile]   = useState(null);

  // Step 2 — bank
  const [bankName, setBankName]           = useState(c0.bank_name || '');
  const [accountHolder, setAccountHolder] = useState(c0.account_holder || '');
  const [iban, setIban]                   = useState('');
  const [method, setMethod]               = useState('bank_transfer');
  const ibanMasked = c0.iban_masked || null;

  // Step 3 — phone OTP
  const v0 = initial.verification || {};
  const [phone, setPhone]   = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode]     = useState('');

  // Step 4 — civil + selfie
  const [civilId, setCivilId] = useState('');
  const [selfie, setSelfie]   = useState(null);

  const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_]/g, '');

  // ── step handlers ───────────────────────────────────────────
  async function submitStep1() {
    setErr(''); setBusy(true);
    try {
      if (!fullName.trim())       throw new Error(t('auth.signup.errName'));
      if (cleanHandle.length < 3) throw new Error(t('auth.signup.errHandle'));
      const price = Number(coffeePrice);
      if (!(price > 0))           throw new Error('Coffee price must be > 0');

      if (!authed) {
        if (password.length < 8)  throw new Error(t('auth.signup.errPassword'));
        const avail = await fetch(`/api/creator/handle-available?handle=${cleanHandle}`).then((r) => r.json());
        if (!avail.available) throw new Error(t('auth.signup.handleTaken'));

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
        // Map raw Supabase errors (rate-limit, invalid email, etc.) to
        // friendly translated text — never surface the raw API message.
        if (signErr) throw new Error(friendlyAuthError(t, signErr));
        if (!data.session) {
          // email confirmation is on → can't proceed past step 1 in-app
          throw new Error(t('auth.signup.emailSentTitle') + ' (' + email + ')');
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
        const res = await fetch('/api/creator/avatar', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || t('sset.uploadFail'));
        setAvatarUrl(j.url);
      }
      setStep(2);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function submitStep2() {
    setErr(''); setBusy(true);
    try {
      if (!accountHolder.trim()) throw new Error(t('sset.accountHolder'));
      // No format validation — accept any non-empty IBAN text for now.
      const ibanToSave = iban ? iban.trim() : null;
      if (!ibanToSave && !ibanMasked) throw new Error('IBAN is required');

      const body = { bank_name: bankName, account_holder: accountHolder };
      if (ibanToSave) body.iban = ibanToSave;
      await postJson('/api/creator/settings', body);
      setStep(3);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function sendOtp() {
    setErr(''); setBusy(true);
    try {
      const num = (phone.startsWith('+965') ? phone : '+965' + phone).replace(/\s+/g, '');
      if (!PHONE_KW.test(num)) throw new Error('Use a Kuwait number: +965XXXXXXXX');
      const r = await postJson('/api/otp/send', { phone: num });
      setOtpSent(true);
      if (r.devCode) setCode(r.devCode);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function verifyOtp() {
    setErr(''); setBusy(true);
    try {
      const num = (phone.startsWith('+965') ? phone : '+965' + phone).replace(/\s+/g, '');
      await postJson('/api/otp/verify', { phone: num, code });
      setStep(4);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function submitStep4() {
    setErr(''); setBusy(true);
    try {
      if (!/^\d{12}$/.test(civilId)) throw new Error(t('auth.verify.civil.label'));
      if (!selfie) throw new Error(t('auth.verify.selfie.noFile'));
      await postJson('/api/verify/civil-id', { civilId });
      const fd = new FormData(); fd.append('selfie', selfie);
      const res = await fetch('/api/verify/selfie', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || t('common.somethingWrong'));
      setStep(5);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  // ── render ──────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8" dir={dir}
          style={{ background: '#F5F0FF' }}>
      <div className="w-full max-w-xl relative">
        <div className="absolute top-0 inset-inline-end-0 z-10" style={{ insetInlineEnd: 0 }}>
          <LangToggle />
        </div>
        <h1 className="text-center text-2xl font-extrabold mb-1" style={{ fontFamily: 'Syne' }}>
          قهوة <span className="text-qahwa-accent">☕</span>
        </h1>
        <p className="text-center text-black/55 font-medium mb-5">{t('onb.title')}</p>

        {/* stepper */}
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
                  ${active ? 'text-qahwa-purple' : 'text-black/40'}`}>{t(key)}</span>
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
            />
          )}
          {step === 2 && (
            <Step2 t={t} bankName={bankName} setBankName={setBankName}
                   accountHolder={accountHolder} setAccountHolder={setAccountHolder}
                   iban={iban} setIban={setIban} ibanMasked={ibanMasked}
                   method={method} setMethod={setMethod} />
          )}
          {step === 3 && (
            <Step3 t={t} phone={phone} setPhone={setPhone} otpSent={otpSent}
                   code={code} setCode={setCode} sendOtp={sendOtp} busy={busy}
                   whatsappOk={whatsappOk} />
          )}
          {step === 4 && (
            <Step4 t={t} civilId={civilId} setCivilId={setCivilId}
                   selfie={selfie} setSelfie={setSelfie} />
          )}
          {step === 5 && (
            <Step5 t={t} fullName={fullName} handle={cleanHandle}
                   avatarEmoji={avatarEmoji} avatarUrl={avatarUrl}
                   coffeePrice={Number(coffeePrice) || 1} />
          )}

          {err && <p className="q-error">{err}</p>}

          <div className="flex items-center gap-2 justify-between pt-2">
            <span className="text-xs text-black/40">{step < 5 ? t('onb.savedAuto') : ''}</span>
            {step === 1 && <button className="q-btn-accent" onClick={submitStep1} disabled={busy}>{busy ? t('common.loading') : t('onb.next')}</button>}
            {step === 2 && <button className="q-btn-accent" onClick={submitStep2} disabled={busy}>{busy ? t('common.loading') : t('onb.next')}</button>}
            {step === 3 && !whatsappOk && (
              <button className="q-btn-accent" onClick={() => setStep(4)} disabled={busy}>{t('onb.s3.skip')}</button>
            )}
            {step === 3 && whatsappOk && !otpSent && (
              <button className="q-btn-accent" onClick={sendOtp} disabled={busy || !phone}>{busy ? t('common.loading') : t('auth.verify.phone.send')}</button>
            )}
            {step === 3 && whatsappOk && otpSent && (
              <button className="q-btn-accent" onClick={verifyOtp} disabled={busy || code.length < 6}>{busy ? t('common.loading') : t('auth.verify.confirm')}</button>
            )}
            {step === 4 && <button className="q-btn-accent" onClick={submitStep4} disabled={busy}>{busy ? t('common.loading') : t('onb.next')}</button>}
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

// ── steps ──────────────────────────────────────────────────────

function Step1({ t, fullName, setFullName, handle, setHandle, cleanHandle, email, setEmail, password, setPassword, authed, coffeePrice, setCoffeePrice, bio, setBio, avatarEmoji, setAvatarEmoji, avatarUrl, avatarFile, setAvatarFile }) {
  return (
    <>
      <h2 className="text-xl">{t('onb.step.basic')}</h2>
      <p className="text-sm text-black/55 font-medium">{t('onb.s1.subtitle')}</p>

      <div className="space-y-2">
        <label className="q-label">{t('onb.s1.profileSec')}</label>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-qahwa-black grid place-items-center text-3xl" style={{ boxShadow: '3px 3px 0 #0D0D0D', background: '#EDE4FB' }}>
            {avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : avatarFile
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={URL.createObjectURL(avatarFile)} alt="" className="w-full h-full object-cover" />
                : <span>{avatarEmoji}</span>}
          </div>
          <label className="q-btn-white text-xs cursor-pointer">
            📷 Upload
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                   onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_PRESETS.map((e) => (
            <button key={e} type="button"
              className={`w-9 h-9 rounded-lg border-2 border-qahwa-black text-xl transition-all
                ${avatarEmoji === e && !avatarFile && !avatarUrl ? 'bg-qahwa-purple text-white' : 'bg-white'}`}
              onClick={() => { setAvatarEmoji(e); setAvatarFile(null); }}>{e}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="q-label">{t('auth.signup.fullName')}</label>
        <input className="q-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('auth.signup.fullNamePh')} />
      </div>

      <div>
        <label className="q-label">{t('auth.signup.handle')}</label>
        <input className="q-input font-num" dir="ltr" value={cleanHandle}
               onChange={(e) => setHandle(e.target.value)} placeholder={t('auth.signup.handlePh')} autoCapitalize="none" />
        <div className="text-xs text-qahwa-purple font-bold font-num mt-1" dir="ltr">
          {t('onb.s1.handlePreview', { handle: cleanHandle || '...' })}
        </div>
      </div>

      {!authed && (
        <>
          <div>
            <label className="q-label">{t('auth.login.email')}</label>
            <input className="q-input font-num" type="email" dir="ltr" value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
          </div>
          <div>
            <label className="q-label">{t('auth.login.password')}</label>
            <input className="q-input font-num" type="password" dir="ltr" value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.signup.passwordPh')} autoComplete="new-password" />
          </div>
        </>
      )}

      <div>
        <label className="q-label">{t('sset.cupPrice', { max: 10 })}</label>
        <input className="q-input font-num" dir="ltr" type="number" step="0.1" min="0.1" max="10"
               value={coffeePrice} onChange={(e) => setCoffeePrice(e.target.value)} />
      </div>

      <div>
        <label className="q-label">{t('sset.bio')}</label>
        <textarea className="q-input" rows={2} maxLength={280} value={bio}
                  onChange={(e) => setBio(e.target.value)} placeholder={t('sset.bioPlaceholder')} />
      </div>
    </>
  );
}

function Step2({ t, bankName, setBankName, accountHolder, setAccountHolder, iban, setIban, ibanMasked, method, setMethod }) {
  return (
    <>
      <h2 className="text-xl">{t('onb.step.bank')}</h2>
      <p className="text-sm text-black/55 font-medium">{t('onb.s2.subtitle')}</p>
      <div>
        <label className="q-label">{t('sset.bankName')}</label>
        <input className="q-input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder={t('sset.bankNamePh')} />
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
      <div>
        <label className="q-label">{t('onb.s2.methodLabel')}</label>
        <div className="grid grid-cols-2 gap-2">
          {[['bank_transfer', 'po.method.bank'], ['knet_send', 'po.method.knet']].map(([v, k]) => (
            <button key={v} type="button" onClick={() => setMethod(v)}
              className={`q-btn border-2 border-qahwa-black font-bold rounded-xl py-3 ${method === v ? 'bg-qahwa-purple text-white' : 'bg-white text-qahwa-black'}`}
              style={{ boxShadow: method === v ? '3px 3px 0 #0D0D0D' : 'none' }}>
              {t(k)}
            </button>
          ))}
        </div>
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
            <span className="font-extrabold text-qahwa-purple text-sm" style={{ fontFamily: "'Syne',sans-serif" }}>
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

function Step4({ t, civilId, setCivilId, selfie, setSelfie }) {
  return (
    <>
      <h2 className="text-xl">{t('onb.step.identity')}</h2>
      <p className="text-sm text-black/55 font-medium">{t('onb.s4.subtitle')}</p>
      <div>
        <label className="q-label">{t('auth.verify.civil.label')}</label>
        <input className="q-input font-num tracking-widest" dir="ltr" value={civilId}
               onChange={(e) => setCivilId(e.target.value.replace(/\D/g, '').slice(0, 12))}
               placeholder="290000000000" inputMode="numeric" />
        <p className="text-xs text-black/40 mt-1">{t('auth.verify.civil.hint')}</p>
      </div>
      <div>
        <label className="q-label">{t('auth.verify.step.selfie')}</label>
        <label className="block border-2 border-dashed border-qahwa-black rounded-xl p-6 text-center cursor-pointer hover:bg-black/5">
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                 onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
          <div className="text-4xl mb-1">{selfie ? '✅' : '📸'}</div>
          <span className="text-sm font-bold">{selfie ? selfie.name : t('auth.verify.selfie.pick')}</span>
        </label>
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
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: F.ink, textAlign: 'center' }}>{fullName || t('sset.previewName')}</div>
              <div style={{ fontSize: 10, color: F.purple, fontWeight: 700 }}>qahwa.kw/{handle}</div>
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
              {[1, 3, 5].map((n, i) => (
                <div key={n} style={{ flex: 1, border: `2px solid ${F.ink}`, borderRadius: 999, background: i === 0 ? F.purple : F.card, color: i === 0 ? '#fff' : F.ink, boxShadow: i === 0 ? `2px 2px 0 ${F.ink}` : 'none', padding: '7px 2px', textAlign: 'center', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 11 }}>
                  {(coffeePrice * n).toFixed(3)}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, background: F.accent, color: F.ink, border: `2px solid ${F.ink}`, borderRadius: 999, boxShadow: `3px 3px 0 ${F.ink}`, textAlign: 'center', padding: '9px 8px', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 12 }}>
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
