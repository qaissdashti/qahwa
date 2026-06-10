'use client';

import Link from 'next/link';
import DashboardNav from '@/components/creator/DashboardNav';
import LangToggle from '@/components/LangToggle';
import { useLang } from '@/components/LangProvider';
import Logo from '@/components/Logo';

export default function DashboardSidebar({ creator }) {
  const { t } = useLang();
  return (
    <aside className="hidden md:flex dash-surface rounded-2xl border border-white/10 p-4 md:w-60 md:min-h-[calc(100vh-2rem)] flex-col justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2 px-2 mb-6">
          <span className="inline-flex items-center gap-2 text-xl font-extrabold" style={{ fontFamily: 'var(--font-sans)' }}>
            <Logo size={28} />
            <span>قهوة</span>
          </span>
          <LangToggle variant="dark" />
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
            {t('nav.myPage')}
          </Link>
          <form action="/auth/signout" method="post" className="flex-1">
            <button className="w-full text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 py-2">
              {t('common.signout')}
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
