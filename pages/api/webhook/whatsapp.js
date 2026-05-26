/**
 * pages/api/webhook/whatsapp.js
 * POST /api/webhook/whatsapp
 *
 * 360dialog calls this when:
 *  a) Creator taps "رد سريع" button in WA → routes their reply to the supporter
 *  b) Creator sends a free-text reply → same routing
 *  c) Creator sends a voice note → forwards audio to supporter
 *
 * Flow:
 *  1. Parse inbound message from 360dialog payload
 *  2. Check if it's a button reply (quick reply) or free text or audio
 *  3. Find the tip linked to this conversation
 *  4. Forward reply to supporter
 *  5. Update tip.reply_sent_at and tip.reply_content in DB
 *  6. Log in whatsapp_messages
 */

import { supabaseAdmin } from '../../../lib/supabase';
import { forwardCreatorReplyToSupporter, forwardVoiceNoteToSupporter } from '../../../lib/whatsapp';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Always ack immediately
  res.status(200).json({ received: true });

  try {
    await processInboundMessage(req.body);
  } catch (err) {
    console.error('[wa-webhook]', err);
  }
}

async function processInboundMessage(body) {
  // 360dialog payload structure
  const messages = body?.messages;
  if (!messages?.length) return;

  for (const msg of messages) {
    const senderPhone = msg.from; // creator's WA number
    const msgType     = msg.type; // text | interactive | audio

    // ── find creator by WA number ───────────────────────────────────────
    const { data: creator } = await supabaseAdmin
      .from('creators')
      .select('id, full_name, handle')
      .eq('whatsapp_number', `+${senderPhone}`)
      .single();

    if (!creator) {
      console.log(`[wa-webhook] Unknown sender ${senderPhone} — ignoring`);
      return;
    }

    // ── find the most recent PAID tip waiting for a reply ───────────────
    const { data: tip } = await supabaseAdmin
      .from('tips')
      .select('id, supporter_phone, supporter_name, message, gross_amount_kd, cups')
      .eq('creator_id', creator.id)
      .eq('status', 'paid')
      .is('reply_sent_at', null)
      .not('whatsapp_notified_at', 'is', null) // only tips we notified about
      .order('paid_at', { ascending: false })
      .limit(1)
      .single();

    if (!tip) {
      console.log(`[wa-webhook] No pending reply tip for creator ${creator.id}`);
      return;
    }

    // ── parse message content ───────────────────────────────────────────
    let replyText  = null;
    let replyType  = 'text';
    let voiceUrl   = null;
    let tipIdFromButton = null;

    if (msgType === 'interactive' && msg.interactive?.type === 'button_reply') {
      // Creator tapped quick-reply button
      const buttonId = msg.interactive.button_reply.id; // e.g. "reply_tip_<uuid>"
      if (buttonId === 'dashboard') return; // they just wanted to open dashboard

      // Extract tip ID if encoded in button
      const match = buttonId.match(/reply_tip_(.+)/);
      if (match) tipIdFromButton = match[1];

      // The button tap itself doesn't carry text — wait for their next message
      // Send a prompt
      await sendPromptToContinue(creator.whatsapp_number, tip.supporter_name);
      return;

    } else if (msgType === 'text') {
      replyText = msg.text?.body?.trim();
      replyType = 'text';

    } else if (msgType === 'audio') {
      // Creator sent a voice note
      const mediaId = msg.audio?.id;
      voiceUrl = await downloadAndStoreVoiceNote(mediaId, tip.id);
      replyType = 'voice_note';
      replyText = null;

    } else {
      console.log(`[wa-webhook] Unhandled message type: ${msgType}`);
      return;
    }

    // ── forward to supporter ────────────────────────────────────────────
    let waMessageId = null;

    if (tip.supporter_phone) {
      if (replyType === 'text' && replyText) {
        waMessageId = await forwardCreatorReplyToSupporter({
          supporterPhone: tip.supporter_phone,
          creatorName:    creator.full_name,
          replyText,
          tipCups:        tip.cups,
          tipAmount:      tip.gross_amount_kd,
        });
      } else if (replyType === 'voice_note' && voiceUrl) {
        waMessageId = await forwardVoiceNoteToSupporter({
          supporterPhone: tip.supporter_phone,
          creatorName:    creator.full_name,
          audioUrl:       voiceUrl,
        });
      }
    }

    // ── update tip in DB ────────────────────────────────────────────────
    await supabaseAdmin
      .from('tips')
      .update({
        reply_sent_at:  new Date().toISOString(),
        reply_type:     replyType,
        reply_content:  replyText,
        reply_voice_url: voiceUrl,
      })
      .eq('id', tip.id);

    // ── log messages ────────────────────────────────────────────────────
    // Log inbound (creator → platform)
    await supabaseAdmin.from('whatsapp_messages').insert({
      tip_id:          tip.id,
      creator_id:      creator.id,
      direction:       'inbound',
      recipient_phone: process.env.WHATSAPP_PLATFORM_NUMBER,
      message_type:    'creator_reply',
      content:         replyText,
      voice_url:       voiceUrl,
      status:          'delivered',
    });

    // Log outbound to supporter (if sent)
    if (waMessageId && tip.supporter_phone) {
      await supabaseAdmin.from('whatsapp_messages').insert({
        tip_id:              tip.id,
        creator_id:          creator.id,
        direction:           'outbound',
        recipient_phone:     tip.supporter_phone,
        message_type:        'supporter_receipt',
        content:             replyText,
        voice_url:           voiceUrl,
        provider_message_id: waMessageId,
        status:              'sent',
      });
    }

    console.log(`[wa-webhook] Reply forwarded — tip ${tip.id} | creator ${creator.handle} | type ${replyType}`);
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function sendPromptToContinue(creatorWaNumber, supporterName) {
  // Send a gentle nudge asking the creator to type their reply
  const { sendWAMessage } = await import('../../lib/whatsapp');
  // This is an internal helper — simplified here
  console.log(`[wa-webhook] Prompting creator to type reply for ${supporterName}`);
}

async function downloadAndStoreVoiceNote(mediaId, tipId) {
  // 1. Get media URL from 360dialog
  const urlRes = await fetch(`https://waba.360dialog.io/v1/media/${mediaId}`, {
    headers: { 'D360-API-KEY': process.env.WHATSAPP_API_TOKEN },
  });
  if (!urlRes.ok) throw new Error('Failed to get media URL');
  const { url } = await urlRes.json();

  // 2. Download audio bytes
  const audioRes = await fetch(url, {
    headers: { 'D360-API-KEY': process.env.WHATSAPP_API_TOKEN },
  });
  const audioBuffer = await audioRes.arrayBuffer();

  // 3. Upload to Supabase Storage (private voice-notes bucket)
  const fileName = `voice-notes/${tipId}/${Date.now()}.ogg`;
  const { data, error } = await supabaseAdmin.storage
    .from('voice-notes')
    .upload(fileName, Buffer.from(audioBuffer), {
      contentType: 'audio/ogg',
      upsert: false,
    });

  if (error) throw error;

  // 4. Get signed URL (valid 7 days — enough to forward to supporter)
  const { data: signed } = await supabaseAdmin.storage
    .from('voice-notes')
    .createSignedUrl(fileName, 60 * 60 * 24 * 7);

  return signed?.signedUrl || null;
}
