// Onboarding wizard entry. Determines where to resume based on the
// signed-in user's state, then renders the client wizard.
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import OnboardingWizard from '@/components/creator/OnboardingWizard';

export const metadata = { title: 'إعداد حسابك — قهوة' };
export const dynamic = 'force-dynamic';

export default async function OnboardPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();

  // Not signed in → wizard starts at step 1 (which creates the auth user).
  if (!user) {
    return <OnboardingWizard startStep={1} authed={false} />;
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

  // Step resume: 5 if already under review, else first incomplete step.
  // Order matters — bank (step 2) is checked before phone (step 3) etc.
  let startStep = 2;
  if (verification?.status === 'under_review')     startStep = 5;
  else if (!creator?.iban_masked)                  startStep = 2;
  else if (!verification?.phone_verified)          startStep = 3;
  else if (!verification?.civil_id_encrypted)      startStep = 4;
  else                                              startStep = 5;

  return (
    <OnboardingWizard
      startStep={startStep}
      authed={true}
      initial={{ creator, verification }}
    />
  );
}
