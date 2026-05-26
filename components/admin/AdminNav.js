'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/admin',               'نظرة عامة',  '📊'],
  ['/admin/creators',      'المبدعون',   '👥'],
  ['/admin/verifications', 'التحقق',     '🪪'],
  ['/admin/payouts',       'السحوبات',   '💸'],
  ['/admin/settings',      'الإعدادات',  '⚙️'],
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex md:flex-col gap-1">
      {LINKS.map(([href, label, icon]) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors
              ${active ? 'bg-qahwa-accent text-qahwa-black' : 'text-white/70 hover:bg-white/5'}`}>
            <span className="text-lg">{icon}</span>
            <span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
