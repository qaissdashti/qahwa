'use client';

import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';

export default function VerifyReviewScreen() {
  const { t, dir } = useLang();
  return (
    <main className="min-h-screen flex items-center justify-center px-5" dir={dir}>
      <div className="q-card p-8 max-w-md text-center relative">
        <div className="absolute top-3 right-3"><LangToggle /></div>
        <div className="text-6xl mb-4">🕵️</div>
        <h1 className="text-2xl mb-2">{t('auth.verify.review.title')}</h1>
        <p className="text-black/60 font-medium">{t('auth.verify.review.body')}</p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="q-btn-white text-sm">{t('common.signout')}</button>
        </form>
      </div>
    </main>
  );
}
