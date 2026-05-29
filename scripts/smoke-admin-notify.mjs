// Smoke test for lib/adminNotify.js → notifyAdminPendingReview().
// Loads .env.local the same way scripts/seed.mjs does and calls the
// Resend SDK with the exact same content shape the real route builds.
//
//   node scripts/smoke-admin-notify.mjs
//
import { readFileSync } from 'node:fs';
import { Resend } from 'resend';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const apiKey = process.env.RESEND_API_KEY;
const to     = process.env.ADMIN_EMAIL;
const from   = process.env.ADMIN_EMAIL_FROM || 'Qahwa <onboarding@resend.dev>';
const base   = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

if (!apiKey) { console.error('✕ RESEND_API_KEY is empty'); process.exit(1); }
if (!to)     { console.error('✕ ADMIN_EMAIL is empty');    process.exit(1); }

// Same payload notifyAdminPendingReview would build for a fake creator.
const fullName = 'Smoke Test Creator';
const handle   = 'smoketest';
const email    = 'smoketest@example.com';
const link     = `${base.replace(/\/+$/, '')}/admin/verifications`;

const subject = `New creator pending review — @${handle}`;
const text    =
  `A new creator just finished onboarding and is awaiting review.\n\n` +
  `Name:   ${fullName}\n` +
  `Handle: @${handle}\n` +
  `Email:  ${email}\n\n` +
  `Review them: ${link}\n\n` +
  `[This is a smoke test sent via scripts/smoke-admin-notify.mjs]`;

const html =
  `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0D0D0D">` +
  `<h2 style="margin:0 0 16px;font-family:Fraunces,sans-serif">New creator pending review</h2>` +
  `<p style="margin:0 0 16px;line-height:1.5">A new creator just finished onboarding and is awaiting your review.</p>` +
  `<table style="border-collapse:collapse;margin:0 0 20px">` +
    `<tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td style="padding:4px 0;font-weight:700">${fullName}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#666">Handle</td><td style="padding:4px 0;font-weight:700">@${handle}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td style="padding:4px 0;font-weight:700">${email}</td></tr>` +
  `</table>` +
  `<a href="${link}" style="display:inline-block;background:#C8F55A;color:#0D0D0D;padding:12px 20px;border-radius:12px;border:2px solid #0D0D0D;box-shadow:3px 3px 0 #0D0D0D;font-weight:800;text-decoration:none">Review verification →</a>` +
  `<p style="margin:24px 0 0;color:#888;font-size:12px">Qahwa ☕ admin notification · smoke test</p>` +
  `</div>`;

console.log('→ from:   ', from);
console.log('→ to:     ', to);
console.log('→ subject:', subject);
console.log('→ link:   ', link);
console.log('');

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({ from, to, subject, html, text });

if (error) {
  console.error('✕ Resend error:', JSON.stringify(error, null, 2));
  process.exit(1);
}
console.log('✓ Sent. Resend message id:', data?.id);
