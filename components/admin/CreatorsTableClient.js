'use client';

import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';
import CreatorRow from '@/components/admin/CreatorRow';
import CreatorCard from '@/components/admin/CreatorCard';

export default function CreatorsTableClient({ creators }) {
  const { t } = useLang();
  const empty = !creators || creators.length === 0;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('admin.cr.title')} ({creators?.length || 0})</h1>

      {empty ? (
        <div className="dash-surface rounded-2xl border border-white/10 text-center py-12">
          <p className="text-white/40 font-medium">{t('admin.cr.empty')}</p>
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="md:hidden space-y-2">
            {creators.map((c) => <CreatorCard key={c.id} creator={c} />)}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block dash-surface rounded-2xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-white/40 text-start border-b border-white/10">
                <tr>
                  <th className="font-bold px-4 py-3 text-start">{t('admin.cr.col.creator')}</th>
                  <th className="font-bold px-4 py-3 text-start">{t('admin.cr.col.status')}</th>
                  <th className="font-bold px-4 py-3 text-start">{t('admin.cr.col.balance')}</th>
                  <th className="font-bold px-4 py-3 text-start">{t('admin.cr.col.earnings')}</th>
                  <th className="font-bold px-4 py-3 text-start">{t('admin.cr.col.action')}</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c) => <CreatorRow key={c.id} creator={c} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
