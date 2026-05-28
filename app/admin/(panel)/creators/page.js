import { createAdminClient } from '@/lib/supabase';
import CreatorsTableClient from '@/components/admin/CreatorsTableClient';

export const metadata = { title: 'Creators — Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminCreators() {
  const admin = createAdminClient();
  const { data: creators } = await admin
    .from('creators')
    .select('id, full_name, handle, email, balance_kd, total_earned_kd, verification_status, is_verified, is_disabled, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  return <CreatorsTableClient creators={creators} />;
}
