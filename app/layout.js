import './globals.css';
import LangProvider from '@/components/LangProvider';

export const metadata = {
  title: 'قهوة — Qahwa',
  description: 'ادعم منشئك المفضل بقهوة ☕',
};

// Tiny synchronous script that runs in <head> before React hydrates,
// so the html dir + lang match the user's saved preference on the very
// first paint (no Arabic flash for English users and vice versa).
const SET_DIR_SCRIPT = `
(function(){try{
  var s = localStorage.getItem('qahwa_lang');
  if (s === 'en') {
    document.documentElement.setAttribute('dir','ltr');
    document.documentElement.setAttribute('lang','en');
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
        <LangProvider><>{children}</></LangProvider>
      </body>
    </html>
  );
}
