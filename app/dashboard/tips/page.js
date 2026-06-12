import { createServerSupabaseClient } from '@/lib/supabase';
import TipsTableClient from '@/components/creator/TipsTableClient';

export const metadata = { title: 'القهاوي — قهوة' };
export const dynamic = 'force-dynamic';

export default async function TipsPage() {
  // Authenticated client — RLS (tips_select_own / creators_select_own) scopes
  // every row to the logged-in creator, no service-role needed.
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  const [{ data: creator }, { data: tips }] = await Promise.all([
    auth.from('creators').select('full_name, handle').eq('id', user.id).maybeSingle(),
    auth
      .from('tips')
      .select('id, created_at, paid_at, supporter_name, supporter_phone, cups, is_amazing, gross_amount_kd, platform_fee_kd, net_amount_kd, message, payment_method, status')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  return (
    <TipsTableClient
      tips={tips || []}
      creatorName={creator?.full_name || ''}
      handle={creator?.handle || ''}
    />
  );
}
