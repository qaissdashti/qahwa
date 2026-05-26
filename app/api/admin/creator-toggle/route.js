import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req) {
  if (!(await getAdminUser())) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { creatorId, disabled } = await req.json();
  if (!creatorId) return Response.json({ error: 'creatorId required' }, { status: 400 });

  const { error } = await createAdminClient()
    .from('creators')
    .update({ is_disabled: !!disabled })
    .eq('id', creatorId);

  if (error) return Response.json({ error: 'DB error' }, { status: 500 });
  return Response.json({ success: true });
}
