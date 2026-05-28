import './globals.css';
import LangProvider from '@/components/LangProvider';

export const metadata = {
  title: 'قهوة — Qahwa',
  description: 'ادعم منشئك المفضل بقهوة ☕',
};

export default function RootLayout({ children }) {
  // Server defaults to ar/rtl; LangProvider syncs <html dir> from the
  // persisted preference (localStorage qahwa_lang) on mount.
  return (
    <html lang="ar" dir="rtl">
      <body>
        <LangProvider><>{children}</></LangProvider>
      </body>
    </html>
  );
}
