// ============================================================
// FILE: /lib/twilio.js
// PURPOSE: Send WhatsApp messages via the Twilio REST API.
//          Currently used only for OTP delivery during creator
//          verification (replaces the old Meta Cloud API path in
//          lib/whatsapp.js).
//
// We hit Twilio's REST API directly with fetch — no `twilio` npm
// package — to keep the dependency surface small. Auth is HTTP
// Basic (Account SID : Auth Token).
//
// Env:
//   TWILIO_ACCOUNT_SID      — ACxxxxxxxx...
//   TWILIO_AUTH_TOKEN       — the account's auth token
//   TWILIO_WHATSAPP_NUMBER  — the From number, e.g. +14155238886
//                             (the Twilio sandbox WhatsApp number;
//                              we default to it if unset)
//
// Twilio's sandbox allows freeform text within the 24h window after
// the recipient joins the sandbox, so we send a plain text body
// rather than a pre-approved template.
// ============================================================

// The Twilio WhatsApp sandbox From number. Used as the default when
// TWILIO_WHATSAPP_NUMBER is not configured.
const SANDBOX_FROM = '+14155238886';

// Ensure a phone is in `whatsapp:+E164` form for Twilio. Strips any
// existing `whatsapp:` prefix and spaces, guarantees a leading `+`.
function toWhatsAppAddress(phone) {
  const clean = String(phone || '')
    .replace(/^whatsapp:/i, '')
    .replace(/\s+/g, '');
  const e164 = clean.startsWith('+') ? clean : `+${clean.replace(/^\+/, '')}`;
  return `whatsapp:${e164}`;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: send an OTP code over WhatsApp via Twilio
// Mirrors the Arabic OTP copy previously in lib/whatsapp.js sendOTP.
// ─────────────────────────────────────────────────────────────

export async function sendWhatsAppOTP({ phone, code }) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_NUMBER || SANDBOX_FROM;

  if (!sid || !token) {
    throw new Error('Twilio not configured — missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  }

  const body =
    `☕ قهوة — رمز التحقق\n\n` +
    `رمزك: *${code}*\n\n` +
    `صالح لمدة 10 دقائق. لا تشارك هذا الرمز مع أحد.`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const params = new URLSearchParams({
    To:   toWhatsAppAddress(phone),
    From: toWhatsAppAddress(from),
    Body: body,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Twilio API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.sid; // Twilio message SID
}
