// Records the timestamp at which the authenticated creator accepted
// the Terms & Conditions. Idempotent — re-posting overwrites with the
// latest now() (creator re-accepting after a ToS update is the same
// shape). Fired from /onboard Step 5 when the user checks the mandatory
// acceptance box and clicks the "View page" button.
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { dbErr } from '@/lib/apiError';

export async function POST() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('creators')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return dbErr('تعذّر تسجيل الموافقة', error, 500, '[creator/accept-terms]');
  return Response.json({ success: true });
}
