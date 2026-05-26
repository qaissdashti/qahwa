'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PayoutForm({ balance, minPayout, payoutsEnabled, hasPending }) {
  const router = useRouter();
  const [amount, setAmount]   = useState('');
  const [holder, setHolder]   = useState('');
  const [bank, setBank]       = useState('');
  const [iban, setIban]       = useState('');
  const [method, setMethod]   = useState('bank_transfer');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const disabled = !payoutsEnabled || hasPending || balance < minPayout;

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/creator/payout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, account_holder: holder, bank_name: bank, iban, method }),
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

  return (
    <form onSubmit={submit} className="q-card p-5 text-qahwa-black space-y-3">
      <h2 className="text-lg">طلب سحب</h2>

      {!payoutsEnabled && <p className="q-error">السحوبات معطّلة حالياً من الإدارة</p>}
      {payoutsEnabled && hasPending && <p className="q-error">لديك طلب قيد المراجعة</p>}
      {payoutsEnabled && !hasPending && balance < minPayout &&
        <p className="q-error">الحد الأدنى للسحب {minPayout} د.ك</p>}

      <div>
        <label className="q-label">المبلغ (د.ك)</label>
        <input className="q-input font-num" dir="ltr" inputMode="decimal" value={amount}
               onChange={(e) => setAmount(e.target.value)} placeholder={`${minPayout}.000`} disabled={disabled} />
      </div>
      <div>
        <label className="q-label">اسم صاحب الحساب</label>
        <input className="q-input" value={holder} onChange={(e) => setHolder(e.target.value)} disabled={disabled} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="q-label">البنك</label>
          <input className="q-input" value={bank} onChange={(e) => setBank(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label className="q-label">الطريقة</label>
          <select className="q-input" value={method} onChange={(e) => setMethod(e.target.value)} disabled={disabled}>
            <option value="bank_transfer">تحويل بنكي</option>
            <option value="knet_send">كي نت</option>
          </select>
        </div>
      </div>
      <div>
        <label className="q-label">آيبان (IBAN)</label>
        <input className="q-input font-num" dir="ltr" value={iban}
               onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="KW00XXXX..." disabled={disabled} />
      </div>

      {error && <p className="q-error">{error}</p>}
      <button className="q-btn-black w-full" disabled={disabled || loading}>
        {loading ? '...' : 'إرسال الطلب'}
      </button>
    </form>
  );
}
