import { createAdminClient } from '@/lib/supabase';
import PlatformSettingsClient from '@/components/admin/PlatformSettingsClient';

export const metadata = { title: 'Platform settings — Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from('platform_settings').select('*').eq('id', 1).maybeSingle();
  return <PlatformSettingsClient settings={settings || {}} />;
}
