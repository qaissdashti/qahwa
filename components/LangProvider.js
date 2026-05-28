'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { STR } from '@/lib/i18n';

const Ctx = createContext({
  lang: 'ar', dir: 'rtl',
  t: (k) => k, toggleLang: () => {}, setLang: () => {},
});

export const useLang = () => useContext(Ctx);

export default function LangProvider({ children, defaultLang = 'ar' }) {
  const [lang, setLang] = useState(defaultLang);

  // Restore the chosen language from localStorage on mount.
  useEffect(() => {
    try {
      const s = localStorage.getItem('qahwa_lang');
      if (s === 'ar' || s === 'en') setLang(s);
    } catch {}
  }, []);

  // Keep <html dir> + <html lang> in sync so all CSS/RTL behaviours
  // follow the choice and accessibility/SEO sees the right language.
  useEffect(() => {
    try {
      document.documentElement.setAttribute('dir',  lang === 'ar' ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', lang);
    } catch {}
  }, [lang]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const t = (key, vars) => {
    const tmpl = STR[lang]?.[key] ?? STR.ar?.[key] ?? key;
    if (vars && typeof tmpl === 'string') {
      return Object.keys(vars).reduce(
        (s, k) => s.replaceAll(`{${k}}`, String(vars[k])),
        tmpl,
      );
    }
    return tmpl;
  };

  const toggleLang = () => setLang((l) => {
    const next = l === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('qahwa_lang', next); } catch {}
    return next;
  });

  return <Ctx.Provider value={{ lang, dir, t, toggleLang, setLang }}>{children}</Ctx.Provider>;
}
