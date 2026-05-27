import { createAdminClient } from '@/lib/supabase';
import CreatorRow from '@/components/admin/CreatorRow';

export const metadata = { title: 'Creators — Admin' };

export default async function AdminCreators() {
  const admin = createAdminClient();
  const { data: creators } = await admin
    .from('creators')
    .select('id, full_name, handle, email, balance_kd, total_earned_kd, verification_status, is_verified, is_disabled, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl">Creators ({creators?.length || 0})</h1>

      <div className="dash-surface rounded-2xl border border-white/10 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-white/40 text-left border-b border-white/10">
            <tr>
              <th className="font-bold px-4 py-3">Creator</th>
              <th className="font-bold px-4 py-3">Status</th>
              <th className="font-bold px-4 py-3">Balance</th>
              <th className="font-bold px-4 py-3">Earnings</th>
              <th className="font-bold px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(creators || []).map((c) => <CreatorRow key={c.id} creator={c} />)}
          </tbody>
        </table>
        {(!creators || creators.length === 0) && (
          <p className="text-center text-white/40 py-12 font-medium">No creators yet</p>
        )}
      </div>
    </div>
  );
}
