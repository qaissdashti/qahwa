'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function AdminLogin() {
  const supabase = createClient();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);

    const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password });

    // Wrong password / unknown user → show a clear, specific message so it's
    // obvious this is a credential problem, not a navigation bug.
    if (signErr) {
      setError(/invalid login credentials/i.test(signErr.message || '')
        ? 'Wrong email or password'
        : (signErr.message || 'Sign-in failed'));
      setLoading(false);
      return;
    }
    if (!data?.session) {
      setError('Could not establish a session — please try again.');
      setLoading(false);
      return;
    }

    // Sign-in succeeded. Wait until the session cookie is actually written
    // (up to ~1s) before the hard redirect, so the server sees it on /admin
    // instead of bouncing back to login (the cookie-write race).
    for (let i = 0; i < 20; i++) {
      if (document.cookie.includes('auth-token')) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    window.location.href = '/admin';
  }

  return (
    <main className="min-h-screen dash-bg text-white flex items-center justify-center px-5" dir="ltr">
      <div className="w-full max-w-sm dash-surface border border-white/10 rounded-2xl p-7">
        <h1 className="text-2xl mb-1">Admin Panel</h1>
        <p className="text-white/40 text-sm mb-6 font-medium">Admins only</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 outline-none focus:border-qahwa-accent font-num"
                 type="email" placeholder="admin@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 outline-none focus:border-qahwa-accent font-num"
                 type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-qahwa-red text-sm font-bold">{error}</p>}
          <button className="q-btn-accent w-full" disabled={loading}>{loading ? '...' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  );
}
