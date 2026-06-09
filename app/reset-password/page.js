'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';
import Spinner from '@/components/Spinner';

function ResetPasswordForm() {
  const supabase = createClient();
  const { t, dir } = useLang();

  // 'checking' → still waiting to confirm a recovery session exists
  // 'ready'    → recovery session established, show the form
  // 'invalid'  → no recovery session (link expired / opened directly)
  // 'done'     → password updated, redirecting
  const [phase, setPhase]       = useState('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // The browser Supabase client auto-detects the recovery token in the URL
  // hash on instantiation and fires PASSWORD_RECOVERY. We also check for an
  // already-established session in case that event fired before we subscribed.
  useEffect(() => {
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        settled = true;
        setPhase('ready');
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        settled = true;
        setPhase('ready');
      }
    });

    // Give the client a moment to parse the hash; if nothing came through,
    // the link was missing/expired.
    const timer = setTimeout(() => {
      if (!settled) setPhase('invalid');
    }, 3500);

    return () => {
      sub?.subscription?.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) { setError(t('auth.reset.tooShort')); return; }
    if (password !== confirm) { setError(t('auth.reset.mismatch')); return; }

    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setError(updErr.message || t('common.somethingWrong'));
      setLoading(false);
      return;
    }

    setPhase('done');
    // Sign out the temporary recovery session so the user logs in fresh.
    await supabase.auth.signOut();
    setTimeout(() => { window.location.href = '/login'; }, 1800);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10" dir={dir}>
      <div className="w-full max-w-md relative">
        <div className="absolute top-0 inset-inline-end-0" style={{ insetInlineEnd: 0 }}>
          <LangToggle />
        </div>
        <Link href="/" className="block text-center text-2xl font-extrabold mb-6"
              style={{ fontFamily: 'Fraunces' }}>
          قهوة <span className="text-qahwa-accent">☕</span>
        </Link>
        <div className="q-card p-7">
          <h1 className="text-3xl mb-2 text-center">{t('auth.reset.title')}</h1>

          {phase === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size={24} />
              <p className="text-sm text-black/60 font-medium">{t('auth.reset.verifying')}</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="py-4 text-center">
              <p className="q-error mb-5">{t('auth.reset.invalidLink')}</p>
              <Link href="/login" className="q-btn-accent inline-flex items-center justify-center px-6 py-3">
                {t('auth.login.title')}
              </Link>
            </div>
          )}

          {phase === 'done' && (
            <div className="py-6 text-center space-y-2">
              <p className="text-lg font-bold">{t('auth.reset.success')}</p>
              <p className="text-sm text-black/60 font-medium inline-flex items-center gap-2 justify-center">
                <Spinner size={16} />
                {t('auth.reset.redirecting')}
              </p>
            </div>
          )}

          {phase === 'ready' && (
            <>
              <p className="text-center text-sm text-black/60 mb-6 font-medium">
                {t('auth.reset.subtitle')}
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="q-label">{t('auth.reset.newPassword')}</label>
                  <input className="q-input font-num" type="password" value={password} dir="ltr"
                         onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                         autoComplete="new-password" />
                </div>
                <div>
                  <label className="q-label">{t('auth.reset.confirm')}</label>
                  <input className="q-input font-num" type="password" value={confirm} dir="ltr"
                         onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••"
                         autoComplete="new-password" />
                </div>
                {error && <p className="q-error">{error}</p>}
                <button className="q-btn-accent w-full text-lg py-4 inline-flex items-center justify-center gap-2" disabled={loading}>
                  {loading && <Spinner size={18} />}
                  {loading ? t('common.processing') : t('auth.reset.submit')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
