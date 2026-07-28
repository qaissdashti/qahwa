import { Suspense } from 'react';
import { Plus_Jakarta_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import LangProvider from '@/components/LangProvider';
import NavigationProgress from '@/components/NavigationProgress';
import MixpanelProvider from '@/components/MixpanelProvider';
import { getBaseUrl } from '@/lib/baseUrl';

// Plus Jakarta Sans is the app-wide font (Latin). It has no Arabic glyphs,
// so IBM Plex Sans Arabic is loaded alongside it as the Arabic fallback.
// Both are exposed as CSS variables and combined into --font-sans in
// globals.css → 'Plus Jakarta Sans', 'IBM Plex Sans Arabic', sans-serif.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

const base = getBaseUrl();

export const metadata = {
  // Base for resolving relative OG/icon URLs. Only set it when getBaseUrl()
  // yields a valid absolute URL — otherwise leave it undefined so Next falls
  // back to its own default instead of throwing ERR_INVALID_URL (e.g. when
  // NEXT_PUBLIC_BASE_URL is unset or misconfigured to a bad value like "null").
  metadataBase: (typeof base === 'string' && /^https?:\/\//.test(base)) ? new URL(base) : undefined,
  title: 'قهوة — Qahwa',
  description: 'ادعم منشئك المفضل بقهوة ☕',
  // Pixel-art coffee-cup brand mark. SVG favicon works in every modern
  // browser (Chrome, Edge, Firefox, Safari 14+); the .ico fallback would
  // need a converted asset — skip for now, browsers ignore the missing
  // shortcut icon gracefully.
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/qahwa-logo-large.svg',
  },
  // OG share card. The detailed cup SVG with قهوة on it stands in
  // until we generate a fixed-size 1200×630 PNG. Most modern crawlers
  // (Twitter / X, Discord, Slack) render SVG; legacy Facebook may not.
  openGraph: {
    title: 'قهوة — Qahwa',
    description: 'ادعم منشئك المفضل بقهوة ☕ · Kuwaiti creator tipping in KWD via KNET.',
    images: [{ url: '/qahwa-logo-large.svg', alt: 'Qahwa' }],
    type: 'website',
  },
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
    <html lang="ar" dir="rtl" className={`${jakarta.variable} ${plexArabic.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SET_DIR_SCRIPT }} />
      </head>
      <body>
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        <LangProvider><MixpanelProvider /><>{children}</></LangProvider>
      </body>
    </html>
  );
}
