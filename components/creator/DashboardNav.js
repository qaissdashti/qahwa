'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/dashboard',          'الرئيسية',     '🏠'],
  ['/dashboard/tips',     'القهاوي',      '☕'],
  ['/dashboard/messages', 'الرسائل',      '💬'],
  ['/dashboard/payouts',  'السحوبات',     '💸'],
  ['/dashboard/settings', 'الإعدادات',    '⚙️'],
];

export default function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="flex md:flex-col gap-1">
      {LINKS.map(([href, label, icon]) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors
              ${active ? 'bg-qahwa-accent text-qahwa-black' : 'text-white/70 hover:bg-white/5'}`}
          >
            <span className="text-lg">{icon}</span>
            <span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
