'use client';
import { resetUser } from '@/lib/mixpanel';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LangToggle from '@/components/LangToggle';
import { useLang } from '@/components/LangProvider';

const TABS = [
  ['/dashboard',          'nav.home',     '🏠'],
  ['/dashboard/tips',     'nav.tips',     '☕'],
  ['/dashboard/messages', 'nav.messages', '💬'],
  ['/dashboard/payouts',  'nav.payouts',  '💸'],
  ['/dashboard/settings', 'nav.settings', '⚙️'],
];

// Mobile-only chrome (< md). Pairs with DashboardSidebar (hidden on
// mobile) to give: sticky top bar with brand/user/actions + fixed
// bottom tab bar with the 5 nav icons. All tap targets ≥ 44px tall.
export default function DashboardMobileChrome({ creator }) {
  const pathname = usePathname();
  const { t } = useLang();
  return (
    <>
      {/* Top bar */}
      <header className="md:hidden flex items-center justify-between gap-3 dash-surface border-b border-white/10 px-4 py-3 sticky top-0 z-40 safe-pt">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">{creator.avatar_emoji || '☕'}</span>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{creator.full_name}</div>
            <div className="text-[10px] text-white/40 font-num truncate">@{creator.handle}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <LangToggle variant="dark" />
          <Link href={`/${creator.handle}`} target="_blank" prefetch={false}
                aria-label={t('nav.myPage')}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg bg-white/5 hover:bg-white/10 text-sm font-bold">↗</Link>
          <form action="/auth/signout" method="post" onSubmit={() => resetUser()}>
            <button aria-label={t('common.signout')}
                    className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg bg-white/5 hover:bg-white/10 text-sm font-bold">⎋</button>
          </form>
        </div>
      </header>

      {/* Fixed bottom tab bar — 5 tabs, full-width grid */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 dash-surface border-t border-white/10 z-50 grid grid-cols-5 safe-pb">
        {TABS.map(([href, key, icon]) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} prefetch={false}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-[10px] font-bold transition-colors
                ${active ? 'text-qahwa-accent' : 'text-white/60 hover:text-white/90'}`}>
              <span className="text-xl leading-none">{icon}</span>
              <span className="truncate max-w-full px-1">{t(key)}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
