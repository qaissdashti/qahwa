// Diagnostic for "selfie upload failing for valid files". Mirrors the
// service-role storage call /api/verify/selfie/route.js makes and
// surfaces the exact Supabase storage error if any.
//
//   node scripts/debug-selfie-upload.mjs
//
// Probes (read-only against creators; cleans up its own selfies row):
//   1. selfies bucket — exists / public / file_size_limit / mime allowlist
//   2. Pick a real creator id and write a 2-byte file at <id>/probe.png
//   3. List the folder back, then delete the probe
//
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('✕ Supabase env missing'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// 1. Bucket meta
console.log('\n── 1. selfies bucket ────────────────────────────');
const { data: bucket, error: bErr } = await db.storage.getBucket('selfies');
if (bErr) { console.error('  ✕ getBucket failed:', bErr.message); process.exit(1); }
console.log('  id:                 ', bucket.id);
console.log('  public:             ', bucket.public);
console.log('  file_size_limit:    ', bucket.file_size_limit, bucket.file_size_limit ? `(${(bucket.file_size_limit/1024/1024).toFixed(1)} MB)` : '(no cap)');
console.log('  allowed_mime_types: ', bucket.allowed_mime_types);

// 2. Pick a real creator (skip the admin per durable memory)
console.log('\n── 2. pick a test creator ────────────────────────');
const { data: rows } = await db.from('creators').select('id, handle, email').neq('email', 'qaissdashti@gmail.com').limit(1);
if (!rows?.length) { console.error('  ✕ no non-admin creators to probe with'); process.exit(1); }
const c = rows[0];
console.log(`  using @${c.handle}  id=${c.id}`);

// 3. Write a 2-byte PNG into <creatorId>/probe-<ts>.png — same path
//    shape the real route uses (`${user.id}/selfie-${ts}.${ext}`).
console.log('\n── 3. probe upload ──────────────────────────────');
const probePath = `${c.id}/probe-${Date.now()}.png`;
// Minimal valid PNG header (8-byte signature) — just enough that
// content-type sniffing won't reject it.
const probeBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const { error: upErr } = await db.storage
  .from('selfies')
  .upload(probePath, probeBytes, { contentType: 'image/png', upsert: true });
if (upErr) {
  console.error('  ✕ upload failed:');
  console.error('    message:', upErr.message);
  console.error('    status: ', upErr.status, upErr.statusCode);
  console.error('    full:   ', JSON.stringify(upErr, null, 2));
  process.exit(1);
}
console.log('  ✓ upload succeeded at', probePath);

// List back to confirm the object lives
const { data: listed, error: lErr } = await db.storage.from('selfies').list(c.id, { limit: 50 });
if (lErr) console.error('  ⚠ list failed:', lErr.message);
else console.log(`  ✓ list returned ${listed.length} object(s) in ${c.id}/`);

// Clean up
const { error: dErr } = await db.storage.from('selfies').remove([probePath]);
if (dErr) console.error('  ⚠ cleanup failed:', dErr.message);
else console.log('  ✓ cleaned up');

console.log('\n── verdict ───────────────────────────────────────');
console.log('  If this probe succeeded but the live upload still fails,');
console.log('  the route is rejecting BEFORE the storage call — most likely');
console.log('  the "previous steps not done" gate (line 49) because the');
console.log('  verifications row has no civil_id_encrypted, OR WHATSAPP_API_TOKEN');
console.log('  is set on Vercel and phone_verified is false.');
console.log('');
