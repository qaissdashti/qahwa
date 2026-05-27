// ============================================================
// FILE: /lib/whatsapp.js
// PURPOSE: All WhatsApp Business API interactions
//          - Creator tip notification (with reply prompt)
//          - Route creator reply back to supporter
//          - OTP messages during verification
//          - Log every message to whatsapp_messages table
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WA_API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// ─────────────────────────────────────────────────────────────
// CORE SEND FUNCTION
// ─────────────────────────────────────────────────────────────

async function sendWhatsApp(to, payload) {
  const res = await fetch(WA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: sanitisePhone(to),
      ...payload,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.messages?.[0]?.id;
}

// ─────────────────────────────────────────────────────────────
// 1. CREATOR TIP NOTIFICATION
//    Fired from the webhook after tip is marked 'paid'
// ─────────────────────────────────────────────────────────────

export async function sendCreatorNotification({ tip, creator }) {
  const waNumber = creator.whatsapp_number || creator.phone;
  if (!waNumber) return;

  const cups        = tip.cups;
  const isAmazing   = tip.is_amazing;
  const name        = tip.supporter_name || 'شخص ما';
  const amount      = Number(tip.gross_amount_kd).toFixed(3);
  const newBalance  = Number(creator.balance_kd + tip.net_amount_kd).toFixed(3);

  // Build the notification text
  const cupLine   = isAmazing
    ? `☀️ مبلغ حر: *${amount} KD*`
    : `☕ *${cups} ${cups === 1 ? 'قهوة' : 'قهوات'}* · *${amount} KD*`;

  const msgLine   = tip.message
    ? `\n💬 رسالته:\n_"${tip.message}"_`
    : '';

  const body =
    `☕ *قهوة جديدة وصلت!*\n\n` +
    `من: *${name}*\n` +
    `${cupLine}${msgLine}\n\n` +
    `💰 رصيدك الجديد: *${newBalance} KD*\n\n` +
    `للرد على ${name} أرسل رسالتك أو 🎙️ مقطع صوتي هنا 👇`;

  // Send interactive message with quick-reply buttons
  const providerId = await sendWhatsApp(waNumber, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: [
          { type: 'reply', reply: { id: `reply_text_${tip.id}`,  title: '✍️ رد نصي' } },
          { type: 'reply', reply: { id: `view_dash_${tip.id}`,   title: '📊 اللوحة' } },
        ]
      }
    }
  });

  // Log to whatsapp_messages
  await logMessage({
    tip_id:             tip.id,
    creator_id:         creator.id,
    direction:          'outbound',
    recipient_phone:    waNumber,
    message_type:       'tip_notification',
    content:            body,
    provider_message_id: providerId,
  });
}

// ─────────────────────────────────────────────────────────────
// 2. INBOUND WEBHOOK — Creator replies
//    Called from /api/whatsapp/inbound when creator sends a
//    text or voice note in response to a tip notification
// ─────────────────────────────────────────────────────────────

