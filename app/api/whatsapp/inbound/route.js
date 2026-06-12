// ============================================================
// FILE: /app/api/whatsapp/inbound/route.js
// PURPOSE: WhatsApp inbound webhook endpoint.
//
// NOTE: The creator "reply loop" has been removed. We no longer
// route creator replies back to supporters over WhatsApp — tip
// notifications are sent by email now, and creators reply to
// supporters manually via a wa.me deep link in the dashboard.
//
// This endpoint is left in place so any still-registered Meta
// webhook subscription keeps getting a 200 (otherwise Meta retries
// aggressively), but it no longer processes inbound messages.
// The GET verification handler is kept so re-verification still
// works if the subscription is ever re-pointed.
// ============================================================

// ── WhatsApp webhook verification (one-time setup) ──────────
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ── Receive inbound messages (no-op) ─────────────────────────
// Reply routing is disabled. Acknowledge with 200 and drop the
// payload so Meta stops retrying.
export async function POST() {
  return new Response('OK', { status: 200 });
}
