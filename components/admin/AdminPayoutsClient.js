'use client';

import { useLang } from '@/components/LangProvider';
import AdminPayoutRow from '@/components/admin/AdminPayoutRow';

export default function AdminPayoutsClient({ payouts }) {
  const { t } = useLang();
  const pending = (payouts || []).filter((p) => p.status === 'pending');
  const rest    = (payouts || []).filter((p) => p.status !== 'pending');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl mb-3">{t('admin.po.pendingTitle')} ({pending.length})</h1>
        {pending.length === 0 ? (
          <div className="dash-surface rounded-2xl border border-white/10 text-center py-12 text-white/40 font-medium">
            {t('admin.po.noPending')}
          </div>
        ) : (
          <div className="grid gap-3">{pending.map((p) => <AdminPayoutRow key={p.id} payout={p} />)}</div>
        )}
      </div>
      {rest.length > 0 && (
        <div>
          <h2 className="text-lg mb-3 text-white/60">{t('admin.po.history')}</h2>
          <div className="grid gap-3">{rest.map((p) => <AdminPayoutRow key={p.id} payout={p} />)}</div>
        </div>
      )}
    </div>
  );
}
