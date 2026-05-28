'use client';

import { useLang } from '@/components/LangProvider';
import PlatformSettingsForm from '@/components/admin/PlatformSettingsForm';

export default function PlatformSettingsClient({ settings }) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('admin.ps.title')}</h1>
      <PlatformSettingsForm settings={settings} />
    </div>
  );
}
