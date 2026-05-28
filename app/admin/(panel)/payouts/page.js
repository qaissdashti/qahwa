import { createAdminClient } from '@/lib/supabase';
import AdminPayoutsClient from '@/components/admin/AdminPayoutsClient';

export const metadata = { title: 'Payouts — Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPayouts() {
  const admin = createAdminClient();
  const { data: payouts } = await admin
    .from('payouts')
    .select('id, created_at, amount_kd, bank_name, account_holder, iban, method, status, paid_at, creators(full_name, handle)')
    .order('created_at', { ascending: false })
    .limit(200);
  return <AdminPayoutsClient payouts={payouts || []} />;
}
