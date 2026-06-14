// ============================================================
// FILE: /app/api/contact/route.js
// PURPOSE: Receive the public "Contact us" form, run spam checks,
//          then email the message to the Qahwa inbox via Resend.
//
// Spam protection, in order (cheapest first):
//   1. Honeypot — a CSS-hidden `website` field. Real users never
//      see it; bots fill it. If present → pretend success, send nothing.
//   2. Per-IP rate limit — in-memory sliding window (basic; per
//      serverless instance). Blocks rapid repeat submissions.
//   3. Cloudflare Turnstile — verify the token server-side against
//      siteverify before sending. Skipped only when TURNSTILE_SECRET_KEY
//      is unset (local dev), mirroring the app's no-key no-op pattern.
// ============================================================

import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TO   = process.env.CONTACT_EMAIL_TO || 'qaissdashti@gmail.com';
const FROM = process.env.ADMIN_EMAIL_FROM || 'Qahwa <hello@buymeqahwa.com>';

// ── per-IP rate limit (in-memory sliding window) ──────────────
const RL_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RL_MAX       = 5;              // max submissions per window per IP
const hits = new Map();              // ip → number[] (timestamps)

function rateLimited(ip, now) {
  const arr = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RL_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // No secret configured (e.g. local dev) → skip the check.
    console.warn('[contact] TURNSTILE_SECRET_KEY unset — skipping Turnstile verification');
    return true;
  }
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    return data?.success === true;
  } catch (err) {
    console.error('[contact] turnstile verify threw', err);
    return false;
  }
}

export async function POST(req) {
  let payload;
  try { payload = await req.json(); } catch { return Response.json({ error: 'bad_request' }, { status: 400 }); }

  const name    = String(payload?.name || '').trim().slice(0, 100);
  const email   = String(payload?.email || '').trim().slice(0, 200);
  const subject = String(payload?.subject || '').trim().slice(0, 150);
  const message = String(payload?.message || '').trim().slice(0, 5000);
  const honeypot = String(payload?.website || '').trim(); // CSS-hidden field
  const token   = payload?.turnstileToken;

  // 1. Honeypot — silently accept (so the bot believes it worked) and bail.
  if (honeypot) {
    return Response.json({ ok: true });
  }

  // 2. Per-IP rate limit.
  const ip = clientIp(req);
  if (rateLimited(ip, Date.now())) {
    return Response.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Field validation.
  if (!name || !email || !subject || !message) {
    return Response.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'invalid_email' }, { status: 400 });
  }

  // 3. Turnstile.
  const human = await verifyTurnstile(token, ip);
  if (!human) {
    return Response.json({ error: 'turnstile_failed' }, { status: 403 });
  }

  // Send the email.
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('[contact] RESEND_API_KEY unset — cannot send');
    return Response.json({ error: 'send_failed' }, { status: 503 });
  }

  const html =
    `<div style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0D0D0D">` +
    `<h2 style="margin:0 0 16px">New contact message</h2>` +
    `<table style="font-size:14px;line-height:1.6">` +
    `<tr><td style="padding:2px 12px 2px 0;color:#666">Name</td><td style="font-weight:700">${esc(name)}</td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#666">Email</td><td style="font-weight:700">${esc(email)}</td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#666">Subject</td><td style="font-weight:700">${esc(subject)}</td></tr>` +
    `</table>` +
    `<p style="margin:16px 0 6px;color:#666;font-size:13px">Message</p>` +
    `<div style="white-space:pre-wrap;border:1px solid #eee;border-radius:8px;padding:12px;font-size:14px">${esc(message)}</div>` +
    `<p style="margin-top:20px;color:#999;font-size:12px">Sent from the buymeqahwa.com contact form · reply directly to respond.</p>` +
    `</div>`;

  const text = `New contact message\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`;

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: email,
      subject: `[Contact] ${subject}`,
      html,
      text,
    });
    if (error) {
      console.error('[contact] resend error', error);
      return Response.json({ error: 'send_failed' }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[contact] send threw', err);
    return Response.json({ error: 'send_failed' }, { status: 500 });
  }
}
