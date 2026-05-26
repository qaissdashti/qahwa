'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const NUM_FIELDS = [
  ['platform_fee_pct',    'نسبة العمولة %'],
  ['min_payout_kd',       'الحد الأدنى للسحب (د.ك)'],
  ['max_coffee_price_kd', 'أقصى سعر للقهوة (د.ك)'],
  ['amazing_min_kd',      'أقل مبلغ حر (د.ك)'],
  ['amazing_max_kd',      'أعلى مبلغ حر (د.ك)'],
];
const TOGGLES = [
  ['new_signups_enabled',      'السماح بالتسجيلات الجديدة'],
  ['manual_approval_required', 'مراجعة يدوية للتحقق'],
  ['payouts_enabled',          'تفعيل السحوبات'],
  ['amazing_enabled_global',   'تفعيل المبلغ الحر (عام)'],
  ['maintenance_mode',         'وضع الصيانة'],
];

export default function PlatformSettingsForm({ settings }) {
  const router = useRouter();
  const [f, setF] = useState({
    platform_fee_pct:    settings.platform_fee_pct ?? 7,
    min_payout_kd:       settings.min_payout_kd ?? 5,
    max_coffee_price_kd: settings.max_coffee_price_kd ?? 10,
    amazing_min_kd:      settings.amazing_min_kd ?? 0.5,
    amazing_max_kd:      settings.amazing_max_kd ?? 50,
    new_signups_enabled:      settings.new_signups_enabled ?? true,
    manual_approval_required: settings.manual_approval_required ?? true,
    payouts_enabled:          settings.payouts_enabled ?? true,
    amazing_enabled_global:   settings.amazing_enabled_global ?? true,
    maintenance_mode:         settings.maintenance_mode ?? false,
    maintenance_message:      settings.maintenance_message || '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const setNum = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setBool = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.checked }));

  async function save(e) {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'صار خطأ');
      setMsg({ type: 'ok', text: 'تم الحفظ ✓' });
      router.refresh();
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
    finally { setLoading(false); }
  }

  const card = 'dash-surface rounded-2xl border border-white/10 p-5 space-y-3';
  const input = 'w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-qahwa-accent font-num';
  const label = 'block text-sm font-bold text-white/70 mb-1';

  return (
    <form onSubmit={save} className="grid gap-4 max-w-2xl">
      <div className={card}>
        <h2 className="text-lg">الرسوم والحدود</h2>
        <div className="grid grid-cols-2 gap-3">
          {NUM_FIELDS.map(([k, lbl]) => (
            <div key={k}>
              <label className={label}>{lbl}</label>
              <input className={input} dir="ltr" type="number" step="0.01" min="0" value={f[k]} onChange={setNum(k)} />
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <h2 className="text-lg">المفاتيح</h2>
        {TOGGLES.map(([k, lbl]) => (
          <label key={k} className="flex items-center justify-between py-1.5 cursor-pointer">
            <span className="font-bold text-sm">{lbl}</span>
            <input type="checkbox" checked={f[k]} onChange={setBool(k)} className="w-5 h-5 accent-qahwa-accent" />
          </label>
        ))}
        {f.maintenance_mode && (
          <div>
            <label className={label}>رسالة الصيانة</label>
            <input className={input.replace('font-num', '')} value={f.maintenance_message}
                   onChange={(e) => setF((p) => ({ ...p, maintenance_message: e.target.value }))}
                   placeholder="نعود قريباً..." />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className="q-btn-accent" disabled={loading}>{loading ? '...' : 'حفظ'}</button>
        {msg && <span className={`font-bold text-sm ${msg.type === 'ok' ? 'text-qahwa-accent' : 'text-qahwa-red'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
