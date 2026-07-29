import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that require an authenticated creator/admin session.
const PROTECTED_PREFIXES = ['/dashboard', '/verify', '/admin'];

export async function middleware(request) {
  // Neutralise stray non-Server-Action POSTs to PAGE routes (e.g. bots/
  // scanners posting to a route that only renders a component) by bouncing
  // them to a GET via 303. Server Actions carry a Next-Action header and must
  // pass through untouched. /api routes are EXCLUDED — they legitimately
  // receive POSTs (payment callbacks, webhooks, JSON endpoints) that must
  // never be redirected.
  if (
    request.method === 'POST' &&
    !request.headers.get('next-action') &&
    !request.nextUrl.pathname.startsWith('/api')
  ) {
    return NextResponse.redirect(request.nextUrl, 303);
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          // write to both the request (for this pass) and the response (to client)
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Refreshes the session cookie if expired (required for Server Components).
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // /admin/login must stay reachable while signed out (avoid redirect loop).
  const isAuthEntry = pathname === '/admin/login';
  const isProtected = !isAuthEntry && PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  // Unauthenticated user hitting a protected route → send to login.
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith('/admin') ? '/admin/login' : '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in user on an auth page → bounce to dashboard.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets and image optimisation.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
