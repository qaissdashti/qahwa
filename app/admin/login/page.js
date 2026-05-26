'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function AdminLogin() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) throw signErr;
      // the /admin layout enforces admin_users membership
      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError('بيانات الدخول غير صحيحة');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen dash-bg text-white flex items-center justify-center px-5" dir="rtl">
      <div className="w-full max-w-sm dash-surface border border-white/10 rounded-2xl p-7">
        <h1 className="text-2xl mb-1">لوحة الإدارة</h1>
        <p className="text-white/40 text-sm mb-6 font-medium">دخول المشرفين فقط</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 outline-none focus:border-qahwa-accent font-num"
                 dir="ltr" type="email" placeholder="admin@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 outline-none focus:border-qahwa-accent font-num"
                 dir="ltr" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-qahwa-red text-sm font-bold">{error}</p>}
          <button className="q-btn-accent w-full" disabled={loading}>{loading ? '...' : 'دخول'}</button>
        </form>
      </div>
    </main>
  );
}
