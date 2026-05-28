import { createAdminClient } from '@/lib/supabase';
import VerificationsClient from '@/components/admin/VerificationsClient';

export const metadata = { title: 'Verification — Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminVerifications() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('verifications')
    .select('creator_id, phone_verified, civil_id_masked, selfie_url, status, created_at, creators(full_name, handle, email, phone)')
    .eq('status', 'under_review')
    .order('created_at', { ascending: false })
    .limit(100);
  return <VerificationsClient rows={rows} />;
}
