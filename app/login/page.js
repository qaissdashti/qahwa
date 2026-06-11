'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';
import Spinner from '@/components/Spinner';
import Logo from '@/components/Logo';
import { trackEvent, identifyUser } from '@/lib/mixpanel';

function LoginForm() {
  const params = useSearchParams();
  const next   = params.get('next') || '/dashboard';
  const supabase = createClient();
  const { t, dir } = useLang();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => { trackEvent('Login Page Viewed'); }, []);

  async function onForgot() {
    setError('');
    setResetMsg('');
    trackEvent('Forgot Password Clicked');
    if (!email) { setError(t('auth.login.resetNoEmail')); return; }
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetErr) {
      const m = resetErr.message || '';
      setError(/rate.*limit|too.*many.*request/i.test(m) ? t('onb.err.rateLimit') : (m || t('common.somethingWrong')));
      return;
    }
    setResetMsg(t('auth.login.resetSent'));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) {
      trackEvent('Login Submitted', { success: false });
      const m = signErr.message || '';
      setError(
        /invalid login credentials/i.test(m) ? t('auth.login.wrongCreds') :
        /rate.*limit|too.*many.*request/i.test(m) ? t('onb.err.rateLimit') :
        (m || t('common.somethingWrong'))
      );
      setLoading(false);
      return;
    }
    if (!data?.session) {
      trackEvent('Login Submitted', { success: false });
      setError(t('auth.login.noSession'));
      setLoading(false);
      return;
    }

    trackEvent('Login Submitted', { success: true });
    // Identify the creator for all subsequent events. Pull name/handle from
    // their own row (RLS-scoped). No PII beyond name/email is sent.
    try {
      const { data: row } = await supabase
        .from('creators').select('full_name, handle').eq('id', data.user.id).maybeSingle();
      const traits = { email: data.user.email, is_creator: true };
      if (row?.full_name) traits.name = row.full_name;
      if (row?.handle) traits.handle = row.handle;
      identifyUser(data.user.id, traits);
    } catch { /* analytics must never block login */ }

    // Wait for the session cookie to be written, then hard-navigate so the
    // server sees it (avoids the cookie-write race that bounces back to login).
    for (let i = 0; i < 20; i++) {
      if (document.cookie.includes('auth-token')) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    window.location.href = next;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10" dir={dir}>
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
          <h1 className="text-3xl mb-6 text-center">{t('auth.login.title')}</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="q-label">{t('auth.login.email')}</label>
              <input className="q-input font-num" type="email" value={email} dir="ltr"
                     onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
                     autoComplete="email" />
            </div>
            <div>
              <label className="q-label">{t('auth.login.password')}</label>
              <input className="q-input font-num" type="password" value={password} dir="ltr"
                     onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                     autoComplete="current-password" />
            </div>
            {error && <p className="q-error">{error}</p>}
            {resetMsg && <p className="text-sm font-bold text-center text-green-700">{resetMsg}</p>}
            <button className="q-btn-accent w-full text-lg py-4 inline-flex items-center justify-center gap-2" disabled={loading}>
              {loading && <Spinner size={18} />}
              {loading ? t('common.processing') : t('auth.login.submit')}
            </button>
          </form>
          <button type="button" onClick={onForgot}
                  className="block w-full text-center text-sm text-black/60 hover:text-black mt-4 font-medium underline">
            {t('auth.login.forgot')}
          </button>
          <p className="text-center text-sm text-black/60 mt-5 font-medium">
            {t('auth.login.noAccount')} <Link href="/signup" className="font-bold underline">{t('auth.login.createPage')}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
