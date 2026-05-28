import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import PayoutsPageClient from '@/components/creator/PayoutsPageClient';

export const metadata = { title: 'السحوبات — قهوة' };
export const dynamic = 'force-dynamic';

export default async function PayoutsPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  const admin = createAdminClient();
  const [{ data: creator }, { data: settings }, { data: payouts }] = await Promise.all([
    admin.from('creators')
      .select('balance_kd, bank_name, account_holder, iban_masked')
      .eq('id', user.id).maybeSingle(),
    admin.from('platform_settings').select('min_payout_kd, payouts_enabled').eq('id', 1).maybeSingle(),
    admin.from('payouts').select('created_at, amount_kd, method, status, paid_at')
      .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(50),
  ]);

  const balance    = Number(creator?.balance_kd ?? 0);
  const hasPending = (payouts || []).some((p) => p.status === 'pending');
  const hasBank    = !!(creator?.iban_masked && creator?.account_holder);

  return (
    <PayoutsPageClient
      balance={balance}
      minPayout={Number(settings?.min_payout_kd ?? 5)}
      payoutsEnabled={!!settings?.payouts_enabled}
      hasPending={hasPending}
      hasBank={hasBank}
      bankName={creator?.bank_name}
      accountHolder={creator?.account_holder}
      ibanMasked={creator?.iban_masked}
      payouts={payouts || []}
    />
  );
}
