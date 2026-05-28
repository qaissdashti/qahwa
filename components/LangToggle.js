'use client';

import { useLang } from '@/components/LangProvider';

// Reusable AR/EN pill button. Use `variant="dark"` for dark surfaces
// (dashboard/admin chrome) and the default for light backgrounds.
export default function LangToggle({ variant = 'light', className = '' }) {
  const { lang, toggleLang } = useLang();
  const base = 'inline-flex items-center justify-center rounded-full border-2 font-extrabold text-xs px-3 py-1 transition-colors';
  const skin = variant === 'dark'
    ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
    : 'border-qahwa-black bg-white text-qahwa-black hover:bg-qahwa-lavender';
  return (
    <button onClick={toggleLang} className={`${base} ${skin} ${className}`}
            style={{ fontFamily: "'Syne', sans-serif" }}
            aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
      {lang === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}
