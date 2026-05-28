import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import MessagesListClient from '@/components/creator/MessagesListClient';

export const metadata = { title: 'الرسائل — قهوة' };
export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  const admin = createAdminClient();
  const { data: tips } = await admin
    .from('tips')
    .select('id, paid_at, supporter_name, supporter_phone, cups, is_amazing, gross_amount_kd, message, reply_sent_at, reply_type, reply_content')
    .eq('creator_id', user.id)
    .eq('status', 'paid')
    .not('message', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(100);

  return <MessagesListClient tips={tips || []} />;
}
