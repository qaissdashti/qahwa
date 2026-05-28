import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import TipsTableClient from '@/components/creator/TipsTableClient';

export const metadata = { title: 'القهاوي — قهوة' };
export const dynamic = 'force-dynamic';

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

  return <TipsTableClient tips={tips || []} />;
}
