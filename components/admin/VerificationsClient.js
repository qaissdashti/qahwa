'use client';

import { useLang } from '@/components/LangProvider';
import VerificationCard from '@/components/admin/VerificationCard';

export default function VerificationsClient({ rows }) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('admin.vf.title')} ({rows?.length || 0})</h1>
      {(!rows || rows.length === 0) ? (
        <div className="dash-surface rounded-2xl border border-white/10 text-center py-16 text-white/40">
          <div className="text-4xl mb-2">✅</div>
          <p className="font-medium">{t('admin.vf.empty')}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map((r) => (
            <VerificationCard
              key={r.creator_id}
              creatorId={r.creator_id}
              fullName={r.creators?.full_name}
              handle={r.creators?.handle}
              email={r.creators?.email}
              phone={r.creators?.phone}
              phoneVerified={r.phone_verified}
              civilMasked={r.civil_id_masked}
              hasSelfie={!!r.selfie_url}
            />
          ))}
        </div>
      )}
    </div>
  );
}
