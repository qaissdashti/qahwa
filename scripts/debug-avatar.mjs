// Diagnostic for "avatar not showing on tipping page".
// Probes the four likely failure points in order:
//   1. avatars bucket exists + is public
//   2. A creators row has a non-null avatar_url
//   3. The file referenced by that URL exists in storage
//   4. The URL itself returns 200 on plain HTTP fetch (no auth header)
//
//   node scripts/debug-avatar.mjs
//
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db  = createClient(url, key, { auth: { persistSession: false } });

// 1. Bucket meta ─────────────────────────────────────────────
console.log('\n── 1. avatars bucket ────────────────────────────');
const { data: bucket, error: bErr } = await db.storage.getBucket('avatars');
if (bErr) { console.error('✕ getBucket failed:', bErr.message); process.exit(1); }
console.log('  id:        ', bucket.id);
console.log('  public:    ', bucket.public);
console.log('  file_size_limit:', bucket.file_size_limit);
console.log('  allowed_mime_types:', bucket.allowed_mime_types);

// 2. Creator with avatar_url ─────────────────────────────────
console.log('\n── 2. creators with avatar_url ──────────────────');
const { data: withAvatar, error: cErr } = await db
  .from('creators')
  .select('id, handle, full_name, avatar_url, avatar_emoji, is_verified, verification_status')
  .not('avatar_url', 'is', null)
  .limit(5);
if (cErr) { console.error('✕ select failed:', cErr.message); process.exit(1); }
if (!withAvatar.length) {
  console.log('  (none) — no creator has an avatar_url set.');
  console.log('  Either: nobody has uploaded yet, OR the avatar route never wrote the URL.');
  process.exit(0);
}
for (const c of withAvatar) {
  console.log(`  @${c.handle} (${c.full_name})`);
  console.log(`    verified=${c.is_verified} status=${c.verification_status}`);
  console.log(`    avatar_url=${c.avatar_url}`);
}

// 3. Probe the first one for storage object presence + URL reachability
const probe = withAvatar[0];
console.log(`\n── 3. probe object existence — @${probe.handle} ─`);

// Try to derive the storage path from the URL. Public URLs look like:
//   <project>.supabase.co/storage/v1/object/public/avatars/<path>
const pathMatch = probe.avatar_url.match(/\/object\/public\/avatars\/(.+)$/);
if (!pathMatch) {
  console.log('  ⚠ URL does not match the expected public-URL shape:');
  console.log('   ', probe.avatar_url);
} else {
  const objectPath = pathMatch[1];
  console.log(`  derived storage path: ${objectPath}`);

  // List the user's avatar folder to see what's actually there.
  const folder = objectPath.split('/').slice(0, -1).join('/');
  const { data: listed, error: lErr } = await db.storage.from('avatars').list(folder, { limit: 100 });
  if (lErr) console.error(`  ✕ list("${folder}") failed:`, lErr.message);
  else {
    console.log(`  files in "${folder}/":`);
    listed.forEach((f) => console.log(`    • ${f.name}  (${f.metadata?.size ?? '?'} bytes)`));
    const wanted = objectPath.split('/').pop();
    const present = listed.some((f) => f.name === wanted);
    console.log(`  → "${wanted}" present?  ${present ? '✓ yes' : '✕ NO — file is missing'}`);
  }
}

// 4. Plain HTTP fetch ─────────────────────────────────────────
console.log('\n── 4. plain HTTP fetch (no auth) ────────────────');
try {
  const res = await fetch(probe.avatar_url, { method: 'HEAD' });
  console.log(`  ${res.status} ${res.statusText}`);
  console.log(`  content-type:   ${res.headers.get('content-type')}`);
  console.log(`  content-length: ${res.headers.get('content-length')}`);
  if (res.status === 200) console.log('  ✓ URL is publicly reachable.');
  else                    console.log(`  ✕ URL is NOT publicly reachable (status ${res.status}).`);
} catch (err) {
  console.error('  ✕ fetch threw:', err.message);
}
console.log('');
