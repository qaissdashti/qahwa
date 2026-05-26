// Server-side god-admin gate. Returns the auth user if they are listed
// in admin_users, otherwise null. Use in admin layouts and /api/admin/*.
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';

export async function getAdminUser() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  return data ? user : null;
}
