import { createAdminClient } from '@/lib/supabase';
import CreatorRow from '@/components/admin/CreatorRow';

export const metadata = { title: 'المبدعون — الإدارة' };

export default async function AdminCreators() {
  const admin = createAdminClient();
  const { data: creators } = await admin
    .from('creators')
    .select('id, full_name, handle, email, balance_kd, total_earned_kd, verification_status, is_verified, is_disabled, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl">المبدعون ({creators?.length || 0})</h1>

      <div className="dash-surface rounded-2xl border border-white/10 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-white/40 text-right border-b border-white/10">
            <tr>
              <th className="font-bold px-4 py-3">المبدع</th>
              <th className="font-bold px-4 py-3">الحالة</th>
              <th className="font-bold px-4 py-3">الرصيد</th>
              <th className="font-bold px-4 py-3">الأرباح</th>
              <th className="font-bold px-4 py-3">التحكم</th>
            </tr>
          </thead>
          <tbody>
            {(creators || []).map((c) => <CreatorRow key={c.id} creator={c} />)}
          </tbody>
        </table>
        {(!creators || creators.length === 0) && (
          <p className="text-center text-white/40 py-12 font-medium">لا يوجد مبدعون بعد</p>
        )}
      </div>
    </div>
  );
}
