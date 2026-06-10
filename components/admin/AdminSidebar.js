'use client';

import AdminNav from '@/components/admin/AdminNav';
import LangToggle from '@/components/LangToggle';
import { useLang } from '@/components/LangProvider';

export default function AdminSidebar({ admin }) {
  const { t } = useLang();
  return (
    <aside className="hidden md:flex dash-surface rounded-2xl border border-white/10 p-4 md:w-60 md:min-h-[calc(100vh-2rem)] flex-col justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2 px-2 mb-6">
          <div>
            <span className="text-xl font-extrabold block" style={{ fontFamily: 'var(--font-sans)' }}>{t('admin.brand')}</span>
            <span className="block text-xs text-qahwa-accent font-bold">{t('admin.label')}</span>
          </div>
          <LangToggle variant="dark" />
        </div>
        <AdminNav />
      </div>
      <div className="border-t border-white/10 pt-3">
        <div className="text-xs text-white/40 font-num truncate px-2 mb-2">{admin.email}</div>
        <form action="/auth/signout" method="post">
          <button className="w-full text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 py-2">
            {t('common.signout')}
          </button>
        </form>
      </div>
    </aside>
  );
}
