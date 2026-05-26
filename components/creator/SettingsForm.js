'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsForm({ creator, maxPrice, amazingGlobal }) {
  const router = useRouter();
  const [f, setF] = useState({
    full_name:       creator?.full_name || '',
    avatar_emoji:    creator?.avatar_emoji || '☕',
    bio:             creator?.bio || '',
    coffee_price_kd: creator?.coffee_price_kd ?? 1,
    theme_bg:        creator?.theme_bg || '#FAFAF7',
    theme_text:      creator?.theme_text || '#0D0D0D',
    amazing_enabled: creator?.amazing_enabled ?? true,
    amazing_message: creator?.amazing_message || '',
    instagram:       creator?.instagram || '',
    twitter:         creator?.twitter || '',
    youtube:         creator?.youtube || '',
    tiktok:          creator?.tiktok || '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null); // {type, text}

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((p) => ({ ...p, [k]: v }));
  };

  async function save(e) {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      const res = await fetch('/api/creator/settings', {
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
  const input = 'w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-qahwa-accent';
  const label = 'block text-sm font-bold text-white/70 mb-1';

  return (
    <form onSubmit={save} className="grid gap-4 max-w-2xl">
      {/* profile */}
      <div className={card}>
        <h2 className="text-lg">الملف الشخصي</h2>
        <div className="flex gap-3">
          <div className="w-20">
            <label className={label}>الإيموجي</label>
            <input className={`${input} text-center text-2xl`} maxLength={4}
                   value={f.avatar_emoji} onChange={set('avatar_emoji')} />
          </div>
          <div className="flex-1">
            <label className={label}>الاسم</label>
            <input className={input} value={f.full_name} onChange={set('full_name')} />
          </div>
        </div>
        <div>
          <label className={label}>نبذة</label>
          <textarea className={input} rows={2} maxLength={280} value={f.bio} onChange={set('bio')}
                    placeholder="عرّف متابعينك عنك..." />
        </div>
        <div className="text-xs text-white/40 font-num" dir="ltr">qahwa.kw/{creator?.handle}</div>
      </div>

      {/* pricing */}
      <div className={card}>
        <h2 className="text-lg">سعر القهوة</h2>
        <div>
          <label className={label}>سعر القهوة الواحدة (د.ك) — الحد الأقصى {maxPrice}</label>
          <input className={`${input} font-num`} dir="ltr" inputMode="decimal" type="number"
                 step="0.1" min="0.1" max={maxPrice} value={f.coffee_price_kd} onChange={set('coffee_price_kd')} />
        </div>
        {amazingGlobal && (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={f.amazing_enabled} onChange={set('amazing_enabled')} className="w-4 h-4 accent-qahwa-accent" />
              <span className="font-bold text-sm">تفعيل صندوق "المبلغ الحر" (Amazing)</span>
            </label>
            {f.amazing_enabled && (
              <input className={input} value={f.amazing_message} onChange={set('amazing_message')}
                     placeholder="رسالة تشجيعية للمبلغ الحر..." maxLength={200} />
            )}
          </>
        )}
      </div>

      {/* theme */}
      <div className={card}>
        <h2 className="text-lg">ألوان الصفحة</h2>
        <div className="flex gap-4">
          <div>
            <label className={label}>الخلفية</label>
            <input type="color" className="h-11 w-16 rounded-lg bg-transparent cursor-pointer" value={f.theme_bg} onChange={set('theme_bg')} />
          </div>
          <div>
            <label className={label}>النص</label>
            <input type="color" className="h-11 w-16 rounded-lg bg-transparent cursor-pointer" value={f.theme_text} onChange={set('theme_text')} />
          </div>
          <div className="flex-1">
            <label className={label}>معاينة</label>
            <div className="h-11 rounded-lg grid place-items-center font-bold border border-white/15"
                 style={{ background: f.theme_bg, color: f.theme_text }}>
              {f.avatar_emoji} {f.full_name || 'صفحتك'}
            </div>
          </div>
        </div>
      </div>

      {/* socials */}
      <div className={card}>
        <h2 className="text-lg">روابط التواصل</h2>
        <div className="grid grid-cols-2 gap-2">
          {['instagram', 'twitter', 'youtube', 'tiktok'].map((s) => (
            <input key={s} className={`${input} font-num`} dir="ltr" placeholder={s}
                   value={f[s]} onChange={set(s)} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="q-btn-accent" disabled={loading}>{loading ? '...' : 'حفظ التغييرات'}</button>
        {msg && <span className={`font-bold text-sm ${msg.type === 'ok' ? 'text-qahwa-accent' : 'text-qahwa-red'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
