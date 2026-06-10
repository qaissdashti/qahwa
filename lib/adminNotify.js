// ============================================================
// FILE: /lib/adminNotify.js
// PURPOSE: God-admin notifications for events that need a
//          human in the loop (right now: new creator awaiting
//          verification review).
//
// Channels
//   1. Email — Resend transactional API. No-ops with a log line
//              when RESEND_API_KEY or ADMIN_EMAIL is missing, so
//              the request that triggered it never fails because
//              of a missing notification key.
//   2. WhatsApp — placeholder. Logs intent only. Wires up to
//                 sendAdminWhatsApp() (Meta Graph API) the moment
//                 both WHATSAPP_API_TOKEN and ADMIN_WHATSAPP_PHONE
//                 are set; until then it just records what *would*
//                 have been sent.
//
// All functions swallow their own errors — a failed notification
// must never block onboarding.
// ============================================================

import { Resend } from 'resend';
import { getBaseUrl } from '@/lib/baseUrl';

// ─────────────────────────────────────────────────────────────
// Email (Resend SDK)
// ─────────────────────────────────────────────────────────────
// Lazy-construct so a missing key at module load doesn't crash the
// build (same pattern we use for encryption + payment fallback).
let _resend = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

async function sendEmail({ to, subject, html, text }) {
  const from = process.env.ADMIN_EMAIL_FROM || 'Qahwa <onboarding@resend.dev>';
  const client = getResend();

  if (!client || !to) {
    console.log('[adminNotify/email] skipped — missing RESEND_API_KEY or recipient', { to, subject });
    return { skipped: true };
  }

  try {
    const { data, error } = await client.emails.send({ from, to, subject, html, text });
    if (error) {
      console.error('[adminNotify/email] resend error', { to, subject, error });
      return { ok: false, error };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('[adminNotify/email] threw', err);
    return { ok: false, error: String(err) };
  }
}

// Back-compat shim so the rest of the file (and any old callers) can keep
// using sendAdminEmail() — it just targets ADMIN_EMAIL.
async function sendAdminEmail(args) {
  return sendEmail({ ...args, to: process.env.ADMIN_EMAIL });
}

// ─────────────────────────────────────────────────────────────
// WhatsApp (placeholder — logs only until wired)
// ─────────────────────────────────────────────────────────────

async function sendAdminWhatsApp({ body }) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const adminPhone = process.env.ADMIN_WHATSAPP_PHONE;

  // Without both a token AND a target admin number, this is a no-op.
  // We deliberately log the *body* that would have been sent so we can
  // verify wiring during testing.
  if (!token || !adminPhone) {
    console.log('[adminNotify/wa] skipped (placeholder) — would send to admin:', body);
    return { skipped: true };
  }

  // When both are configured, send via Meta Graph API. We import lazily
  // so the email path doesn't drag in WhatsApp setup at module load.
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: String(adminPhone).replace(/\D/g, ''),
        type: 'text',
        text: { body },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[adminNotify/wa] graph error', res.status, txt);
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.error('[adminNotify/wa] threw', err);
    return { ok: false, error: String(err) };
  }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: new creator pending review
// Fired from /api/verify/selfie right after verification_status
// flips to 'under_review'.
// ─────────────────────────────────────────────────────────────

