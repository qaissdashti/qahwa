// Onboarding / KYC. Middleware guarantees the user is authenticated here.
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import VerifyClient from '@/components/creator/VerifyClient';
import VerifyReviewScreen from '@/components/creator/VerifyReviewScreen';

export const metadata = { title: 'التحقق — قهوة' };

export default async function VerifyPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect('/login?next=/verify');

  // service role: read creator + verification regardless of RLS edge cases
  const admin = createAdminClient();

  // Safety net: ensure a creators row exists before onboarding/OTP. Covers
  // the email-confirmation path (no client init ran) and any orphan auth
  // users created before the handle_new_user() trigger existed.
  let { data: creator } = await admin
    .from('creators').select('full_name, handle, verification_status, is_verified').eq('id', user.id).maybeSingle();

  if (!creator) {
    const meta = user.user_metadata || {};
    let handle = String(meta.handle || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (handle.length >= 3 && handle.length <= 30) {
      const { data: taken } = await admin.from('creators').select('id').eq('handle', handle).maybeSingle();
      if (taken) handle = null;
    } else {
      handle = null;
    }
    await admin.from('creators').insert({
      id: user.id, email: user.email, full_name: String(meta.full_name || '').trim(), handle,
    });
    ({ data: creator } = await admin
      .from('creators').select('full_name, handle, verification_status, is_verified').eq('id', user.id).maybeSingle());
  }

  const { data: verification } = await admin
    .from('verifications').select('phone_verified, civil_id_encrypted, selfie_url, status').eq('creator_id', user.id).maybeSingle();

  // already cleared → into the dashboard
  if (creator?.is_verified || creator?.verification_status === 'approved') {
    redirect('/dashboard');
  }

  const underReview =
    creator?.verification_status === 'under_review' || verification?.status === 'under_review';

  if (underReview) {
    return <VerifyReviewScreen />;
  }

  const initialStep = !verification?.phone_verified ? 1
    : !verification?.civil_id_encrypted ? 2
    : 3;

  return (
    <VerifyClient
      fullName={creator?.full_name || ''}
      initialStep={initialStep}
      phoneVerified={!!verification?.phone_verified}
      civilDone={!!verification?.civil_id_encrypted}
    />
  );
}
