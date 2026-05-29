// Creator dashboard chrome + verification gate.
// Middleware already ensured the user is authenticated.
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import DashboardSidebar from '@/components/creator/DashboardSidebar';
import DashboardMobileChrome from '@/components/creator/DashboardMobileChrome';

export const metadata = { title: 'لوحة التحكم — قهوة' };

export default async function DashboardLayout({ children }) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

  const admin = createAdminClient();
  const { data: creator } = await admin
    .from('creators')
    .select('full_name, handle, avatar_emoji, verification_status, is_verified')
    .eq('id', user.id)
    .maybeSingle();

  // not cleared yet → resume the onboarding wizard
  if (!creator || (!creator.is_verified && creator.verification_status !== 'approved')) {
    redirect('/onboard');
  }

  return (
    <div className="dash-bg min-h-screen text-white">
      <DashboardMobileChrome creator={creator} />
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row gap-4 p-3 sm:p-4 pb-24 md:pb-4">
        <DashboardSidebar creator={creator} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
