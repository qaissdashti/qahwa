// Resolve the public base URL the app is reachable at, with fallbacks
// so deployments work even if NEXT_PUBLIC_BASE_URL wasn't set.
//
//   1. NEXT_PUBLIC_BASE_URL  — explicit (preferred; set this on Vercel)
//   2. https://VERCEL_URL    — Vercel's auto-injected per-deployment host
//   3. http://localhost:3000 — local dev fallback
//
// Always returns a value with no trailing slash.
export function getBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  // Vercel sets VERCEL_URL to the deployment host (no scheme), e.g.
  // 'qahwa-6h1lhakdb-sfumata.vercel.app'. Prefix with https.
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}
