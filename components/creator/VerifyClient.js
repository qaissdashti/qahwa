'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = ['رقم الواتساب', 'الرقم المدني', 'صورة شخصية'];

export default function VerifyClient({ fullName, initialStep, phoneVerified, civilDone }) {
  const router = useRouter();
  const [step, setStep]       = useState(initialStep);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  // step 1 — phone + otp
  const [phone, setPhone]     = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode]       = useState('');

  // step 2 — civil id
  const [civilId, setCivilId] = useState('');

  // step 3 — selfie
  const [selfie, setSelfie]   = useState(null);

  async function post(url, body) {
    const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'صار خطأ');
    return json;
  }

  async function sendOtp() {
    setError(''); setLoading(true);
    try { await post('/api/otp/send', { phone }); setOtpSent(true); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function verifyOtp() {
    setError(''); setLoading(true);
    try { await post('/api/otp/verify', { phone, code }); setStep(2); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function saveCivil() {
    setError(''); setLoading(true);
    try { await post('/api/verify/civil-id', { civilId }); setStep(3); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function submitSelfie() {
    setError('');
    if (!selfie) return setError('اختر صورة');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('selfie', selfie);
      const res  = await fetch('/api/verify/selfie', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'صار خطأ');
      router.refresh(); // page now shows the under-review screen
    } catch (e) { setError(e.message); setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-extrabold mb-1" style={{ fontFamily: 'Syne' }}>
          قهوة <span className="text-qahwa-accent">☕</span>
        </h1>
        <p className="text-center text-black/50 font-medium mb-6">
          أهلاً {fullName}، نحتاج نتأكد من هويتك
        </p>

        {/* stepper */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div key={label} className="flex-1 flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full border-2 border-qahwa-black grid place-items-center font-bold
                  ${done ? 'bg-qahwa-accent' : active ? 'bg-qahwa-black text-qahwa-cream' : 'bg-white text-black/40'}`}>
                  {done ? '✓' : n}
                </div>
                <span className={`text-[11px] mt-1 font-bold ${active ? 'text-qahwa-black' : 'text-black/40'}`}>{label}</span>
              </div>
            );
          })}
        </div>

        <div className="q-card p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl">رقم الواتساب</h2>
              <p className="text-sm text-black/55 font-medium">بنرسل لك رمز تحقق على هذا الرقم. هذا الرقم بيستقبل إشعارات القهوة.</p>
              <div>
                <label className="q-label">رقم الجوال</label>
                <input className="q-input font-num" dir="ltr" value={phone} disabled={otpSent}
                       onChange={(e) => setPhone(e.target.value)} placeholder="+96550001234" />
              </div>
              {otpSent && (
                <div>
                  <label className="q-label">رمز التحقق</label>
                  <input className="q-input font-num tracking-[0.4em] text-center" dir="ltr" value={code}
                         onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                         placeholder="••••••" inputMode="numeric" />
                </div>
              )}
              {error && <p className="q-error">{error}</p>}
              {!otpSent
                ? <button className="q-btn-accent w-full" onClick={sendOtp} disabled={loading || phone.length < 8}>{loading ? '...' : 'أرسل الرمز'}</button>
                : <div className="flex gap-2">
                    <button className="q-btn-accent flex-1" onClick={verifyOtp} disabled={loading || code.length < 4}>{loading ? '...' : 'تأكيد'}</button>
                    <button className="q-btn-white" onClick={() => { setOtpSent(false); setCode(''); }} disabled={loading}>تغيير الرقم</button>
                  </div>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl">الرقم المدني</h2>
              <p className="text-sm text-black/55 font-medium">نخزّنه مشفّراً ولا يظهر لأحد. مطلوب للتحقق والتحويلات.</p>
              <div>
                <label className="q-label">الرقم المدني (12 رقم)</label>
                <input className="q-input font-num tracking-widest" dir="ltr" value={civilId}
                       onChange={(e) => setCivilId(e.target.value.replace(/\D/g, '').slice(0, 12))}
                       placeholder="290000000000" inputMode="numeric" />
              </div>
              {error && <p className="q-error">{error}</p>}
              <button className="q-btn-accent w-full" onClick={saveCivil} disabled={loading || civilId.length !== 12}>{loading ? '...' : 'حفظ ومتابعة'}</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl">صورة شخصية</h2>
              <p className="text-sm text-black/55 font-medium">ارفع صورة سيلفي واضحة لوجهك للتحقق من الهوية.</p>
              <label className="block border-2 border-dashed border-qahwa-black rounded-xl p-6 text-center cursor-pointer hover:bg-black/5">
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                       onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
                <div className="text-4xl mb-1">{selfie ? '✅' : '📸'}</div>
                <span className="text-sm font-bold">{selfie ? selfie.name : 'اضغط لاختيار صورة'}</span>
              </label>
              {error && <p className="q-error">{error}</p>}
              <button className="q-btn-accent w-full" onClick={submitSelfie} disabled={loading || !selfie}>{loading ? '...' : 'إرسال للمراجعة'}</button>
            </div>
          )}
        </div>

        <form action="/auth/signout" method="post" className="text-center mt-5">
          <button className="text-sm font-bold text-black/40 underline">تسجيل الخروج</button>
        </form>
      </div>
    </main>
  );
}
