'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/components/LangProvider';

const LINKS = [
  ['/dashboard',          'nav.home',     '🏠'],
  ['/dashboard/tips',     'nav.tips',     '☕'],
  ['/dashboard/messages', 'nav.messages', '💬'],
  ['/dashboard/payouts',  'nav.payouts',  '💸'],
  ['/dashboard/settings', 'nav.settings', '⚙️'],
];

export default function DashboardNav() {
  const pathname = usePathname();
  const { t } = useLang();
  return (
    <nav className="flex md:flex-col gap-1">
      {LINKS.map(([href, key, icon]) => {
        const active = pathname === href;
        return (
          // prefetch={false} so balance/tips/etc. always re-fetch on click
          // instead of using a cached prefetched RSC payload.
          <Link key={href} href={href} prefetch={false}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors
              ${active ? 'bg-qahwa-accent text-qahwa-black' : 'text-white/70 hover:bg-white/5'}`}>
            <span className="text-lg">{icon}</span>
            <span className="hidden md:inline">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
