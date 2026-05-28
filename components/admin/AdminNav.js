'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/components/LangProvider';

const LINKS = [
  ['/admin',               'admin.nav.overview',     '📊'],
  ['/admin/creators',      'admin.nav.creators',     '👥'],
  ['/admin/verifications', 'admin.nav.verification', '🪪'],
  ['/admin/payouts',       'admin.nav.payouts',      '💸'],
  ['/admin/settings',      'admin.nav.settings',     '⚙️'],
];

export default function AdminNav() {
  const pathname = usePathname();
  const { t } = useLang();
  return (
    <nav className="flex md:flex-col gap-1">
      {LINKS.map(([href, key, icon]) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href}
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
