// Public page shown for creators that exist but are NOT yet approved by
// the god admin. Intentionally has NO tipping UI, NO payment button,
// NO amount input — nothing that could take money.
'use client';

import Link from 'next/link';
import { useLang } from '@/components/LangProvider';
import LangToggle from '@/components/LangToggle';

const C = {
  bg:     '#F5F0FF',
  card:   '#FFFFFF',
  ink:    '#0D0D0D',
  accent: '#C8F55A',
  purple: '#7B2FBE',
  violet: '#9B4DCA',
  soft:   '#EDE4FB',
};

export default function PendingApprovalPage({ creator }) {
  const { t, dir } = useLang();
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10"
          style={{ background: C.bg, fontFamily: "'Tajawal', sans-serif" }}
          dir={dir}>
      <div className="w-full max-w-md relative">
        <div className="absolute top-0 inset-inline-end-0 z-10" style={{ insetInlineEnd: 0 }}>
          <LangToggle />
        </div>

        <Link href="/" className="block text-center text-2xl font-extrabold mb-6 text-qahwa-black"
              style={{ fontFamily: 'Fraunces' }}>
          قهوة <span className="text-qahwa-accent">☕</span>
        </Link>

        <div style={{
          background: C.card, border: `2px solid ${C.ink}`, borderRadius: 28,
          padding: '2rem 1.75rem', boxShadow: `5px 5px 0 ${C.ink}`,
          textAlign: 'center',
        }}>
          {/* avatar */}
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            border: `2px solid ${C.ink}`, boxShadow: `3px 3px 0 ${C.ink}`,
            overflow: 'hidden', display: 'grid', placeItems: 'center',
            background: C.soft, fontSize: 40, margin: '0 auto 14px',
          }}>
            {creator.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={creator.avatar_url} alt={creator.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (creator.avatar_emoji || '☕')}
          </div>

          {/* name */}
          <div style={{ fontFamily: "'Fraunces',sans-serif", fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.04em' }}>
            {creator.full_name || creator.handle}
          </div>

          {/* under-review badge */}
          <div className="inline-flex items-center gap-2 mt-3 mb-4"
               style={{ background: C.soft, border: `2px solid ${C.purple}`, borderRadius: 999, padding: '6px 14px' }}>
            <span style={{ fontSize: 16 }}>🕵️</span>
            <span style={{ color: C.purple, fontWeight: 800, fontSize: 13, fontFamily: "'Fraunces',sans-serif" }}>
              {t('pending.title')}
            </span>
          </div>

          {/* body */}
          <p style={{ fontSize: 15, color: '#4A4458', lineHeight: 1.6, fontWeight: 500 }}>
            {t('pending.body', { name: creator.full_name || `@${creator.handle}` })}
          </p>
          <p style={{ fontSize: 13, color: C.violet, fontWeight: 700, marginTop: 8 }}>
            ⏱ {t('pending.estimate')}
          </p>

          {/* share-later URL */}
          <div style={{ borderTop: `2px solid ${C.soft}`, marginTop: 20, paddingTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 6 }}>
              {t('pending.shareLater')}
            </p>
            <div style={{
              background: C.soft, border: `2px solid ${C.ink}`, borderRadius: 12,
              padding: '10px 14px', fontFamily: "'DM Sans',sans-serif", fontWeight: 700,
              color: C.ink, direction: 'ltr',
            }}>
              qahwa.kw/{creator.handle}
            </div>
          </div>

          {/* explicit no-tipping notice */}
          <p style={{ fontSize: 11, color: '#8a8696', marginTop: 16, fontWeight: 600 }}>
            🚫 {t('pending.notAccepting')}
          </p>
        </div>

        <p className="text-center text-sm text-black/40 mt-5 font-medium">
          {t('pending.checkBack')}
        </p>
      </div>
    </main>
  );
}
