import { createAdminClient } from '@/lib/supabase';
import PlatformSettingsForm from '@/components/admin/PlatformSettingsForm';

export const metadata = { title: 'Platform settings — Admin' };

export default async function AdminSettings() {
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from('platform_settings').select('*').eq('id', 1).maybeSingle();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl">Platform settings</h1>
      <PlatformSettingsForm settings={settings || {}} />
    </div>
  );
}
