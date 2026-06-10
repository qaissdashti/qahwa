'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LangToggle from '@/components/LangToggle';
import { useLang } from '@/components/LangProvider';

const LINKS = [
  ['/admin',               'admin.nav.overview',     '📊'],
  ['/admin/creators',      'admin.nav.creators',     '👥'],
  ['/admin/tips',          'admin.nav.tips',         '☕'],
  ['/admin/fees',          'admin.nav.fees',         '🧾'],
  ['/admin/verifications', 'admin.nav.verification', '🪪'],
  ['/admin/payouts',       'admin.nav.payouts',      '💸'],
  ['/admin/settings',      'admin.nav.settings',     '⚙️'],
];

export default function AdminMobileChrome({ admin }) {
  const pathname = usePathname();
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Top bar with hamburger */}
      <header className="md:hidden flex items-center justify-between gap-3 dash-surface border-b border-white/10 px-4 py-3 sticky top-0 z-40 safe-pt">
        <button onClick={() => setOpen(true)} aria-label="Open menu"
          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] -ms-2 rounded-lg hover:bg-white/5 text-2xl">
          ☰
        </button>
        <div className="text-sm font-extrabold text-center min-w-0 truncate" style={{ fontFamily: 'var(--font-sans)' }}>
          {t('admin.brand')} <span className="text-qahwa-accent">·</span>{' '}
          <span className="text-qahwa-accent text-xs">{t('admin.label')}</span>
        </div>
        <LangToggle variant="dark" />
      </header>

      {/* Slide-in drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* backdrop */}
          <button aria-label="Close menu" onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 cursor-default" />
          {/* drawer */}
          <aside className="absolute top-0 inset-inline-start-0 h-full w-72 max-w-[85vw] dash-surface p-4 flex flex-col gap-2 shadow-2xl safe-pt safe-pb">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-sans)' }}>{t('admin.brand')}</div>
                <div className="text-xs text-qahwa-accent font-bold">{t('admin.label')}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close menu"
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/5 text-xl">
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {LINKS.map(([href, key, icon]) => {
                const active = pathname === href;
                return (
                  <Link key={href} href={href} prefetch={false} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold min-h-[44px]
                      ${active ? 'bg-qahwa-accent text-qahwa-black' : 'text-white/70 hover:bg-white/5'}`}>
                    <span className="text-lg">{icon}</span>
                    <span>{t(key)}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-white/10 pt-3">
              <div className="text-xs text-white/40 font-num truncate mb-2">{admin.email}</div>
              <form action="/auth/signout" method="post">
                <button className="w-full text-sm font-bold rounded-lg bg-white/5 hover:bg-white/10 py-3 min-h-[44px]">
                  {t('common.signout')}
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
