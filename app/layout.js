import { Suspense } from 'react';
import './globals.css';
import LangProvider from '@/components/LangProvider';
import NavigationProgress from '@/components/NavigationProgress';

export const metadata = {
  title: 'قهوة — Qahwa',
  description: 'ادعم منشئك المفضل بقهوة ☕',
};

// Tiny synchronous script that runs in <head> before React hydrates,
// so the html dir + lang match the user's saved preference on the very
// first paint (no Arabic flash for English users and vice versa).
//
// It also intercepts Supabase password-recovery links: those land on the
// Site URL (e.g. the homepage) with a `#type=recovery&access_token=...`
// hash. Running here — before any Supabase browser client is instantiated —
// means the hash is still intact, so we forward it untouched to
// /reset-password, where the client consumes it (PASSWORD_RECOVERY event).
const SET_DIR_SCRIPT = `
(function(){try{
  var s = localStorage.getItem('qahwa_lang');
  if (s === 'en') {
    document.documentElement.setAttribute('dir','ltr');
    document.documentElement.setAttribute('lang','en');
  }
  var h = window.location.hash || '';
  if (h.indexOf('type=recovery') !== -1 && window.location.pathname !== '/reset-password') {
    window.location.replace('/reset-password' + window.location.search + h);
  }
}catch(e){}})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: SET_DIR_SCRIPT }} />
      </head>
      <body>
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        <LangProvider><>{children}</></LangProvider>
      </body>
    </html>
  );
}
