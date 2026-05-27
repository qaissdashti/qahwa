'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

function LoginForm() {
  const params = useSearchParams();
  const next   = params.get('next') || '/dashboard';
  const supabase = createClient();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) {
      setError(/invalid login credentials/i.test(signErr.message || '')
        ? 'البريد أو كلمة السر غير صحيحة'
        : (signErr.message || 'صار خطأ، حاول مرة ثانية'));
      setLoading(false);
      return;
    }
    if (!data?.session) {
      setError('تعذّر إنشاء الجلسة، حاول مرة ثانية');
      setLoading(false);
      return;
    }

    // Wait for the session cookie to be written, then hard-navigate so the
    // server sees it (avoids the cookie-write race that bounces back to login).
    for (let i = 0; i < 20; i++) {
      if (document.cookie.includes('auth-token')) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    window.location.href = next;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-2xl font-extrabold mb-6"
              style={{ fontFamily: 'Syne' }}>
          قهوة <span className="text-qahwa-accent">☕</span>
        </Link>
        <div className="q-card p-7">
          <h1 className="text-3xl mb-6 text-center">تسجيل الدخول</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="q-label">البريد الإلكتروني</label>
              <input className="q-input font-num" type="email" value={email} dir="ltr"
                     onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
                     autoComplete="email" />
            </div>
            <div>
              <label className="q-label">كلمة السر</label>
              <input className="q-input font-num" type="password" value={password} dir="ltr"
                     onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                     autoComplete="current-password" />
            </div>
            {error && <p className="q-error">{error}</p>}
            <button className="q-btn-accent w-full text-lg py-4" disabled={loading}>
              {loading ? '...' : 'دخول'}
            </button>
          </form>
          <p className="text-center text-sm text-black/60 mt-5 font-medium">
            ما عندك حساب؟ <Link href="/signup" className="font-bold underline">أنشئ صفحتك</Link>
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
