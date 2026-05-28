import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import DashboardOverviewClient from '@/components/creator/DashboardOverviewClient';

export const dynamic = 'force-dynamic';

export default async function DashboardOverview() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  const admin = createAdminClient();
  const { data: creator } = await admin
    .from('creators')
    .select('full_name, balance_kd, total_earned_kd, total_tips_count')
    .eq('id', user.id)
    .maybeSingle();

  const { data: recentTips } = await admin
    .from('tips')
    .select('supporter_name, cups, is_amazing, gross_amount_kd, net_amount_kd, message, paid_at')
    .eq('creator_id', user.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(8);

  return <DashboardOverviewClient creator={creator} recentTips={recentTips || []} />;
}
