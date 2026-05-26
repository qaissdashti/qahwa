// Onboarding / KYC. Middleware guarantees the user is authenticated here.
import { redirect } from 'next/navigation';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase';
import VerifyClient from '@/components/creator/VerifyClient';

export const metadata = { title: 'التحقق — قهوة' };

export default async function VerifyPage() {
  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect('/login?next=/verify');

  // service role: read creator + verification regardless of RLS edge cases
  const admin = createAdminClient();
  const [{ data: creator }, { data: verification }] = await Promise.all([
    admin.from('creators').select('full_name, handle, verification_status, is_verified').eq('id', user.id).maybeSingle(),
    admin.from('verifications').select('phone_verified, civil_id_encrypted, selfie_url, status').eq('creator_id', user.id).maybeSingle(),
  ]);

  // already cleared → into the dashboard
  if (creator?.is_verified || creator?.verification_status === 'approved') {
    redirect('/dashboard');
  }

  const underReview =
    creator?.verification_status === 'under_review' || verification?.status === 'under_review';

  if (underReview) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5">
        <div className="q-card p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🕵️</div>
          <h1 className="text-2xl mb-2">طلبك قيد المراجعة</h1>
          <p className="text-black/60 font-medium">
            استلمنا بياناتك ونراجعها الحين. بنفعّل صفحتك خلال ٢٤ ساعة ونعلمك عبر واتساب.
          </p>
          <form action="/auth/signout" method="post" className="mt-6">
            <button className="q-btn-white text-sm">تسجيل الخروج</button>
          </form>
        </div>
      </main>
    );
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
