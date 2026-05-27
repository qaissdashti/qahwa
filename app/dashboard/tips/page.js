import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';

export const metadata = { title: 'القهاوي — قهوة' };
export const dynamic = 'force-dynamic';
const kd = (n) => Number(n || 0).toFixed(3);

const STATUS = {
  paid:     ['مدفوعة', 'text-qahwa-accent'],
  pending:  ['معلّقة',  'text-yellow-400'],
  failed:   ['فشلت',    'text-qahwa-red'],
  refunded: ['مستردة',  'text-white/40'],
};

export default async function TipsPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  const admin = createAdminClient();
  const { data: tips } = await admin
    .from('tips')
    .select('created_at, paid_at, supporter_name, cups, is_amazing, gross_amount_kd, net_amount_kd, message, payment_method, status')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl">كل القهاوي</h1>

      <div className="dash-surface rounded-2xl border border-white/10 overflow-hidden">
        {(!tips || tips.length === 0) ? (
          <div className="text-center py-16 text-white/40">
            <div className="text-4xl mb-2">☕</div>
            <p className="font-medium">لا توجد معاملات بعد</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-white/40 text-right">
              <tr className="border-b border-white/10">
                <th className="font-bold px-4 py-3">الداعم</th>
                <th className="font-bold px-4 py-3">النوع</th>
                <th className="font-bold px-4 py-3">المبلغ</th>
                <th className="font-bold px-4 py-3">الصافي</th>
                <th className="font-bold px-4 py-3">الحالة</th>
                <th className="font-bold px-4 py-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {tips.map((t, i) => {
                const [label, cls] = STATUS[t.status] || [t.status, 'text-white/40'];
                return (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-bold">{t.supporter_name || 'داعم'}</div>
                      {t.message && <div className="text-white/50 text-xs line-clamp-1 max-w-[200px]">"{t.message}"</div>}
                    </td>
                    <td className="px-4 py-3 text-white/70">{t.is_amazing ? 'مبلغ حر' : `${t.cups} قهوة`}</td>
                    <td className="px-4 py-3 font-num">{kd(t.gross_amount_kd)}</td>
                    <td className="px-4 py-3 font-num text-qahwa-accent">{kd(t.net_amount_kd)}</td>
                    <td className={`px-4 py-3 font-bold ${cls}`}>{label}</td>
                    <td className="px-4 py-3 font-num text-white/40 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString('ar-KW')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
