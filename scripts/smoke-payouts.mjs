// Smoke test for the two payout notification helpers in lib/adminNotify.js:
//   - notifyPayoutRequested  → creator confirmation + admin notification
//   - notifyPayoutPaid       → creator transfer-sent email
//
// Hits Resend directly with the same payload shape the helpers build,
// so it stays useful even though we can't `import @/…` from plain Node.
// If the helpers' content changes, mirror the change here.
//
//   node scripts/smoke-payouts.mjs
//
import { readFileSync } from 'node:fs';
import { Resend } from 'resend';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const apiKey   = process.env.RESEND_API_KEY;
const adminTo  = process.env.ADMIN_EMAIL;
const from     = process.env.ADMIN_EMAIL_FROM || 'Qahwa <onboarding@resend.dev>';
const base     = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

if (!apiKey)  { console.error('✕ RESEND_API_KEY is empty'); process.exit(1); }
if (!adminTo) { console.error('✕ ADMIN_EMAIL is empty');    process.exit(1); }

// In Resend testing mode, both creator + admin must be the account owner
// to actually deliver. Force the same address for both.
const creatorEmail = adminTo;
const fullName     = 'Smoke Test Creator';
const handle       = 'smoketest';
const bankName     = 'NBK';
const amount       = 12.5;
const amt          = Number(amount).toFixed(3);
const payoutsLink  = `${base}/admin/payouts`;

const resend = new Resend(apiKey);

// ── 1. Creator confirmation (payout requested) ──────────────────
async function sendCreatorRequested() {
  const subject = `Payout request received — ${amt} KD`;
  const text =
    `We received your request for ${amt} KD and will transfer it ` +
    `within 2-3 business days. You'll hear from us once it's sent.\n\n— Qahwa ☕`;
  const html =
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0D0D0D">` +
    `<h2 style="margin:0 0 16px;font-family:Syne,sans-serif">Payout request received</h2>` +
    `<p style="margin:0 0 16px;line-height:1.6">We received your request for ` +
      `<strong style="font-family:monospace">${amt} KD</strong> and will transfer it within ` +
      `<strong>2-3 business days</strong>. You'll hear from us once it's sent.</p>` +
    `<p style="margin:24px 0 0;color:#888;font-size:12px">Qahwa ☕</p>` +
    `</div>`;
  return resend.emails.send({ from, to: creatorEmail, subject, text, html });
}

// ── 2. Admin notification (payout requested) ────────────────────
async function sendAdminRequested() {
  const subject = `New payout request — @${handle} wants ${amt} KD`;
  const text =
    `A creator just requested a payout.\n\n` +
    `Name:    ${fullName}\n` +
    `Handle:  @${handle}\n` +
    `Email:   ${creatorEmail}\n` +
    `Amount:  ${amt} KD\n` +
    `Bank:    ${bankName}\n\n` +
    `Review the queue: ${payoutsLink}\n`;
  const html =
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0D0D0D">` +
    `<h2 style="margin:0 0 16px;font-family:Syne,sans-serif">New payout request</h2>` +
    `<p style="margin:0 0 16px;line-height:1.5">A creator just requested a payout.</p>` +
    `<table style="border-collapse:collapse;margin:0 0 20px">` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td style="padding:4px 0;font-weight:700">${fullName}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Handle</td><td style="padding:4px 0;font-weight:700">@${handle}</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td style="padding:4px 0;font-weight:700;font-family:monospace">${amt} KD</td></tr>` +
      `<tr><td style="padding:4px 12px 4px 0;color:#666">Bank</td><td style="padding:4px 0;font-weight:700">${bankName}</td></tr>` +
    `</table>` +
    `<a href="${payoutsLink}" style="display:inline-block;background:#C8F55A;color:#0D0D0D;padding:12px 20px;border-radius:12px;border:2px solid #0D0D0D;box-shadow:3px 3px 0 #0D0D0D;font-weight:800;text-decoration:none">Review payouts →</a>` +
    `<p style="margin:24px 0 0;color:#888;font-size:12px">Qahwa ☕ admin notification · smoke test</p>` +
    `</div>`;
  return resend.emails.send({ from, to: adminTo, subject, text, html });
}

// ── 3. Creator notification (payout paid) ────────────────────────
async function sendCreatorPaid() {
  const subject = `Your payout of ${amt} KD has been sent`;
  const text =
    `Your ${amt} KD has been transferred to your bank account. ` +
    `It may take 1-2 business days to appear.\n\n— Qahwa ☕`;
  const html =
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0D0D0D">` +
    `<h2 style="margin:0 0 16px;font-family:Syne,sans-serif">Your payout is on the way ✓</h2>` +
    `<p style="margin:0 0 16px;line-height:1.6">Your ` +
      `<strong style="font-family:monospace">${amt} KD</strong> has been transferred to your bank account. ` +
      `It may take <strong>1-2 business days</strong> to appear.</p>` +
    `<p style="margin:24px 0 0;color:#888;font-size:12px">Qahwa ☕</p>` +
    `</div>`;
  return resend.emails.send({ from, to: creatorEmail, subject, text, html });
}

const tests = [
  ['notifyPayoutRequested → creator',   sendCreatorRequested],
  ['notifyPayoutRequested → admin',     sendAdminRequested],
  ['notifyPayoutPaid      → creator',   sendCreatorPaid],
];

console.log(`→ from:   ${from}`);
console.log(`→ to:     ${creatorEmail}  (testing-mode forces single recipient)`);
console.log(`→ amount: ${amt} KD\n`);

let fail = 0;
for (const [label, fn] of tests) {
  try {
    const { data, error } = await fn();
    if (error) { console.error(`✕ ${label}: ${JSON.stringify(error)}`); fail++; }
    else      { console.log(`✓ ${label}  id=${data?.id}`); }
  } catch (err) {
    console.error(`✕ ${label}: ${err.message}`); fail++;
  }
}

process.exit(fail ? 1 : 0);