export async function notifyAdminPendingReview({ fullName, handle, email }) {
  const link = `${getBaseUrl()}/admin/verifications`;
  const safeName = (fullName || '—').toString();
  const safeHandle = (handle || '—').toString();
  const safeEmail = (email || '—').toString();

  const subject = `New creator pending review — @${safeHandle}`;

  const text =
    `A new creator just finished onboarding and is awaiting review.\n\n` +
    `Name:   ${safeName}\n` +
    `Handle: @${safeHandle}\n` +
    `Email:  ${safeEmail}\n\n` +
    `Review them: ${link}\n`;

  const html =
    `<div style="font-family:'Plus Jakarta Sans',-apple-system,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0D0D0D">` +
    `<h2 style="margin:0 0 16px;font-family:'Plus Jakarta Sans',sans-serif">New creator pending review</h2>` +
    `<p style="margin:0 0 16px;line-height:1.5">A new creator just finished onboarding and is awaiting your review.</p>` +
    `<table style="border-collapse:collapse;margin:0 0 20px">` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td style="padding:4px 0;font-weight:700">${escapeHtml(safeName)}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Handle</td><td style="padding:4px 0;font-weight:700">@${escapeHtml(safeHandle)}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td style="padding:4px 0;font-weight:700">${escapeHtml(safeEmail)}</td></tr>` +
    `</table>` +
    `<a href="${link}" style="display:inline-block;background:#C8F55A;color:#0D0D0D;padding:12px 20px;border-radius:12px;border:2px solid #0D0D0D;box-shadow:3px 3px 0 #0D0D0D;font-weight:800;text-decoration:none">Review verification →</a>` +
    `<p style="margin:24px 0 0;color:#888;font-size:12px">Qahwa ☕ admin notification</p>` +
    `</div>`;

  const waBody =
    `☕ Qahwa — new creator pending review\n` +
    `${safeName} (@${safeHandle})\n` +
    `${safeEmail}\n` +
    `Review: ${link}`;

  // Fire both in parallel; never let one block the other or the caller.
  const [emailRes, waRes] = await Promise.allSettled([
    sendAdminEmail({ subject, text, html }),
    sendAdminWhatsApp({ body: waBody }),
  ]);

  return {
    email:    emailRes.status === 'fulfilled' ? emailRes.value : { ok: false, error: String(emailRes.reason) },
    whatsapp: waRes.status    === 'fulfilled' ? waRes.value    : { ok: false, error: String(waRes.reason) },
  };
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: creator submitted a payout request
// Fires TWO emails in parallel from /api/creator/payout:
//   1. Confirmation to the creator ("we received your request")
//   2. Notification to the god admin ("new payout request — review")
// ─────────────────────────────────────────────────────────────

export async function notifyPayoutRequested({ creatorEmail, fullName, handle, amount, bankName }) {
  const amt   = fmtKd(amount);
  const link  = `${getBaseUrl()}/admin/payouts`;
  const safeName   = (fullName || '—').toString();
  const safeHandle = (handle || '—').toString();
  const safeBank   = (bankName || '—').toString();
  const safeEmail  = (creatorEmail || '—').toString();

  // ── 1. Creator confirmation ──────────────────────────────────
  const creatorSubject = `Payout request received — ${amt} KD`;
  const creatorText =
    `We received your request for ${amt} KD and will transfer it ` +
    `within 2-3 business days. You'll hear from us once it's sent.\n\n` +
    `— Qahwa ☕`;
  const creatorHtml =
    `<div style="font-family:'Plus Jakarta Sans',-apple-system,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0D0D0D">` +
    `<h2 style="margin:0 0 16px;font-family:'Plus Jakarta Sans',sans-serif">Payout request received</h2>` +
    `<p style="margin:0 0 16px;line-height:1.6">We received your request for ` +
      `<strong style="font-family:monospace">${amt} KD</strong> and will transfer it within ` +
      `<strong>2-3 business days</strong>. You'll hear from us once it's sent.</p>` +
    `<p style="margin:24px 0 0;color:#888;font-size:12px">Qahwa ☕</p>` +
    `</div>`;

  // ── 2. Admin notification ────────────────────────────────────
  const adminSubject = `New payout request — @${safeHandle} wants ${amt} KD`;
  const adminText =
    `A creator just requested a payout.\n\n` +
    `Name:    ${safeName}\n` +
    `Handle:  @${safeHandle}\n` +
    `Email:   ${safeEmail}\n` +
    `Amount:  ${amt} KD\n` +
    `Bank:    ${safeBank}\n\n` +
    `Review the queue: ${link}\n`;
  const adminHtml =
    `<div style="font-family:'Plus Jakarta Sans',-apple-system,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0D0D0D">` +
    `<h2 style="margin:0 0 16px;font-family:'Plus Jakarta Sans',sans-serif">New payout request</h2>` +
    `<p style="margin:0 0 16px;line-height:1.5">A creator just requested a payout.</p>` +
    `<table style="border-collapse:collapse;margin:0 0 20px">` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td style="padding:4px 0;font-weight:700">${escapeHtml(safeName)}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Handle</td><td style="padding:4px 0;font-weight:700">@${escapeHtml(safeHandle)}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td style="padding:4px 0;font-weight:700;font-family:monospace">${escapeHtml(amt)} KD</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Bank</td><td style="padding:4px 0;font-weight:700">${escapeHtml(safeBank)}</td></tr>` +
    `</table>` +
    `<a href="${link}" style="display:inline-block;background:#C8F55A;color:#0D0D0D;padding:12px 20px;border-radius:12px;border:2px solid #0D0D0D;box-shadow:3px 3px 0 #0D0D0D;font-weight:800;text-decoration:none">Review payouts →</a>` +
    `<p style="margin:24px 0 0;color:#888;font-size:12px">Qahwa ☕ admin notification</p>` +
    `</div>`;

  const waBody =
    `☕ Qahwa — new payout request\n` +
    `${safeName} (@${safeHandle}) — ${amt} KD\n` +
    `Bank: ${safeBank}\n` +
    `Queue: ${link}`;

  const [creatorRes, adminRes, waRes] = await Promise.allSettled([
    sendEmail({ to: creatorEmail, subject: creatorSubject, text: creatorText, html: creatorHtml }),
    sendAdminEmail({ subject: adminSubject, text: adminText, html: adminHtml }),
    sendAdminWhatsApp({ body: waBody }),
  ]);

  return {
    creator:  creatorRes.status === 'fulfilled' ? creatorRes.value : { ok: false, error: String(creatorRes.reason) },
    admin:    adminRes.status   === 'fulfilled' ? adminRes.value   : { ok: false, error: String(adminRes.reason) },
    whatsapp: waRes.status      === 'fulfilled' ? waRes.value      : { ok: false, error: String(waRes.reason) },
  };
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: admin marked a payout as paid
// Fires a single email to the creator confirming the transfer.
// ─────────────────────────────────────────────────────────────

export async function notifyPayoutPaid({ creatorEmail, amount }) {
  const amt = fmtKd(amount);
  const subject = `Your payout of ${amt} KD has been sent`;
  const text =
    `Your ${amt} KD has been transferred to your bank account. ` +
    `It may take 1-2 business days to appear.\n\n— Qahwa ☕`;
  const html =
    `<div style="font-family:'Plus Jakarta Sans',-apple-system,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0D0D0D">` +
    `<h2 style="margin:0 0 16px;font-family:'Plus Jakarta Sans',sans-serif">Your payout is on the way ✓</h2>` +
    `<p style="margin:0 0 16px;line-height:1.6">Your ` +
      `<strong style="font-family:monospace">${amt} KD</strong> has been transferred to your bank account. ` +
      `It may take <strong>1-2 business days</strong> to appear.</p>` +
    `<p style="margin:24px 0 0;color:#888;font-size:12px">Qahwa ☕</p>` +
    `</div>`;

  return sendEmail({ to: creatorEmail, subject, text, html });
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: creator welcome (page under review)
// Fired from /api/verify/selfie alongside notifyAdminPendingReview
// — the supporter sees a warm welcome the moment they finish step
// 5, while the admin gets their review-queue ping in parallel.
// `lang` is the supporter's chosen UI language ('ar' or 'en');
// defaults to 'en' on anything else so a missing/malformed value
// never blocks the send.
// ─────────────────────────────────────────────────────────────

export async function notifyCreatorWelcome({ creatorEmail, fullName, handle, lang }) {
  if (!creatorEmail) {
    console.log('[adminNotify/welcome] skipped — no creatorEmail');
    return { skipped: true };
  }
  const ar = lang === 'ar';
  const safeName   = (fullName || (ar ? 'صديقنا' : 'there')).toString();
  const safeHandle = (handle || '—').toString();
  const link       = `${getBaseUrl()}/${safeHandle}`;

  // ── Subject ──────────────────────────────────────────────────
  const subject = ar
    ? `مرحباً بك في قهوة ☕ — صفحتك قيد المراجعة`
    : `Welcome to Qahwa ☕ — Your page is under review`;

  // ── Plain text (mirrors the html copy 1:1) ───────────────────
  const text = ar
    ? `أهلاً ${safeName}! 👋\n\n` +
      `شكراً لانضمامك لقهوة. صفحتك دخلت قائمة المراجعة الآن.\n\n` +
      `🕒 صفحتك قيد المراجعة — راح نفعّلها خلال 24 ساعة.\n\n` +
      `بمجرد الموافقة، يقدر داعموك يبدأون يرسلون لك قهوة ☕.\n` +
      `صفحتك ستكون على: ${link}\n\n` +
      `ايش يصير بعد؟\n` +
      `  · نراجع التحقق — عادة خلال 24 ساعة\n` +
      `  · نرسل لك بريد لحظة تفعيل الصفحة\n` +
      `  · بعدها شارك الرابط في باي‌و وستوريك، يبدأ الدعم 🚀\n\n` +
      `— قهوة ☕\n`
    : `Hi ${safeName}! 👋\n\n` +
      `Thanks for joining Qahwa — your creator page is in the review queue.\n\n` +
      `🕒 Your page is under review — we'll activate it within 24 hours.\n\n` +
      `Once approved, supporters can start sending you coffees ☕.\n` +
      `Your page will live at: ${link}\n\n` +
      `What happens next?\n` +
      `  · We review your verification — usually within 24 hours\n` +
      `  · You'll get an email the moment your page goes live\n` +
      `  · Then share your link in your bio or stories and let the support start 🚀\n\n` +
      `— Qahwa ☕\n`;

  // ── HTML ──────────────────────────────────────────────────────
  // Email-client safe styling: 'Plus Jakarta Sans' (matches the
  // other notifiers in this file), inline styles only, accent-yellow
  // brutalist pill for the CTA, lavender soft box for the status.
  const heading = ar ? 'مرحباً بك في قهوة ☕' : 'Welcome to Qahwa ☕';
  const greet = ar
    ? `أهلاً <strong>${escapeHtml(safeName)}</strong>! شكراً لانضمامك لقهوة — صفحتك دخلت قائمة المراجعة.`
    : `Hi <strong>${escapeHtml(safeName)}</strong>! Thanks for joining Qahwa — your creator page is in the review queue.`;
  const statusBox = ar
    ? `🕒 <strong>صفحتك قيد المراجعة</strong> — راح نفعّلها خلال <strong>24 ساعة</strong>.`
    : `🕒 <strong>Your page is under review</strong> — we'll activate it within <strong>24 hours</strong>.`;
  const liveAtLabel = ar ? 'صفحتك ستكون على:' : 'Your page will live at:';
  const onceLabel = ar
    ? `بمجرد الموافقة، يقدر داعموك يبدأون يرسلون لك قهوة ☕.`
    : `Once approved, supporters can start sending you coffees ☕.`;
  const nextLabel = ar ? 'ايش يصير بعد؟' : 'What happens next?';
  const nextItems = ar
    ? ['نراجع التحقق — عادة خلال 24 ساعة',
       'نرسل لك بريد لحظة تفعيل الصفحة',
       'بعدها شارك الرابط في باي‌و وستوريك، يبدأ الدعم 🚀']
    : ['We review your verification — usually within 24 hours',
       'You\'ll get an email the moment your page goes live',
       'Then share your link in your bio or stories and let the support start 🚀'];
  const previewCta = ar ? 'عاين صفحتك ←' : 'Preview your page →';
  const footer = ar ? 'قهوة ☕ — صُنع في الكويت' : 'Qahwa ☕ — Made in Kuwait';
  const dir = ar ? 'rtl' : 'ltr';

  const html =
    `<div dir="${dir}" style="font-family:'Plus Jakarta Sans',-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0D0D0D;line-height:1.55">` +
    `<h2 style="margin:0 0 18px;font-family:'Plus Jakarta Sans',sans-serif;font-size:24px">${heading}</h2>` +
    `<p style="margin:0 0 18px">${greet}</p>` +
    `<div style="background:#EDE4FB;border:2px solid #0D0D0D;border-radius:12px;padding:14px 16px;margin:0 0 18px;font-weight:600">${statusBox}</div>` +
    `<p style="margin:0 0 6px">${onceLabel}</p>` +
    `<p style="margin:0 0 18px;color:#666;font-size:13px">${liveAtLabel}<br>` +
      `<a href="${link}" style="font-family:monospace;color:#7B2FBE;text-decoration:underline;font-weight:700">${escapeHtml(link.replace(/^https?:\/\//, ''))}</a></p>` +
    `<h3 style="margin:24px 0 10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:16px">${nextLabel}</h3>` +
    `<ul style="margin:0 0 22px;padding-${ar ? 'right' : 'left'}:18px">` +
      nextItems.map((it) => `<li style="margin:0 0 6px">${escapeHtml(it)}</li>`).join('') +
    `</ul>` +
    `<p style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#C8F55A;color:#0D0D0D;padding:12px 22px;border-radius:12px;border:2px solid #0D0D0D;box-shadow:3px 3px 0 #0D0D0D;font-weight:800;text-decoration:none">${previewCta}</a></p>` +
    `<p style="margin:28px 0 0;color:#888;font-size:12px">${footer}</p>` +
    `</div>`;

  return sendEmail({ to: creatorEmail, subject, text, html });
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: admin approved the creator's verification
// Fired from /api/admin/verification right after the row update.
// Celebratory: "you're live, here's your link, go share it".
// ─────────────────────────────────────────────────────────────

export async function notifyCreatorApproved({ creatorEmail, fullName, handle, lang }) {
  if (!creatorEmail) {
    console.log('[adminNotify/approved] skipped — no creatorEmail');
    return { skipped: true };
  }
  const ar = (lang === 'ar') || (lang == null && hasArabicScript(fullName));
  const safeName   = (fullName || (ar ? 'صديقنا' : 'there')).toString();
  const safeHandle = (handle || '—').toString();
  const link       = `${getBaseUrl()}/${safeHandle}`;
  const linkPretty = link.replace(/^https?:\/\//, '');

  const subject = ar
    ? `صفحتك على قهوة أصبحت مفعّلة! ☕`
    : `Your Qahwa page is live! ☕`;

  const text = ar
    ? `🎉 صفحتك على قهوة شغّالة!\n\n` +
      `أهلاً ${safeName}! خبر زين — صفحتك تمّت الموافقة عليها وأصبحت مفعّلة.\n\n` +
      `✓ صفحتك مفعّلة على: ${link}\n\n` +
      `هذا وقت المشاركة. ضع رابطك في الباي‌و، الستوريز، أو على البث المباشر — حيث متابعينك.\n\n` +
      `أفكار سريعة:\n` +
      `  · ضعها في باي‌و إنستجرام\n` +
      `  · ثبّتها في حساب X\n` +
      `  · أضفها لوصف يوتيوب أو شات البث\n\n` +
      `— قهوة ☕\n`
    : `🎉 You're live on Qahwa!\n\n` +
      `Hi ${safeName}! Great news — your creator page has been approved and is live.\n\n` +
      `✓ Your page is live at: ${link}\n\n` +
      `Now's the time to share. Drop your link in your bio, stories, or stream — anywhere your fans hang out.\n\n` +
      `Quick wins:\n` +
      `  · Add it to your Instagram bio\n` +
      `  · Pin it to your X / Twitter profile\n` +
      `  · Drop it in a YouTube description or stream chat\n\n` +
      `— Qahwa ☕\n`;

  // Tone for the HTML: warm + celebratory. Accent-green status box
  // (vs lavender used for "under review") so the visual state matches
  // the news. Brutalist CTA pill in accent yellow.
  const heading = ar ? '🎉 صفحتك على قهوة شغّالة!' : "🎉 You're live on Qahwa!";
  const greet = ar
    ? `أهلاً <strong>${escapeHtml(safeName)}</strong>! خبر زين — صفحتك تمّت الموافقة عليها وأصبحت مفعّلة.`
    : `Hi <strong>${escapeHtml(safeName)}</strong>! Great news — your creator page has been approved and is live.`;
  const liveBox = ar
    ? `✓ <strong>صفحتك مفعّلة على:</strong>`
    : `✓ <strong>Your page is live at:</strong>`;
  const shareIntro = ar
    ? `هذا وقت المشاركة. ضع رابطك في الباي‌و، الستوريز، أو على البث المباشر — حيث متابعينك.`
    : `Now's the time to share. Drop your link in your bio, stories, or stream — anywhere your fans hang out.`;
  const tipsLabel = ar ? 'أفكار سريعة:' : 'Quick wins:';
  const tips = ar
    ? ['ضعها في باي‌و إنستجرام',
       'ثبّتها في حساب X',
       'أضفها لوصف يوتيوب أو شات البث']
    : ['Add it to your Instagram bio',
       'Pin it to your X / Twitter profile',
       'Drop it in a YouTube description or stream chat'];
  const cta = ar ? 'افتح صفحتك ←' : 'Open your page →';
  const footer = ar ? 'قهوة ☕ — صُنع في الكويت' : 'Qahwa ☕ — Made in Kuwait';
  const dir = ar ? 'rtl' : 'ltr';

  const html =
    `<div dir="${dir}" style="font-family:'Plus Jakarta Sans',-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0D0D0D;line-height:1.55">` +
    `<h2 style="margin:0 0 18px;font-family:'Plus Jakarta Sans',sans-serif;font-size:24px">${heading}</h2>` +
    `<p style="margin:0 0 18px">${greet}</p>` +
    `<div style="background:#C8F55A;border:2px solid #0D0D0D;border-radius:12px;padding:14px 16px;margin:0 0 22px;box-shadow:3px 3px 0 #0D0D0D">` +
      `<div style="margin:0 0 4px;font-weight:700">${liveBox}</div>` +
      `<a href="${link}" style="font-family:monospace;color:#0D0D0D;text-decoration:underline;font-weight:800">${escapeHtml(linkPretty)}</a>` +
    `</div>` +
    `<p style="margin:0 0 14px">${shareIntro}</p>` +
    `<h3 style="margin:18px 0 8px;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px">${tipsLabel}</h3>` +
    `<ul style="margin:0 0 22px;padding-${ar ? 'right' : 'left'}:18px">` +
      tips.map((it) => `<li style="margin:0 0 6px">${escapeHtml(it)}</li>`).join('') +
    `</ul>` +
    `<p style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#7B2FBE;color:#FFFFFF;padding:12px 22px;border-radius:12px;border:2px solid #0D0D0D;box-shadow:3px 3px 0 #0D0D0D;font-weight:800;text-decoration:none">${cta}</a></p>` +
    `<p style="margin:28px 0 0;color:#888;font-size:12px">${footer}</p>` +
    `</div>`;

  return sendEmail({ to: creatorEmail, subject, text, html });
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: admin rejected the creator's verification
// Fired from /api/admin/verification on the reject branch.
// Supportive: surface reviewer_notes verbatim so the creator knows
// what to fix, then point them back to /onboard to resubmit.
// reasonNote is the free-text comment the admin wrote (mapped from
// `verifications.reviewer_notes` in the route).
// ─────────────────────────────────────────────────────────────

export async function notifyCreatorRejected({ creatorEmail, fullName, handle, reasonNote, lang }) {
  if (!creatorEmail) {
    console.log('[adminNotify/rejected] skipped — no creatorEmail');
    return { skipped: true };
  }
  const ar = (lang === 'ar') || (lang == null && hasArabicScript(fullName));
  const safeName   = (fullName || (ar ? 'صديقنا' : 'there')).toString();
  const safeHandle = (handle || '—').toString();
  const onboardLink = `${getBaseUrl()}/onboard`;
  // Resubmission goes back through /onboard; the public page link is
  // included so the creator can confirm what their public state looks
  // like right now (pending page).
  const pageLink = `${getBaseUrl()}/${safeHandle}`;
  const reason = (reasonNote || '').toString().trim();

  const subject = ar
    ? `تحديث بخصوص صفحتك على قهوة`
    : `Update on your Qahwa page`;

  // Default reason text when admin didn't write notes — keeps the
  // body coherent instead of an empty box.
  const reasonFallback = ar
    ? 'احتجنا منك إعادة إرسال خطوة التحقق. التفاصيل ستصلك من الفريق قريباً.'
    : 'We need you to resubmit your verification step. Our team will follow up with details.';
  const reasonShown = reason || reasonFallback;

  const text = ar
    ? `نحتاج تحديث صغير من جهتك\n\n` +
      `أهلاً ${safeName}، شكراً على إعداد صفحتك. قبل تفعيلها، نحتاج منك تحديث التالي:\n\n` +
      `> ${reasonShown}\n\n` +
      `بعد ما تعالج هذا، أعد الإرسال من خلال صفحة الإعداد وراح نراجع مرة ثانية.\n\n` +
      `أمور تساعدك:\n` +
      `  · التقط سيلفي واضح مع البطاقة المدنية بإضاءة جيدة\n` +
      `  · تأكد كل البيانات واضحة ومقروءة\n` +
      `  · استخدم نفس الاسم والبيانات اللي سجّلت فيها\n\n` +
      `حدّث صفحتك: ${onboardLink}\n\n` +
      `إحنا موجودين للمساعدة — ردّ على هذا البريد إذا أي شي غير واضح.\n` +
      `— قهوة ☕\n`
    : `We need a bit more from you\n\n` +
      `Hi ${safeName}, thanks for setting up your page. Before we can activate it, there's something we'd like you to update:\n\n` +
      `> ${reasonShown}\n\n` +
      `Once you've addressed this, just resubmit through the onboarding flow and we'll review again.\n\n` +
      `A few things that help:\n` +
      `  · Take a clear, well-lit selfie holding your Civil ID\n` +
      `  · Make sure all details are visible and legible\n` +
      `  · Use the same name and details you signed up with\n\n` +
      `Update your page: ${onboardLink}\n\n` +
      `We're here to help — reply to this email if anything is unclear.\n` +
      `— Qahwa ☕\n`;

  const heading = ar ? 'نحتاج تحديث صغير من جهتك' : 'We need a bit more from you';
  const greet = ar
    ? `أهلاً <strong>${escapeHtml(safeName)}</strong>، شكراً على إعداد صفحتك. قبل تفعيلها، نحتاج منك تحديث التالي:`
    : `Hi <strong>${escapeHtml(safeName)}</strong>, thanks for setting up your page. Before we can activate it, there's something we'd like you to update:`;
  const nextLabel = ar
    ? 'بعد ما تعالج هذا، أعد الإرسال من خلال صفحة الإعداد وراح نراجع مرة ثانية.'
    : `Once you've addressed this, just resubmit through the onboarding flow and we'll review again.`;
  const tipsLabel = ar ? 'أمور تساعدك:' : 'A few things that help:';
  const tips = ar
    ? ['التقط سيلفي واضح مع البطاقة المدنية بإضاءة جيدة',
       'تأكد كل البيانات واضحة ومقروءة',
       'استخدم نفس الاسم والبيانات اللي سجّلت فيها']
    : ['Take a clear, well-lit selfie holding your Civil ID',
       'Make sure all details are visible and legible',
       'Use the same name and details you signed up with'];
  const cta = ar ? 'حدّث صفحتك ←' : 'Update your page →';
  const closing = ar
    ? 'إحنا موجودين للمساعدة — ردّ على هذا البريد إذا أي شي غير واضح.'
    : `We're here to help — reply to this email if anything is unclear.`;
  const footer = ar ? 'قهوة ☕ — صُنع في الكويت' : 'Qahwa ☕ — Made in Kuwait';
  const dir = ar ? 'rtl' : 'ltr';

  // Reason box uses lavender (same as the welcome "under review" box) —
  // intentionally NOT a red error tone. The whole email reads as a
  // friendly "here's what to update", not a rejection notice.
  const html =
    `<div dir="${dir}" style="font-family:'Plus Jakarta Sans',-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0D0D0D;line-height:1.55">` +
    `<h2 style="margin:0 0 18px;font-family:'Plus Jakarta Sans',sans-serif;font-size:22px">${heading}</h2>` +
    `<p style="margin:0 0 16px">${greet}</p>` +
    `<div style="background:#EDE4FB;border:2px solid #0D0D0D;border-radius:12px;padding:14px 16px;margin:0 0 18px;font-style:italic">` +
      escapeHtml(reasonShown) +
    `</div>` +
    `<p style="margin:0 0 18px">${nextLabel}</p>` +
    `<h3 style="margin:18px 0 8px;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px">${tipsLabel}</h3>` +
    `<ul style="margin:0 0 22px;padding-${ar ? 'right' : 'left'}:18px">` +
      tips.map((it) => `<li style="margin:0 0 6px">${escapeHtml(it)}</li>`).join('') +
    `</ul>` +
    `<p style="margin:24px 0"><a href="${onboardLink}" style="display:inline-block;background:#C8F55A;color:#0D0D0D;padding:12px 22px;border-radius:12px;border:2px solid #0D0D0D;box-shadow:3px 3px 0 #0D0D0D;font-weight:800;text-decoration:none">${cta}</a></p>` +
    `<p style="margin:18px 0 0;color:#666;font-size:13px">${closing}</p>` +
    `<p style="margin:24px 0 0;color:#888;font-size:12px">${footer}</p>` +
    `</div>`;

  return sendEmail({ to: creatorEmail, subject, text, html });
}

// Heuristic: when the admin route doesn't know the creator's UI
// language preference (we don't store one), inspect the display name
// for any character in the Arabic Unicode block. Roughly: if their
// name is in Arabic script, send the AR email. Latin-script names
// fall through to the EN default. Wrong-guess rate is low and the
// content of both emails is recognisable enough that the worst case
// is a small lang mismatch, never a missing email.
function hasArabicScript(s) {
  if (!s || typeof s !== 'string') return false;
  // Arabic + Arabic Supplement + Extended-A + Presentation Forms A/B.
  // Explicit \u escapes so the regex survives any source-file encoding.
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(s);
}

// 3-decimal KWD format for display in emails.
function fmtKd(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : '0.000';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
