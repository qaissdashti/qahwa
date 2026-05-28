'use client';

import SettingsForm from '@/components/creator/SettingsForm';
import { useLang } from '@/components/LangProvider';

export default function SettingsPageClient({ creator, maxPrice, amazingGlobal }) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('sset.title')}</h1>
      <SettingsForm creator={creator} maxPrice={maxPrice} amazingGlobal={amazingGlobal} />
    </div>
  );
}
