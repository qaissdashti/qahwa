'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export default function SignupPage() {
  const supabase = createClient();

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

    if (!fullName.trim())               return setError('اكتب اسمك الكامل');
    if (cleanHandle.length < 3)         return setError('المعرّف لازم يكون 3 أحرف أو أكثر');
    if (password.length < 8)            return setError('كلمة السر لازم تكون 8 أحرف على الأقل');

    setLoading(true);
    try {
      // 1. handle must be free
      const res  = await fetch(`/api/creator/handle-available?handle=${cleanHandle}`);
      const json = await res.json();
      if (!json.available) {
        setLoading(false);
        return setError('هذا المعرّف محجوز، جرّب غيره');
      }

      // 2. create the auth user — the DB trigger creates the creators row
      const { data, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { is_creator: 'true', full_name: fullName.trim(), handle: cleanHandle },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/verify`,
        },
      });

      if (signErr) throw signErr;

      // 3. session present (email confirmation disabled) → ensure the
      //    creators row exists BEFORE onboarding/OTP, then continue.
      if (data.session) {
        // Wait for the session cookie before calling the (auth-gated) init
        // route and navigating — otherwise both can race the cookie write.
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
          throw new Error(j.error || 'تعذّر تجهيز الحساب');
        }
        // hard navigation so /verify sees the session cookie immediately
        window.location.href = '/verify';
      } else {
        setEmailSent(true);   // confirmation required
      }
    } catch (err) {
      setError(err.message || 'صار خطأ، حاول مرة ثانية');
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <AuthShell>
        <div className="text-5xl mb-4 text-center">📩</div>
        <h1 className="text-2xl mb-2 text-center">تحقق من بريدك</h1>
        <p className="text-center text-black/60 font-medium">
          أرسلنا رابط تأكيد إلى <b dir="ltr">{email}</b>. افتح الرابط لتفعيل حسابك ومتابعة التسجيل.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-3xl mb-1 text-center">أنشئ صفحتك ☕</h1>
      <p className="text-center text-black/50 font-medium mb-6">دقيقة وحدة وتبدأ تستقبل قهوة</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="q-label">الاسم الكامل</label>
          <input className="q-input" value={fullName} onChange={(e) => setFullName(e.target.value)}
                 placeholder="نورة العتيبي" autoComplete="name" />
        </div>

        <div>
          <label className="q-label">المعرّف (رابط صفحتك)</label>
          <div className="flex items-center gap-2" dir="ltr">
            <span className="text-sm text-black/50 font-num whitespace-nowrap">qahwa.kw/</span>
            <input className="q-input font-num" value={cleanHandle}
                   onChange={(e) => setHandle(e.target.value)}
                   placeholder="noura" autoCapitalize="none" />
          </div>
        </div>

        <div>
          <label className="q-label">البريد الإلكتروني</label>
          <input className="q-input font-num" type="email" value={email} dir="ltr"
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
                 autoComplete="email" />
        </div>

        <div>
          <label className="q-label">كلمة السر</label>
          <input className="q-input font-num" type="password" value={password} dir="ltr"
                 onChange={(e) => setPassword(e.target.value)} placeholder="8 أحرف على الأقل"
                 autoComplete="new-password" />
        </div>

        {error && <p className="q-error">{error}</p>}

        <button className="q-btn-accent w-full text-lg py-4" disabled={loading}>
          {loading ? '...' : 'إنشاء الحساب'}
        </button>
      </form>

      <p className="text-center text-sm text-black/60 mt-5 font-medium">
        عندك حساب؟ <Link href="/login" className="font-bold underline">سجّل دخول</Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({ children }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-2xl font-extrabold mb-6"
              style={{ fontFamily: 'Syne' }}>
          قهوة <span className="text-qahwa-accent">☕</span>
        </Link>
        <div className="q-card p-7">{children}</div>
      </div>
    </main>
  );
}
