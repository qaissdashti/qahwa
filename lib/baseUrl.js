// Resolve the public base URL the app is reachable at, with fallbacks
// so deployments work even if NEXT_PUBLIC_BASE_URL wasn't set.
//
//   1. NEXT_PUBLIC_BASE_URL  — explicit (preferred; set this on Vercel)
//   2. https://buymeqahwa.com — production custom domain (any Vercel deploy)
//   3. http://localhost:3000 — local dev fallback
//
// We deliberately do NOT fall back to VERCEL_URL: that resolves to the
// per-deployment '*.vercel.app' host, which would leak into emails and
// dashboard links instead of the verified custom domain.
// Always returns a value with no trailing slash.
export function getBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  // Any Vercel environment (VERCEL is '1' on every deploy) → custom domain.
  if (process.env.VERCEL) return 'https://buymeqahwa.com';

  return 'http://localhost:3000';
}
