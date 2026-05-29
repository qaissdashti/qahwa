// God-admin panel chrome + gate. Route group (panel) so /admin/login
// (which lives outside this group) is never gated by it.
import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminMobileChrome from '@/components/admin/AdminMobileChrome';

export const metadata = { title: 'Admin — Qahwa' };

export default async function AdminPanelLayout({ children }) {
  const admin = await getAdminUser();
  if (!admin) redirect('/admin/login');

  return (
    <div className="dash-bg min-h-screen text-white">
      <AdminMobileChrome admin={admin} />
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row gap-4 p-3 sm:p-4">
        <AdminSidebar admin={admin} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
