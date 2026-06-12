// ============================================================
// FILE: /lib/whatsapp.js
// PURPOSE: (LEGACY — mostly retired)
//
// This module used to drive every WhatsApp Business API
// interaction via the Meta Cloud API:
//   - Creator tip notifications (now sent by email — see
//     notifyCreatorNewTip in lib/adminNotify.js)
//   - Routing creator replies back to supporters (the
//     "reply loop" — removed; creators reply manually via a
//     wa.me deep link in the dashboard)
//   - OTP delivery (now sent via Twilio — see lib/twilio.js)
//
// All that remains here is logMessage(), kept so existing rows
// in the whatsapp_messages table can still be appended to if
// any future code wants an audit trail. It is no longer on any
// critical path.
//
// The old sendCreatorNotification / handleCreatorReply /
// forwardReplyToSupporter / forwardVoiceNoteToSupporter /
// downloadAndStoreVoiceNote / sendOTP / sendWhatsApp helpers
// have been removed. See git history if you need them back.
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────
// Audit log helper (non-critical)
// ─────────────────────────────────────────────────────────────

export async function logMessage(fields) {
  await supabase.from('whatsapp_messages').insert({
    ...fields,
    status: 'sent',
  });
}
