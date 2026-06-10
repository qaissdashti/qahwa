// Onboarding wizard entry. Determines where to resume based on the
// signed-in user's state, then renders the client wizard.
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import OnboardingWizard from '@/components/creator/OnboardingWizard';

export const metadata = { title: 'إعداد حسابك — قهوة' };
export const dynamic = 'force-dynamic';

// WhatsApp OTP works either via a real Meta API token, OR locally via
// the dev bypass (which returns code 000000). If neither is available,
// step 3 of the wizard renders a "not configured yet, skip" UI so
// onboarding still completes end-to-end on the live site.
function isWhatsappReady() {
  if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_API_TOKEN.trim()) return true;
  if (process.env.DEV_OTP_BYPASS === 'true' && process.env.NODE_ENV !== 'production') return true;
  return false;
}

export default async function OnboardPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  const whatsappOk = isWhatsappReady();
  // TEMPORARY: lets testers skip WhatsApp OTP on step 3 while the Meta OTP
  // template is pending approval. Gated on PAYMENT_TEST_MODE (set in Vercel
  // for the test deployment). Remove once OTP is live in production.
  const testMode = process.env.PAYMENT_TEST_MODE === 'true';

  // Not signed in → wizard starts at step 1 (which creates the auth user).
  if (!user) {
    return <OnboardingWizard startStep={1} authed={false} whatsappOk={whatsappOk} testMode={testMode} />;
  }

  // Signed in → look up where they are and resume the right step.
  const admin = createAdminClient();
  const [{ data: creator }, { data: verification }] = await Promise.all([
    admin.from('creators')
      .select('full_name, handle, bio, avatar_emoji, avatar_url, coffee_price_kd, bank_name, account_holder, iban_masked, verification_status, is_verified')
      .eq('id', user.id).maybeSingle(),
    admin.from('verifications')
      .select('phone_verified, civil_id_encrypted, status').eq('creator_id', user.id).maybeSingle(),
  ]);

  // Already a verified creator → into the dashboard.
  if (creator?.is_verified || creator?.verification_status === 'approved') {
    redirect('/dashboard');
  }

  // Step resume — first incomplete step in order. When WhatsApp isn't
  // configured, the phone check is bypassed so users aren't stuck on a
  // step they can't complete.
  let startStep = 2;
  if (verification?.status === 'under_review')         startStep = 5;
  else if (!creator?.iban_masked)                      startStep = 2;
  else if (whatsappOk && !verification?.phone_verified) startStep = 3;
  else if (!verification?.civil_id_encrypted)          startStep = 4;
  else                                                  startStep = 5;

  return (
    <OnboardingWizard
      startStep={startStep}
      authed={true}
      whatsappOk={whatsappOk}
      testMode={testMode}
      initial={{ creator, verification }}
    />
  );
}
