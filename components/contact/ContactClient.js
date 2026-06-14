'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';
import Logo from '@/components/Logo';
import Spinner from '@/components/Spinner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function ContactClient() {
  const { t, dir } = useLang();

  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [website, setWebsite] = useState('');   // honeypot — must stay empty
  const [token, setToken] = useState('');        // Turnstile token
  const [status, setStatus] = useState('idle');  // idle | sending | success
  const [error, setError] = useState('');

  const turnstileRef = useRef(null);
  const widgetId = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Render the Turnstile widget once the script is available. Safe to call
  // multiple times — guarded by widgetId.
  function renderTurnstile() {
    if (!SITE_KEY || widgetId.current !== null) return;
    if (typeof window === 'undefined' || !window.turnstile || !turnstileRef.current) return;
    widgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: SITE_KEY,
      callback: (tok) => setToken(tok),
      'expired-callback': () => setToken(''),
      'error-callback': () => setToken(''),
    });
  }

  // If the script was already loaded (cached) before this mounted, render now.
  useEffect(() => { renderTurnstile(); /* eslint-disable-next-line */ }, []);

  function resetTurnstile() {
    setToken('');
    try { if (widgetId.current !== null) window.turnstile?.reset(widgetId.current); } catch {}
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    const name = form.name.trim();
    const email = form.email.trim();
    const subject = form.subject.trim();
    const message = form.message.trim();

    if (!name || !email || !subject || !message) { setError(t('contact.errRequired')); return; }
    if (!EMAIL_RE.test(email)) { setError(t('contact.errEmail')); return; }
    // Only enforce Turnstile client-side when it's actually configured.
    if (SITE_KEY && !token) { setError(t('contact.errTurnstile')); return; }

    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, website, turnstileToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const map = {
          rate_limited: 'contact.errRate',
          invalid_email: 'contact.errEmail',
          missing_fields: 'contact.errRequired',
          turnstile_failed: 'contact.errTurnstile',
        };
        setError(t(map[data?.error] || 'contact.errGeneric'));
        setStatus('idle');
        resetTurnstile(); // token is single-use — refresh for a retry
        return;
      }
      setStatus('success');
    } catch {
      setError(t('contact.errGeneric'));
      setStatus('idle');
      resetTurnstile();
    }
  }

  function reset() {
    setForm({ name: '', email: '', subject: '', message: '' });
    setError('');
    setStatus('idle');
    resetTurnstile();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10" dir={dir}>
      {SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={renderTurnstile}
        />
      )}

      <div className="w-full max-w-md relative">
        <div className="absolute top-0 inset-inline-end-0" style={{ insetInlineEnd: 0 }}>
          <LangToggle />
        </div>

        <Link href="/" className="flex items-center justify-center gap-2 text-2xl font-extrabold mb-6"
              style={{ fontFamily: 'var(--font-sans)' }}>
          <Logo size={36} />
          <span>قهوة</span>
        </Link>

        <div className="q-card p-7">
          {status === 'success' ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-3">✉️</div>
              <h1 className="text-2xl mb-2">{t('contact.successTitle')}</h1>
              <p className="text-sm text-black/60 font-medium mb-6">{t('contact.successBody')}</p>
              <button onClick={reset} className="q-btn-accent w-full py-3">{t('contact.sendAnother')}</button>
              <Link href="/" className="block text-center text-sm text-black/60 hover:text-black mt-4 font-medium underline">
                {t('contact.back')}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-3xl mb-1 text-center">{t('contact.title')}</h1>
              <p className="text-sm text-black/55 font-medium text-center mb-6">{t('contact.subtitle')}</p>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="q-label">{t('contact.name')}</label>
                  <input className="q-input" value={form.name} onChange={set('name')}
                         placeholder={t('contact.namePh')} autoComplete="name" maxLength={100} />
                </div>
                <div>
                  <label className="q-label">{t('contact.email')}</label>
                  <input className="q-input font-num" type="email" dir="ltr" value={form.email} onChange={set('email')}
                         placeholder="you@email.com" autoComplete="email" maxLength={200} />
                </div>
                <div>
                  <label className="q-label">{t('contact.subject')}</label>
                  <input className="q-input" value={form.subject} onChange={set('subject')}
                         placeholder={t('contact.subjectPh')} maxLength={150} />
                </div>
                <div>
                  <label className="q-label">{t('contact.message')}</label>
                  <textarea className="q-input" rows={5} value={form.message} onChange={set('message')}
                            placeholder={t('contact.messagePh')} maxLength={5000} />
                </div>

                {/* Honeypot — CSS-hidden (not type=hidden). Real users never see
                    or focus it; bots that auto-fill every field will trip it. */}
                <div aria-hidden="true"
                     style={{ position: 'absolute', left: '-9999px', top: 0, width: 1, height: 1, overflow: 'hidden' }}>
                  <label>
                    Website
                    <input type="text" name="website" tabIndex={-1} autoComplete="off"
                           value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </label>
                </div>

                {/* Cloudflare Turnstile widget (only when a site key is set). */}
                {SITE_KEY && <div ref={turnstileRef} className="flex justify-center" />}

                {error && <p className="q-error">{error}</p>}

                <button className="q-btn-accent w-full text-lg py-4 inline-flex items-center justify-center gap-2"
                        disabled={status === 'sending'}>
                  {status === 'sending' && <Spinner size={18} />}
                  {status === 'sending' ? t('contact.sending') : t('contact.send')}
                </button>
              </form>

              <Link href="/" className="block text-center text-sm text-black/60 hover:text-black mt-5 font-medium underline">
                {t('contact.back')}
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
