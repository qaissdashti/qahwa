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
