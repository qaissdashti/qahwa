import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import SettingsPageClient from '@/components/creator/SettingsPageClient';

export const metadata = { title: 'الإعدادات — قهوة' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  const admin = createAdminClient();
  const [{ data: creator }, { data: settings }] = await Promise.all([
    admin.from('creators')
      .select('handle, full_name, bio, avatar_emoji, avatar_url, coffee_price_kd, theme_bg, theme_text, amazing_enabled, amazing_message, instagram, twitter, youtube, tiktok, bank_name, account_holder, iban_masked')
      .eq('id', user.id).maybeSingle(),
    admin.from('platform_settings').select('max_coffee_price_kd, amazing_enabled_global').eq('id', 1).maybeSingle(),
  ]);

  return (
    <SettingsPageClient
      creator={creator}
      maxPrice={Number(settings?.max_coffee_price_kd ?? 10)}
      amazingGlobal={!!settings?.amazing_enabled_global}
    />
  );
}
