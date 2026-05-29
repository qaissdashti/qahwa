// One-shot migration: snap every creator's coffee_price_kd to the
// nearest 0.5-KD multiple in the allowed set [0.5, 1.0, 1.5, 2.0,
// 2.5, 3.0], so existing creators don't get a 400 on their next
// settings save under the new strict validation.
//
//   node scripts/migrate-coffee-prices.mjs
//
// Idempotent — re-running does nothing once every row is canonical.
// Explicitly excludes the god-admin account.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) { console.error('Missing Supabase env'); process.exit(1); }

const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

const ALLOWED = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
const MIN = ALLOWED[0];
const MAX = ALLOWED[ALLOWED.length - 1];

// Round to nearest 0.5, then clamp to [MIN, MAX]. Anything <0.25 gets
// bumped to 0.5 (the floor) rather than 0 — a zero-price cup makes no
// sense.
function snap(price) {
  const rounded = Math.round(Number(price) * 2) / 2;
  if (!Number.isFinite(rounded)) return MIN;
  if (rounded < MIN) return MIN;
  if (rounded > MAX) return MAX;
  return rounded;
}

// Hard exclude — never touch the god-admin account in any script.
const ADMIN_EMAIL = 'qaissdashti@gmail.com';

console.log('\n── reading creators ────────────────────────────');
const { data: rows, error } = await db
  .from('creators')
  .select('id, handle, email, coffee_price_kd')
  .neq('email', ADMIN_EMAIL);

if (error) { console.error('✕ select failed:', error.message); process.exit(1); }
console.log(`  ${rows.length} creators (admin excluded)\n`);

let touched = 0, skipped = 0, errored = 0;

for (const c of rows) {
  const current = Number(c.coffee_price_kd);
  const next = snap(current);
  if (current === next) { skipped++; continue; }

  const { error: uErr } = await db
    .from('creators')
    .update({ coffee_price_kd: next })
    .eq('id', c.id);

  if (uErr) {
    console.error(`  ✕ @${c.handle}: ${current} → ${next} — ${uErr.message}`);
    errored++;
  } else {
    console.log(`  ✓ @${c.handle.padEnd(20)} ${String(current).padStart(6)}  →  ${next.toFixed(1)}`);
    touched++;
  }
}

console.log('\n── summary ─────────────────────────────────────');
console.log(`  updated: ${touched}`);
console.log(`  already canonical (skipped): ${skipped}`);
console.log(`  errored: ${errored}`);
console.log('');
process.exit(errored ? 1 : 0);
