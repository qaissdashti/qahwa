// PUBLIC TIPPING PAGE — qahwa.kw/[username]
// Supporters land here. No auth required.
import { createAdminClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import TippingClient from '@/components/tipper/TippingClient';

export async function generateMetadata({ params }) {
  const supabase = createAdminClient();
  const { data: creator } = await supabase
    .from('creators')
    .select('full_name, bio, avatar_url')
    .eq('handle', params.username.toLowerCase())
    .eq('is_active', true)
    .eq('is_disabled', false)
    .single();
  if (!creator) return { title: 'قهوة' };
  return {
    title: `${creator.full_name} ☕ قهوة`,
    description: creator.bio || `ادعم ${creator.full_name} بقهوة`,
    openGraph: { images: creator.avatar_url ? [creator.avatar_url] : [] },
  };
}

export default async function TippingPage({ params, searchParams }) {
  const supabase = createAdminClient();

  const { data: creator } = await supabase
    .from('creators')
    .select(`id, full_name, handle, bio, avatar_url, avatar_emoji,
             coffee_price_kd, theme_bg, theme_text,
             amazing_enabled, amazing_message,
             instagram, twitter, youtube, tiktok,
             total_tips_count, is_verified`)
    .eq('handle', params.username.toLowerCase())
    .eq('is_active', true)
    .eq('is_disabled', false)
    .single();

  if (!creator) notFound();

  const { data: settings } = await supabase
    .from('platform_settings')
    .select('amazing_enabled_global, amazing_max_kd, amazing_min_kd, maintenance_mode')
    .eq('id', 1)
    .single();

  if (settings?.maintenance_mode) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0D0D0D' }}>
        <div style={{ textAlign:'center', color:'#FAFAF7' }}>
          <div style={{ fontSize:64 }}>☕</div>
          <h1 style={{ fontFamily:'Syne', fontSize:24, margin:'16px 0 8px' }}>نعمل على تحسين قهوة</h1>
          <p style={{ color:'#666' }}>{settings.maintenance_message || 'نعود قريباً'}</p>
        </div>
      </div>
    );
  }

  const { data: recentTips } = await supabase
    .from('tips')
    .select('supporter_name, cups, is_amazing, gross_amount_kd, created_at')
    .eq('creator_id', creator.id)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(5);

  return (
    <TippingClient
      creator={creator}
      settings={settings}
      recentTips={recentTips || []}
      showSuccess={searchParams?.success === '1'}
    />
  );
}
