import { createAdminClient } from '@/lib/supabase';
import VerificationsClient from '@/components/admin/VerificationsClient';

export const metadata = { title: 'Verification — Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminVerifications() {
  const admin = createAdminClient();
  // Only surface creators who have accepted the Terms & Conditions.
  // The verification row is created at Step 4 (selfie), but T&C
  // acceptance happens at Step 5 — so a row can exist before terms are
  // accepted. `creators!inner` + the not-null filter drops those rows
  // from the queue entirely. We still select terms_accepted_at so the
  // card can render a defensive warning if the filter is ever loosened.
  const { data: rows } = await admin
    .from('verifications')
    .select('creator_id, phone_verified, civil_id_masked, selfie_url, status, created_at, creators!inner(full_name, handle, email, phone, terms_accepted_at)')
    .eq('status', 'under_review')
    .not('creators.terms_accepted_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);
  return <VerificationsClient rows={rows} />;
}
