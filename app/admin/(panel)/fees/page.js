import { createAdminClient } from '@/lib/supabase';
import AdminReportClient from '@/components/admin/AdminReportClient';

export const metadata = { title: 'Fees — Admin' };
export const dynamic = 'force-dynamic';

// Drill-down for the Platform fees / Volume overview cards. Lists every paid
// tip with its fee split. ?metric=volume just changes which total the page
// leads with (linked from the Volume card); the data + exports are identical.
export default async function AdminFeesPage({ searchParams }) {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('tips')
    .select(
      'id, created_at, paid_at, supporter_name, gross_amount_kd, platform_fee_kd, net_amount_kd, fee_pct, payment_method, cups, is_amazing, message, creators(full_name, handle)',
    )
    .eq('status', 'paid')
    .order('paid_at', { ascending: false, nullsFirst: false })
    .limit(10000);

  const metric = searchParams?.metric === 'volume' ? 'volume' : 'fees';

  return <AdminReportClient rows={rows || []} variant="fees" metric={metric} />;
}
