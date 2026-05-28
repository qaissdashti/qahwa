'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';

export default function SignupPage() {
  const supabase = createClient();
  const { t, dir } = useLang();

  const [fullName, setFullName] = useState('');
  const [handle, setHandle]     = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_]/g, '');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (!fullName.trim())       return setError(t('auth.signup.errName'));
    if (cleanHandle.length < 3) return setError(t('auth.signup.errHandle'));
    if (password.length < 8)    return setError(t('auth.signup.errPassword'));

    setLoading(true);
    try {
      const res  = await fetch(`/api/creator/handle-available?handle=${cleanHandle}`);
      const json = await res.json();
      if (!json.available) {
        setLoading(false);
        return setError(t('auth.signup.handleTaken'));
      }

      const { data, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { is_creator: 'true', full_name: fullName.trim(), handle: cleanHandle },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/verify`,
        },
      });

      if (signErr) throw signErr;

      if (data.session) {
        for (let i = 0; i < 20; i++) {
          if (document.cookie.includes('auth-token')) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        const initRes = await fetch('/api/creator/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: fullName.trim(), handle: cleanHandle }),
        });
        if (!initRes.ok) {
          const j = await initRes.json().catch(() => ({}));
          throw new Error(j.error || t('auth.signup.initFail'));
        }
        window.location.href = '/verify';
      } else {
        setEmailSent(true);
      }
    } catch (err) {
      setError(err.message || t('common.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <AuthShell dir={dir}>
        <div className="text-5xl mb-4 text-center">📩</div>
        <h1 className="text-2xl mb-2 text-center">{t('auth.signup.emailSentTitle')}</h1>
        <p className="text-center text-black/60 font-medium">
          {t('auth.signup.emailSentBody', { email: `‪${email}‬` })}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell dir={dir}>
      <h1 className="text-3xl mb-1 text-center">{t('auth.signup.title')}</h1>
      <p className="text-center text-black/50 font-medium mb-6">{t('auth.signup.subtitle')}</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="q-label">{t('auth.signup.fullName')}</label>
          <input className="q-input" value={fullName} onChange={(e) => setFullName(e.target.value)}
                 placeholder={t('auth.signup.fullNamePh')} autoComplete="name" />
        </div>

        <div>
          <label className="q-label">{t('auth.signup.handle')}</label>
          <div className="flex items-center gap-2" dir="ltr">
            <span className="text-sm text-black/50 font-num whitespace-nowrap">qahwa.kw/</span>
            <input className="q-input font-num" value={cleanHandle}
                   onChange={(e) => setHandle(e.target.value)}
                   placeholder={t('auth.signup.handlePh')} autoCapitalize="none" />
          </div>
        </div>

        <div>
          <label className="q-label">{t('auth.login.email')}</label>
          <input className="q-input font-num" type="email" value={email} dir="ltr"
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
                 autoComplete="email" />
        </div>

        <div>
          <label className="q-label">{t('auth.login.password')}</label>
          <input className="q-input font-num" type="password" value={password} dir="ltr"
                 onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.signup.passwordPh')}
                 autoComplete="new-password" />
        </div>

        {error && <p className="q-error">{error}</p>}

        <button className="q-btn-accent w-full text-lg py-4" disabled={loading}>
          {loading ? t('common.loading') : t('auth.signup.submit')}
        </button>
      </form>

      <p className="text-center text-sm text-black/60 mt-5 font-medium">
        {t('auth.signup.haveAccount')} <Link href="/login" className="font-bold underline">{t('auth.signup.signIn')}</Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({ children, dir }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10" dir={dir}>
      <div className="w-full max-w-md relative">
        <div className="absolute top-0 right-0 z-10"><LangToggle /></div>
        <Link href="/" className="block text-center text-2xl font-extrabold mb-6"
              style={{ fontFamily: 'Syne' }}>
          قهوة <span className="text-qahwa-accent">☕</span>
        </Link>
        <div className="q-card p-7">{children}</div>
      </div>
    </main>
  );
}
