'use client';

// Initialises Mixpanel once on mount and keeps the `language` super property
// in sync with the current UI language. Renders nothing. Must live inside
// LangProvider so useLang() is available. Safe no-op without a token.
import { useEffect } from 'react';
import { useLang } from '@/components/LangProvider';
import { initMixpanel, registerSuperProps } from '@/lib/mixpanel';

export default function MixpanelProvider() {
  const { lang } = useLang();

  useEffect(() => {
    initMixpanel();
  }, []);

  useEffect(() => {
    registerSuperProps({ language: lang });
  }, [lang]);

  return null;
}