export async function handleCreatorReply({ from, messageType, text, audioId }) {
  // Identify the creator by phone number
  const { data: creator } = await supabase
    .from('creators')
    .select('id, full_name')
    .or(`whatsapp_number.eq.${from},phone.eq.${from}`)
    .single();

  if (!creator) return;

  // Find the most recent paid tip that hasn't been replied to yet
  const { data: tip } = await supabase
    .from('tips')
    .select('id, supporter_phone, supporter_name, message')
    .eq('creator_id', creator.id)
    .eq('status', 'paid')
    .is('reply_sent_at', null)
    .not('supporter_phone', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(1)
    .single();

  if (!tip) return; // No outstanding tip to reply to

  const supporterName = tip.supporter_name || 'الداعم';

  if (messageType === 'text' && text) {
    // ── TEXT REPLY ─────────────────────────────────────────
    await forwardReplyToSupporter({
      tip,
      creator,
      replyType:    'text',
      replyContent: text,
    });

    // Update tip record
    await supabase
      .from('tips')
      .update({
        reply_sent_at:  new Date().toISOString(),
        reply_type:     'text',
        reply_content:  text,
      })
      .eq('id', tip.id);

    // Confirm to creator
    await sendWhatsApp(from, {
      type: 'text',
      text: { body: `✓ تم إيصال ردك لـ ${supporterName} 🎉` }
    });

  } else if (messageType === 'audio' && audioId) {
    // ── VOICE NOTE REPLY ───────────────────────────────────
    // Download voice note from WhatsApp, upload to Supabase Storage
    const voiceUrl = await downloadAndStoreVoiceNote(audioId, tip.id);

    await forwardVoiceNoteToSupporter({ tip, creator, voiceUrl });

    await supabase
      .from('tips')
      .update({
        reply_sent_at:   new Date().toISOString(),
        reply_type:      'voice_note',
        reply_voice_url: voiceUrl,
      })
      .eq('id', tip.id);

    await sendWhatsApp(from, {
      type: 'text',
      text: { body: `✓ تم إيصال رسالتك الصوتية لـ ${supporterName} 🎉` }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 3. FORWARD REPLY TO SUPPORTER
// ─────────────────────────────────────────────────────────────

async function forwardReplyToSupporter({ tip, creator, replyType, replyContent }) {
  if (!tip.supporter_phone) return;

  const header =
    `*${creator.full_name}* ردّت على قهوتك ☕\n\n`;

  const body = replyType === 'text'
    ? header + `_"${replyContent}"_`
    : header + `🎙️ رسالة صوتية من ${creator.full_name}`;

  // Nudge to tip again
  const footer = '\n\n اضغط لإرسال قهوة أخرى 👇';

  const providerId = await sendWhatsApp(tip.supporter_phone, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body + footer },
      action: {
        buttons: [
          {
            type:  'url',
            // "reply" button opens the creator's tipping page
            reply: { id: 'tip_again', title: '☕ أرسل قهوة أخرى' }
          }
        ]
      }
    }
  });

  // Log supporter receipt
  await logMessage({
    tip_id:              tip.id,
    creator_id:          creator.id,
    direction:           'outbound',
    recipient_phone:     tip.supporter_phone,
    message_type:        'supporter_receipt',
    content:             body,
    provider_message_id: providerId,
  });
}

async function forwardVoiceNoteToSupporter({ tip, creator, voiceUrl }) {
  if (!tip.supporter_phone) return;

  // First send a text header
  await sendWhatsApp(tip.supporter_phone, {
    type: 'text',
    text: { body: `*${creator.full_name}* أرسلت لكَ رسالة صوتية ردًا على قهوتك ☕` }
  });

  // Then send the audio file
  await sendWhatsApp(tip.supporter_phone, {
    type: 'audio',
    audio: { link: voiceUrl }
  });
}

// ─────────────────────────────────────────────────────────────
// 4. OTP VERIFICATION MESSAGE
// ─────────────────────────────────────────────────────────────

export async function sendOTP({ phone, code, creatorId }) {
  const body =
    `☕ *قهوة — رمز التحقق*\n\n` +
    `رمزك: *${code}*\n\n` +
    `صالح لمدة 10 دقائق. لا تشارك هذا الرمز مع أحد.`;

  const providerId = await sendWhatsApp(phone, {
    type: 'text',
    text: { body }
  });

  await logMessage({
    creator_id:          creatorId,
    direction:           'outbound',
    recipient_phone:     phone,
    message_type:        'otp',
    content:             `OTP sent to ${phone}`,
    provider_message_id: providerId,
  });
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function downloadAndStoreVoiceNote(audioId, tipId) {
  // 1. Get media URL from WhatsApp
  const mediaRes = await fetch(
    `https://graph.facebook.com/v19.0/${audioId}`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` } }
  );
  const { url } = await mediaRes.json();

  // 2. Download audio bytes
  const audioRes = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}` }
  });
  const buffer = Buffer.from(await audioRes.arrayBuffer());

  // 3. Upload to Supabase Storage (private bucket)
  const path = `${tipId}-${Date.now()}.ogg`;
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabaseAdmin.storage
    .from('voice-notes')
    .upload(path, buffer, { contentType: 'audio/ogg', upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  // The bucket is PRIVATE — getPublicUrl would not authorize. Hand WhatsApp
  // a signed URL (valid long enough for Meta to fetch + a retry window).
  const { data, error: signErr } = await supabaseAdmin.storage
    .from('voice-notes')
    .createSignedUrl(path, 60 * 60 * 24); // 24h

  if (signErr || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${signErr?.message || 'unknown'}`);
  }

  return data.signedUrl;
}

async function logMessage(fields) {
  await supabase.from('whatsapp_messages').insert({
    ...fields,
    status: 'sent',
  });
}

function sanitisePhone(phone) {
  // Ensure E.164 format e.g. +96591234567 → 96591234567
  return phone.replace(/^\+/, '').replace(/\s+/g, '');
}
