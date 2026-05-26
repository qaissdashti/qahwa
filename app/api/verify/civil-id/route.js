// Stores the creator's Civil ID encrypted at rest (AES-256-GCM).
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase';
import { encrypt, maskCivilId } from '@/lib/encryption';

export async function POST(req) {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { civilId } = await req.json();
  const clean = String(civilId || '').replace(/\D/g, '');

  // Kuwaiti Civil ID is 12 digits.
  if (!/^\d{12}$/.test(clean)) {
    return Response.json({ error: 'الرقم المدني لازم يكون 12 رقم' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('verifications')
    .upsert(
      {
        creator_id: user.id,
        civil_id_encrypted: encrypt(clean),
        civil_id_masked: maskCivilId(clean),
      },
      { onConflict: 'creator_id' }
    );

  if (error) {
    console.error('[verify/civil-id]', error);
    return Response.json({ error: 'تعذّر الحفظ' }, { status: 500 });
  }

  return Response.json({ success: true });
}
