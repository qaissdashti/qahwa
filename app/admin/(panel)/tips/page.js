import { createAdminClient } from '@/lib/supabase';
import AdminReportClient from '@/components/admin/AdminReportClient';

export const metadata = { title: 'Tips — Admin' };
export const dynamic = 'force-dynamic';

// Drill-down for the Paid tips overview card. Same dataset as /admin/fees but
// shows full per-tip detail (type + message columns) and leads with the count.
export default async function AdminTipsPage() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('tips')
    .select(
      'id, created_at, paid_at, supporter_name, gross_amount_kd, platform_fee_kd, net_amount_kd, fee_pct, payment_method, cups, is_amazing, message, creators(full_name, handle)',
    )
    .eq('status', 'paid')
    .order('paid_at', { ascending: false, nullsFirst: false })
    .limit(10000);

  return <AdminReportClient rows={rows || []} variant="tips" />;
}
