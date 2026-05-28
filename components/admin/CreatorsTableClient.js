'use client';

import { useLang } from '@/components/LangProvider';
import CreatorRow from '@/components/admin/CreatorRow';

export default function CreatorsTableClient({ creators }) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('admin.cr.title')} ({creators?.length || 0})</h1>
      <div className="dash-surface rounded-2xl border border-white/10 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-white/40 text-start border-b border-white/10">
            <tr>
              <th className="font-bold px-4 py-3">{t('admin.cr.col.creator')}</th>
              <th className="font-bold px-4 py-3">{t('admin.cr.col.status')}</th>
              <th className="font-bold px-4 py-3">{t('admin.cr.col.balance')}</th>
              <th className="font-bold px-4 py-3">{t('admin.cr.col.earnings')}</th>
              <th className="font-bold px-4 py-3">{t('admin.cr.col.action')}</th>
            </tr>
          </thead>
          <tbody>
            {(creators || []).map((c) => <CreatorRow key={c.id} creator={c} />)}
          </tbody>
        </table>
        {(!creators || creators.length === 0) && (
          <p className="text-center text-white/40 py-12 font-medium">{t('admin.cr.empty')}</p>
        )}
      </div>
    </div>
  );
}
