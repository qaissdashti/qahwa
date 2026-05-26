// ============================================================
// FILE: /app/api/whatsapp/inbound/route.js
// PURPOSE: Receive inbound WhatsApp messages from creators
//          (replies to tip notifications, voice notes)
//          Also handles GET request for webhook verification
// ============================================================

import { handleCreatorReply } from '@/lib/whatsapp';

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

// ── Receive inbound messages ─────────────────────────────────
export async function POST(req) {
  const body = await req.json();

  try {
    const entry    = body.entry?.[0];
    const changes  = entry?.changes?.[0];
    const value    = changes?.value;
    const messages = value?.messages;

    if (!messages?.length) {
      return new Response('OK', { status: 200 });
    }

    for (const msg of messages) {
      const from = msg.from; // sender's phone number

      if (msg.type === 'text') {
        await handleCreatorReply({
          from,
          messageType: 'text',
          text: msg.text?.body,
        });

      } else if (msg.type === 'audio') {
        await handleCreatorReply({
          from,
          messageType: 'audio',
          audioId: msg.audio?.id,
        });

      } else if (msg.type === 'interactive') {
        // Handle quick-reply button taps
        const replyId = msg.interactive?.button_reply?.id || '';
        if (replyId.startsWith('reply_text_')) {
          // Creator tapped "Reply" button — send them a prompt
          const { sendWhatsApp } = await import('@/lib/whatsapp');
          // (internal helper — just prompt creator to type their reply)
        }
      }
    }
  } catch (err) {
    console.error('[wa/inbound] Error:', err);
    // Always return 200 to WhatsApp — otherwise they retry aggressively
  }

  return new Response('OK', { status: 200 });
}
