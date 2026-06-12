// Records the timestamp at which the authenticated creator accepted
// the Terms & Conditions. Idempotent — re-posting overwrites with the
// latest now() (creator re-accepting after a ToS update is the same
// shape). Fired from /onboard Step 5 when the user checks the mandatory
// acceptance box and clicks the "View page" button.
//
// History: this used to do a bare `update().eq('id', user.id)` with no
// row-count check. A Supabase update that matches ZERO rows returns
// `error: null` — so any silent no-op (service-role key missing in the
// deploy → admin client degrades to anon and RLS filters the row out;
// or the 0004_terms_accepted_at migration not applied) returned
// `{ success: true }` while terms_accepted_at stayed NULL. We now
// `.select()` the affected row and treat zero rows as a hard failure so
// it surfaces in the Vercel logs and the client doesn't redirect
// thinking acceptance was recorded.
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { dbErr } from '@/lib/apiError';

export async function POST() {
  // Diagnostic: the most likely prod cause is a missing service-role
  // key — without it createAdminClient() silently behaves like anon and
  // every own-row update no-ops under RLS. Log it loudly, once, here.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[creator/accept-terms] SUPABASE_SERVICE_ROLE_KEY is not set — admin writes will silently no-op under RLS');
  }

  const auth = createServerSupabaseClient();
  const { data: { user }, error: authErr } = await auth.auth.getUser();
  if (authErr) console.error('[creator/accept-terms] getUser error', authErr);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // .select() so we can see how many rows the update actually touched.
  const { data, error } = await admin
    .from('creators')
    .update({ terms_accepted_at: now })
    .eq('id', user.id)
    .select('id, terms_accepted_at');

  if (error) {
    return dbErr('تعذّر تسجيل الموافقة', error, 500, '[creator/accept-terms]');
  }

  // Zero rows + no error = silent no-op. Convert it into a visible
  // failure: log it (with the user id so it's traceable on Vercel) and
  // return 500 so finishOnboarding shows an error instead of redirecting
  // as if the terms were saved.
  if (!data || data.length === 0) {
    console.error(
      '[creator/accept-terms] update matched 0 rows — terms_accepted_at NOT saved.',
      { userId: user.id, hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY }
    );
    return Response.json(
      {
        error: 'تعذّر تسجيل الموافقة',
        details: 'No creators row matched the authenticated user (update affected 0 rows). Check that SUPABASE_SERVICE_ROLE_KEY is set and the 0004_terms_accepted_at migration is applied.',
      },
      { status: 500 }
    );
  }

  console.log('[creator/accept-terms] saved', { userId: user.id, terms_accepted_at: data[0].terms_accepted_at });
  return Response.json({ success: true });
}
