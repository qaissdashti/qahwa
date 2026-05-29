// Server shell — keeps the metadata export at the server level
// (Next 14 doesn't allow `export const metadata` from a client file).
// The real UI is in components/landing/LandingClient.js.
import LandingClient from '@/components/landing/LandingClient';

export const metadata = {
  title: 'قهوة — ادعم منشئك المفضل ☕ · Qahwa',
  description: 'منصة كويتية لدعم المبدعين بالدينار عبر كي نت. Kuwaiti platform for tipping creators in KWD via KNET.',
};

export default function Home() {
  return <LandingClient />;
}
