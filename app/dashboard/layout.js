// Creator dashboard chrome + verification gate.
// Middleware already ensured the user is authenticated.
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import DashboardNav from '@/components/creator/DashboardNav';

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

  // not cleared yet → finish onboarding first
  if (!creator || (!creator.is_verified && creator.verification_status !== 'approved')) {
    redirect('/verify');
  }

  return (
    <div className="dash-bg min-h-screen text-white" dir="rtl">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row gap-4 p-4">
        {/* sidebar */}
        <aside className="dash-surface rounded-2xl border border-white/10 p-4 md:w-60 md:min-h-[calc(100vh-2rem)] flex md:flex-col justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 px-2 mb-6">
              <span className="text-xl font-extrabold" style={{ fontFamily: 'Syne' }}>قهوة ☕</span>
            </div>
            <DashboardNav />
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center gap-2 px-2 mb-3">
              <span className="text-2xl">{creator.avatar_emoji || '☕'}</span>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{creator.full_name}</div>
                <div className="text-xs text-white/40 font-num truncate">@{creator.handle}</div>
              </div>
            </div>
            <div className="flex gap-1">
              <Link href={`/${creator.handle}`} target="_blank"
                    className="flex-1 text-center text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 py-2">
                صفحتي ↗
              </Link>
              <form action="/auth/signout" method="post" className="flex-1">
                <button className="w-full text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 py-2">خروج</button>
              </form>
            </div>
          </div>
        </aside>

        {/* content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
