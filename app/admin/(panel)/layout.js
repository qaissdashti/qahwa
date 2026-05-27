// God-admin panel chrome + gate. Route group (panel) so /admin/login
// (which lives outside this group) is never gated by it. English / LTR.
import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import AdminNav from '@/components/admin/AdminNav';

export const metadata = { title: 'Admin — Qahwa' };

export default async function AdminPanelLayout({ children }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');

  return (
    <div className="dash-bg min-h-screen text-white" dir="ltr">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row gap-4 p-4">
        <aside className="dash-surface rounded-2xl border border-white/10 p-4 md:w-60 md:min-h-[calc(100vh-2rem)] flex md:flex-col justify-between gap-4">
          <div className="flex-1">
            <div className="px-2 mb-6">
              <span className="text-xl font-extrabold" style={{ fontFamily: 'Syne' }}>Qahwa</span>
              <span className="block text-xs text-qahwa-accent font-bold">Admin Panel</span>
            </div>
            <AdminNav />
          </div>
          <div className="border-t border-white/10 pt-3">
            <div className="text-xs text-white/40 font-num truncate px-2 mb-2">{admin.email}</div>
            <form action="/auth/signout" method="post">
              <button className="w-full text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 py-2">Sign out</button>
            </form>
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
