import { createAdminClient } from '@/lib/supabase';
import AdminPayoutRow from '@/components/admin/AdminPayoutRow';

export const metadata = { title: 'السحوبات — الإدارة' };

export default async function AdminPayouts() {
  const admin = createAdminClient();
  const { data: payouts } = await admin
    .from('payouts')
    .select('id, created_at, amount_kd, bank_name, account_holder, iban, method, status, paid_at, creators(full_name, handle)')
    .order('created_at', { ascending: false })
    .limit(200);

  const pending = (payouts || []).filter((p) => p.status === 'pending');
  const rest    = (payouts || []).filter((p) => p.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl mb-3">سحوبات بانتظار الموافقة ({pending.length})</h1>
        {pending.length === 0 ? (
          <div className="dash-surface rounded-2xl border border-white/10 text-center py-12 text-white/40 font-medium">
            لا توجد طلبات معلّقة
          </div>
        ) : (
          <div className="grid gap-3">{pending.map((p) => <AdminPayoutRow key={p.id} payout={p} />)}</div>
        )}
      </div>

      {rest.length > 0 && (
        <div>
          <h2 className="text-lg mb-3 text-white/60">السجل</h2>
          <div className="grid gap-3">{rest.map((p) => <AdminPayoutRow key={p.id} payout={p} />)}</div>
        </div>
      )}
    </div>
  );
}
