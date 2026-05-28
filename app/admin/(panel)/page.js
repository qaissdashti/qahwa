import { createAdminClient } from '@/lib/supabase';
import AdminOverviewClient from '@/components/admin/AdminOverviewClient';

export const dynamic = 'force-dynamic';

async function count(admin, table, filters = (q) => q) {
  const { count } = await filters(
    admin.from(table).select('*', { count: 'exact', head: true })
  );
  return count || 0;
}

export default async function AdminOverview() {
  const admin = createAdminClient();

  const [creators, verified, pendingVer, pendingPayouts, paidTips] = await Promise.all([
    count(admin, 'creators'),
    count(admin, 'creators', (q) => q.eq('is_verified', true)),
    count(admin, 'creators', (q) => q.eq('verification_status', 'under_review')),
    count(admin, 'payouts',  (q) => q.eq('status', 'pending')),
    count(admin, 'tips',     (q) => q.eq('status', 'paid')),
  ]);

  const { data: paid } = await admin
    .from('tips').select('gross_amount_kd, platform_fee_kd').eq('status', 'paid').limit(10000);
  const volume  = (paid || []).reduce((s, t) => s + Number(t.gross_amount_kd || 0), 0);
  const revenue = (paid || []).reduce((s, t) => s + Number(t.platform_fee_kd || 0), 0);

  const { data: bals } = await admin.from('creators').select('balance_kd').limit(10000);
  const owed = (bals || []).reduce((s, c) => s + Number(c.balance_kd || 0), 0);

  return (
    <AdminOverviewClient
      creators={creators} verified={verified}
      pendingVer={pendingVer} pendingPayouts={pendingPayouts}
      paidTips={paidTips} volume={volume} revenue={revenue} owed={owed}
    />
  );
}
