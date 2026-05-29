'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';
import Spinner from '@/components/Spinner';

export default function AdminLogin() {
  const supabase = createClient();
  const { t, dir } = useLang();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);

    const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) {
      setError(/invalid login credentials/i.test(signErr.message || '')
        ? t('auth.login.wrongCreds')
        : (signErr.message || t('common.somethingWrong')));
      setLoading(false);
      return;
    }
    if (!data?.session) {
      setError(t('auth.login.noSession'));
      setLoading(false);
      return;
    }
    for (let i = 0; i < 20; i++) {
      if (document.cookie.includes('auth-token')) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    window.location.href = '/admin';
  }

  return (
    <main className="min-h-screen dash-bg text-white flex items-center justify-center px-5" dir={dir}>
      <div className="w-full max-w-sm dash-surface border border-white/10 rounded-2xl p-7 relative">
        <div className="absolute top-3 right-3"><LangToggle variant="dark" /></div>
        <h1 className="text-2xl mb-1">{t('admin.signinTitle')}</h1>
        <p className="text-white/40 text-sm mb-6 font-medium">{t('admin.signinSubtitle')}</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 outline-none focus:border-qahwa-accent font-num"
                 type="email" placeholder="admin@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 outline-none focus:border-qahwa-accent font-num"
                 type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-qahwa-red text-sm font-bold">{error}</p>}
          <button className="q-btn-accent w-full inline-flex items-center justify-center gap-2" disabled={loading}>
            {loading && <Spinner size={16} />}
            {loading ? t('common.processing') : t('admin.signin')}
          </button>
        </form>
      </div>
    </main>
  );
}
