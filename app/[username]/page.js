// PUBLIC TIPPING PAGE — buymeqahwa.com/[username]
// Supporters land here. No auth required.
// IMPORTANT: the tipping UI is ONLY shown for creators that have been
// approved by the god admin (is_verified=true AND verification_status
// ='approved'). Unapproved (or under-review) creators get a read-only
// pending-approval page with no tipping/payment UI of any kind.
import { createAdminClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import TippingClient from '@/components/tipper/TippingClient';
import PendingApprovalPage from '@/components/tipper/PendingApprovalPage';

// Always read live data from Supabase on each request. Without this Next
// statically renders the page and serves stale creator data (e.g. an old
// coffee price or name) after the creator updates their settings.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Build the ISO timestamp for "today, 00:00 Asia/Kuwait" (UTC+3, no DST).
// We add 3h to UTC to read the Kuwait local date, then emit that date at
// midnight with the +03:00 offset — Postgres parses it without conversion
// ambiguity. Used to count tips paid since today's Kuwait midnight for
// the social-proof popup.
function kuwaitMidnightIso() {
  const k = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const y = k.getUTCFullYear();
  const m = String(k.getUTCMonth() + 1).padStart(2, '0');
  const d = String(k.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00+03:00`;
}

export async function generateMetadata({ params }) {
  const supabase = createAdminClient();
  const { data: creator } = await supabase
    .from('creators')
    .select('full_name, bio, avatar_url, is_verified, verification_status')
    .eq('handle', params.username.toLowerCase())
    .eq('is_disabled', false)
    .maybeSingle();
  if (!creator) return { title: 'قهوة' };
  const approved = creator.is_verified && creator.verification_status === 'approved';
  return {
    title: `${creator.full_name} ☕ قهوة${approved ? '' : ' — قيد المراجعة'}`,
    description: approved
      ? (creator.bio || `ادعم ${creator.full_name} بقهوة`)
      : `صفحة ${creator.full_name} قيد مراجعة الإدارة`,
    openGraph: { images: creator.avatar_url ? [creator.avatar_url] : [] },
  };
}

export default async function TippingPage({ params, searchParams }) {
  const supabase = createAdminClient();

  // Fetch without the verification filter so we can decide between
  // "pending approval" and "tipping" based on the creator's status.
  const { data: creator, error: creatorError } = await supabase
    .from('creators')
    .select(`id, full_name, handle, bio, avatar_url, avatar_emoji,
             coffee_price_kd, theme_bg, theme_text,
             amazing_enabled, amazing_message,
             instagram, twitter, youtube, tiktok,
             total_tips_count, is_verified, is_active, is_disabled,
             verification_status`)
    .eq('handle', params.username.toLowerCase())
    .maybeSingle();

  // A real query failure (bad service-role key, RLS, schema) must not be
  // silently collapsed into a 404 — log it distinctly so it's visible.
  if (creatorError) console.error('[username] creator query failed', creatorError);

  // Genuinely no such creator, or admin-disabled, or creator-deactivated
  // → 404 (we don't reveal anything about disabled accounts).
  if (!creator || creator.is_disabled || creator.is_active === false) notFound();

  // Not yet cleared by the god admin → show the pending page.
  // NO tipping UI, NO payment button, NO amount input is rendered.
  const approved = creator.is_verified && creator.verification_status === 'approved';
  if (!approved) {
    return <PendingApprovalPage creator={creator} />;
  }

  // Approved → real tipping page.
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
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize:24, margin:'16px 0 8px' }}>نعمل على تحسين قهوة</h1>
          <p style={{ color:'#666' }}>{settings.maintenance_message || 'نعود قريباً'}</p>
        </div>
      </div>
    );
  }

  // Recent tips list + today's tips for the social-proof popup, fired in
  // parallel — both read the same `tips` table for this creator. We fetch
  // today's paid rows (not a bare count) so we can dedupe to DISTINCT
  // supporters: same phone = same person. "Today" = since Kuwait midnight.
  const sinceKuwaitMidnight = kuwaitMidnightIso();
  const [
    { data: recentTips },
    { data: todayTips },
  ] = await Promise.all([
    supabase
      .from('tips')
      .select('supporter_name, cups, is_amazing, gross_amount_kd, created_at')
      .eq('creator_id', creator.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(5),
    supabase
      .from('tips')
      .select('id, supporter_phone')
      .eq('creator_id', creator.id)
      .eq('status', 'paid')
      .gte('paid_at', sinceKuwaitMidnight),
  ]);

  // Distinct supporters today: dedupe by supporter_phone (mandatory for
  // new tips, so reliable). Older/anonymous tips with no phone each count
  // as their own supporter (keyed by tip id) rather than collapsing into
  // one "anonymous" bucket.
  const distinctSupportersToday = (() => {
    const seen = new Set();
    for (const tp of todayTips || []) {
      seen.add(tp.supporter_phone ? `phone:${tp.supporter_phone}` : `tip:${tp.id}`);
    }
    return seen.size;
  })();

  return (
    <TippingClient
      creator={creator}
      settings={settings}
      recentTips={recentTips || []}
      todayCount={distinctSupportersToday}
      showSuccess={searchParams?.success === '1'}
    />
  );
}
