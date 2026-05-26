// GET /api/creator/handle-available?handle=xxx -> { available: bool, reason? }
import { createAdminClient } from '@/lib/supabase';

const RESERVED = new Set([
  'admin', 'dashboard', 'login', 'signup', 'verify', 'api', 'auth',
  'about', 'terms', 'privacy', 'help', 'support', 'settings', 'qahwa',
  'www', 'app', 'static', 'public',
]);

export async function GET(req) {
  const handle = (new URL(req.url).searchParams.get('handle') || '').toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
    return Response.json({ available: false, reason: 'format' });
  }
  if (RESERVED.has(handle)) {
    return Response.json({ available: false, reason: 'reserved' });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('creators')
    .select('id')
    .eq('handle', handle)
    .maybeSingle();

  if (error) {
    console.error('[handle-available]', error);
    return Response.json({ available: false, reason: 'error' }, { status: 500 });
  }

  return Response.json({ available: !data });
}
