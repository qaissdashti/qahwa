import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

const NUMERIC = ['platform_fee_pct', 'min_payout_kd', 'max_coffee_price_kd', 'amazing_max_kd', 'amazing_min_kd'];
const BOOL    = ['amazing_enabled_global', 'new_signups_enabled', 'manual_approval_required', 'payouts_enabled', 'maintenance_mode'];

export async function POST(req) {
  if (!(await getAdminUser())) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const update = {};

  for (const k of NUMERIC) {
    if (body[k] !== undefined) {
      const n = Number(body[k]);
      if (Number.isNaN(n) || n < 0) return Response.json({ error: `قيمة غير صحيحة: ${k}` }, { status: 400 });
      update[k] = n;
    }
  }
  for (const k of BOOL) if (body[k] !== undefined) update[k] = !!body[k];
  if (body.maintenance_message !== undefined) {
    update.maintenance_message = String(body.maintenance_message || '').slice(0, 280) || null;
  }

  if (Object.keys(update).length === 0) return Response.json({ error: 'لا تغييرات' }, { status: 400 });

  const { error } = await createAdminClient()
    .from('platform_settings').update(update).eq('id', 1);

  if (error) return Response.json({ error: 'DB error' }, { status: 500 });
  return Response.json({ success: true });
}
