// Small helper for API routes: returns an error Response that carries
// the raw Supabase (or arbitrary) error object alongside the friendly
// message, so the client can surface the actual failure to the dev
// while still showing a localised string to the end user.
//
// Includes message + code + hint + details by default — the four
// Postgres/Supabase fields that actually pinpoint a problem (missing
// column, RLS blocked, trigger raised exception, FK violation, etc.).
// All four are safe to expose to the authenticated user whose own row
// triggered the error.
//
//   import { dbErr } from '@/lib/apiError';
//   if (error) return dbErr('تعذّر الحفظ', error, 500, '[creator/settings]');
//
export function dbErr(friendly, error, status = 500, logPrefix = '') {
  const safe = {
    message: error?.message || null,
    code:    error?.code    || null,
    hint:    error?.hint    || null,
    details: error?.details || null,
  };
  if (logPrefix) console.error(logPrefix, safe);
  return Response.json({ error: friendly, details: safe }, { status });
}
