'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PayoutForm({
  balance, minPayout, payoutsEnabled, hasPending,
  hasBank, bankName, accountHolder, ibanMasked,
}) {
  const router = useRouter();
  const [amount, setAmount]   = useState('');
  const [method, setMethod]   = useState('bank_transfer');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const disabled = !payoutsEnabled || hasPending || balance < minPayout || !hasBank;

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/creator/payout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'صار خطأ');
      setDone(true);
      router.refresh();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="q-card p-5 text-qahwa-black">
        <div className="text-3xl mb-2">✅</div>
        <h2 className="text-lg mb-1">تم إرسال طلب السحب</h2>
        <p className="text-sm text-black/60 font-medium">بنراجعه ونحوّل لك خلال ٢-٣ أيام عمل.</p>
      </div>
    );
  }

  // If the creator hasn't saved bank details yet, prompt them to go to settings
  // instead of showing the request form — they should enter bank details once.
  if (!hasBank) {
    return (
      <div className="q-card p-5 text-qahwa-black space-y-3">
        <h2 className="text-lg">طلب سحب</h2>
        <p className="text-sm text-black/70 font-medium">
          أضف تفاصيل حسابك البنكي مرة واحدة في الإعدادات قبل أول طلب سحب.
        </p>
        <Link href="/dashboard/settings" className="q-btn-black inline-flex text-sm">
          ⚙️ اذهب للإعدادات لإضافة البنك
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="q-card p-5 text-qahwa-black space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg">طلب سحب</h2>
        {!payoutsEnabled && <p className="q-error">السحوبات معطّلة حالياً</p>}
        {payoutsEnabled && hasPending && <p className="q-error">لديك طلب قيد المراجعة</p>}
      </div>

      {/* Saved bank details — read-only summary with edit link */}
      <div className="bg-black/5 border-2 border-qahwa-black/20 rounded-xl p-3 text-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-black/70">الحساب المحفوظ</span>
          <Link href="/dashboard/settings" className="text-xs font-bold underline text-qahwa-purple">تعديل</Link>
        </div>
        <div className="font-bold">{accountHolder}</div>
        <div className="text-xs text-black/60">{bankName || '—'}</div>
        <div className="text-xs text-black/60 font-num" dir="ltr">{ibanMasked}</div>
      </div>

      <div>
        <label className="q-label">المبلغ (د.ك)</label>
        <input className="q-input font-num" dir="ltr" inputMode="decimal" value={amount}
               onChange={(e) => setAmount(e.target.value)} placeholder={`${minPayout}.000`} disabled={disabled} />
      </div>
      <div>
        <label className="q-label">طريقة التحويل</label>
        <select className="q-input" value={method} onChange={(e) => setMethod(e.target.value)} disabled={disabled}>
          <option value="bank_transfer">تحويل بنكي</option>
          <option value="knet_send">كي نت</option>
        </select>
      </div>

      {payoutsEnabled && !hasPending && balance < minPayout &&
        <p className="q-error">الحد الأدنى للسحب {minPayout} د.ك</p>}
      {error && <p className="q-error">{error}</p>}

      <button className="q-btn-black w-full" disabled={disabled || loading}>
        {loading ? '...' : 'إرسال الطلب'}
      </button>
    </form>
  );
}
