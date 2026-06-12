'use client';

import { useLang } from '@/components/LangProvider';
import { fmtKd } from '@/lib/i18n';

// ── TEMPORARILY HIDDEN: WhatsApp reply UI ───────────────────────────
// The WhatsApp reply loop was removed (creators no longer reply to
// supporters via WhatsApp — see lib/whatsapp.js / the disabled inbound
// webhook). So the green "Reply on WhatsApp" button — along with the
// old replied-status line and the no-phone placeholder, which all belong
// to that same removed feature — is hidden behind this flag. The code is
// kept intact: flip this to `true` to restore the whole reply UI if the
// WhatsApp reply feature is ever brought back.
const SHOW_WHATSAPP_REPLY = false;

export default function MessagesListClient({ tips }) {
  const { t, lang } = useLang();
  const dateLoc = lang === 'ar' ? 'ar-KW' : 'en-GB';
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">{t('msg.title')}</h1>

      {(!tips || tips.length === 0) ? (
        <div className="dash-surface rounded-2xl border border-white/10 text-center py-16 text-white/40">
          <div className="text-4xl mb-2">💬</div>
          <p className="font-medium">{t('msg.empty')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tips.map((tp) => {
            const wa = tp.supporter_phone ? tp.supporter_phone.replace(/[^\d]/g, '') : null;
            return (
              <div key={tp.id} className="dash-surface rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-bold">
                    {tp.supporter_name || t('dash.supporterDefault')}{' '}
                    <span className="text-white/40 font-medium text-sm">
                      · {tp.is_amazing ? t('dash.amazing') : t('dash.cupsN', { n: tp.cups })} · {fmtKd(tp.gross_amount_kd)} {t('common.kd')}
                    </span>
                  </div>
                  <span className="text-xs text-white/30 font-num whitespace-nowrap">
                    {tp.paid_at ? new Date(tp.paid_at).toLocaleDateString(dateLoc) : ''}
                  </span>
                </div>

                <p className="text-white/85 bg-white/5 rounded-xl p-3 mb-3">&quot;{tp.message}&quot;</p>

                {/* WhatsApp reply UI — hidden via SHOW_WHATSAPP_REPLY (see top
                    of file). Kept intact for easy re-enable. */}
                {SHOW_WHATSAPP_REPLY && (
                  tp.reply_sent_at ? (
                    <div className="text-sm text-qahwa-accent font-bold">
                      {t('msg.replied')} {tp.reply_type === 'voice_note' ? t('msg.voiceNote') : ''}
                      {tp.reply_content && <span className="text-white/50 font-medium"> — &quot;{tp.reply_content}&quot;</span>}
                    </div>
                  ) : wa ? (
                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 text-sm font-bold rounded-xl bg-qahwa-wa text-white px-4 py-2">
                      {t('msg.replyOnWA')}
                    </a>
                  ) : (
                    <span className="text-sm text-white/30 font-medium">{t('msg.noPhone')}</span>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
