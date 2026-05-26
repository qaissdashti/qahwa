import './globals.css';

export const metadata = {
  title: 'قهوة — Qahwa',
  description: 'ادعم منشئك المفضل بقهوة ☕',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
