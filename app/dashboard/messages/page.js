import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';

export const metadata = { title: 'الرسائل — قهوة' };
const kd = (n) => Number(n || 0).toFixed(3);

export default async function MessagesPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  const admin = createAdminClient();
  const { data: tips } = await admin
    .from('tips')
    .select('id, paid_at, supporter_name, supporter_phone, cups, is_amazing, gross_amount_kd, message, reply_sent_at, reply_type, reply_content')
    .eq('creator_id', user.id)
    .eq('status', 'paid')
    .not('message', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl">رسائل الداعمين</h1>

      {(!tips || tips.length === 0) ? (
        <div className="dash-surface rounded-2xl border border-white/10 text-center py-16 text-white/40">
          <div className="text-4xl mb-2">💬</div>
          <p className="font-medium">لا توجد رسائل بعد</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tips.map((t) => {
            // wa.me wants the number without +/spaces
            const wa = t.supporter_phone ? t.supporter_phone.replace(/[^\d]/g, '') : null;
            return (
              <div key={t.id} className="dash-surface rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-bold">
                    {t.supporter_name || 'داعم'}{' '}
                    <span className="text-white/40 font-medium text-sm">
                      · {t.is_amazing ? 'مبلغ حر' : `${t.cups} قهوة`} · {kd(t.gross_amount_kd)} د.ك
                    </span>
                  </div>
                  <span className="text-xs text-white/30 font-num whitespace-nowrap">
                    {t.paid_at ? new Date(t.paid_at).toLocaleDateString('ar-KW') : ''}
                  </span>
                </div>

                <p className="text-white/85 bg-white/5 rounded-xl p-3 mb-3">"{t.message}"</p>

                {t.reply_sent_at ? (
                  <div className="text-sm text-qahwa-accent font-bold">
                    ✓ تم الرد {t.reply_type === 'voice_note' ? '(رسالة صوتية)' : ''}
                    {t.reply_content && <span className="text-white/50 font-medium"> — "{t.reply_content}"</span>}
                  </div>
                ) : wa ? (
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-2 text-sm font-bold rounded-xl bg-qahwa-wa text-white px-4 py-2">
                    💬 رد عبر واتساب
                  </a>
                ) : (
                  <span className="text-sm text-white/30 font-medium">الداعم لم يترك رقماً</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
