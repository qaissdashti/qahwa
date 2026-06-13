// Server-only Supabase helpers. The browser client lives in
// lib/supabase-browser.js (importing next/headers here would break
// any Client Component that touches this module).

// ─── Server client (for Server Components / API routes) ───────
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; },
        // In a Server Component the cookie store is read-only and these throw;
        // that's fine — middleware.js refreshes the session cookie instead.
        set(name, value, options) {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name, options) {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    }
  );
}

// ─── Service-role admin client (server only, bypasses RLS) ────
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      // Opt every service-role read out of Next.js's fetch Data Cache.
      // supabase-js uses the global fetch, which Next patches and caches by
      // default; without cache:'no-store' a read can be served from the Data
      // Cache and return stale rows even on a force-dynamic / revalidate=0
      // route. Service-role reads always want live data, so disable caching.
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  );
}
