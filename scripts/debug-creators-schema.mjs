// Diagnostic: dump the actual columns of the live `creators` table
// (via PostgREST/service-role) and diff against the set our routes
// reference, so we can pinpoint a missing column responsible for
// "Database error saving new user" from supabase.auth.signUp.
//
// Strategy:
//   1. SELECT * LIMIT 1 on creators — the row's keys are the
//      authoritative column list per PostgREST's projection.
//      Read-only; no admin row touched.
//   2. Cross-check that list against EXPECTED (every column name
//      our code reads or writes anywhere in app/* or lib/*).
//   3. Print three lists: missing on DB, unexpected on DB,
//      column count + summary.
//
//   node scripts/debug-creators-schema.mjs
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

// Every creators column our code reads or writes anywhere in the tree.
// Keep this list in sync with the routes / components that touch the
// creators row — if a route SELECTs or INSERTs a field, it goes here.
const EXPECTED = new Set([
  // identity
  'id', 'email', 'full_name', 'handle',
  // profile
  'avatar_url', 'avatar_emoji', 'bio',
  'coffee_price_kd',
  'theme_bg', 'theme_text',
  'amazing_enabled', 'amazing_message',
  // socials
  'instagram', 'twitter', 'youtube', 'tiktok',
  // bank / payout
  'bank_name', 'account_holder', 'iban_encrypted', 'iban_masked',
  // money + counters
  'balance_kd', 'total_earned_kd', 'total_tips_count',
  // status / admin gates
  'is_verified', 'is_active', 'is_disabled',
  'verification_status',
  // timestamps (assumed standard)
  'created_at', 'updated_at',
]);

console.log('\n── reading one creators row to introspect columns ──');
const { data, error } = await db
  .from('creators')
  .select('*')
  .limit(1);

if (error) {
  console.error('✕ SELECT failed:', error);
  process.exit(1);
}
if (!data || data.length === 0) {
  console.error('✕ table is empty — cannot introspect columns this way.');
  console.error('  Insert any test row, or expose information_schema, then re-run.');
  process.exit(1);
}

const actual = new Set(Object.keys(data[0]));
console.log(`  ${actual.size} columns in live DB`);
console.log(`  ${EXPECTED.size} columns expected by code\n`);

const missing = [...EXPECTED].filter((c) => !actual.has(c)).sort();
const unknown = [...actual].filter((c) => !EXPECTED.has(c)).sort();

console.log('── columns the CODE expects but are NOT in the DB ──');
if (!missing.length) console.log('  ✓ none — every expected column exists');
else missing.forEach((c) => console.log(`  ✕ ${c}`));

console.log('\n── columns in the DB that the code does NOT reference ──');
if (!unknown.length) console.log('  ✓ none — every DB column is referenced somewhere');
else unknown.forEach((c) => console.log(`  · ${c}`));

console.log('\n── all live columns (sorted) ──');
[...actual].sort().forEach((c) => console.log(`  · ${c}`));
console.log('');

// Bonus: confirm a handle_new_user trigger exists by attempting to
// derive it from pg_trigger via the postgrest rpc surface. We can't
// query pg_catalog directly through PostgREST, but a column-mismatch
// in the trigger is the most common cause of the
// "Database error saving new user" signup failure, so the missing
// list above is usually the answer.
// ── NOT NULL probe via the PostgREST OpenAPI spec ──────────────
// PostgREST publishes a swagger doc at /rest/v1/ that includes a
// `required` array per table — those are the NOT NULL + no-default
// columns. If handle_new_user() doesn't populate any of them, the
// signup fails.
console.log('\n── NOT NULL columns on creators (per PostgREST swagger) ──');
try {
  const r = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const swagger = await r.json();
  const required = swagger?.definitions?.creators?.required || [];
  if (!required.length) console.log('  (no NOT NULL columns advertised — unusual)');
  else required.forEach((c) => console.log(`  · ${c}`));
} catch (err) {
  console.error('  ✕ swagger fetch failed:', err.message);
}

// ── Direct test insert via service role: simulate what the
// handle_new_user trigger would do, with a random fake UUID.
// Surfaces the exact Postgres error if any column / constraint /
// RLS blocks the insert. Cleaned up immediately on success.
console.log('\n── synthetic INSERT (service role) — surfaces real error ──');
const fakeId = crypto.randomUUID();
const probe = { id: fakeId, email: `probe-${Date.now()}@qahwa.test`, full_name: 'Probe', handle: `probe_${Date.now().toString(36)}` };
const { error: insErr } = await db.from('creators').insert(probe);
if (insErr) {
  console.error('  ✕ INSERT failed — this is what the trigger likely hits:');
  console.error('    message:', insErr.message);
  console.error('    code:   ', insErr.code);
  console.error('    details:', insErr.details);
  console.error('    hint:   ', insErr.hint);
} else {
  console.log('  ✓ INSERT succeeded — base table accepts the trigger\'s payload.');
  console.log('    Cleaning up the probe row…');
  const { error: delErr } = await db.from('creators').delete().eq('id', fakeId);
  if (delErr) console.error('  ⚠ cleanup failed for', fakeId, '—', delErr.message);
  else console.log('    ✓ cleaned up');
  console.log('\n  If the base INSERT works but signup still fails, the trigger');
  console.log('  body itself is the culprit (calls a missing function, references');
  console.log('  raw_user_meta_data->>X for X that\'s not sent, RLS in the trigger');
  console.log('  context, etc.). Inspect the trigger source in Supabase SQL editor:');
  console.log("    SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='handle_new_user';");
}

// ── Reproduce the actual signup path via the admin API ─────────
// This goes through auth.users → trigger → creators end-to-end,
// surfacing the exact error supabase.auth.signUp() returns.
// Cleans up the probe user on success OR failure.
console.log('\n── synthetic auth.admin.createUser — reproduces signup ──');
const probeEmail = `probe-${Date.now()}@qahwa.test`;
const probeHandle = `probe_${Date.now().toString(36)}`;
const { data: created, error: signErr } = await db.auth.admin.createUser({
  email: probeEmail,
  password: 'probe-pass-' + Date.now(),
  email_confirm: true, // skip the confirm-email step
  user_metadata: { is_creator: 'true', full_name: 'Probe Test', handle: probeHandle },
});

if (signErr) {
  console.error('  ✕ createUser failed — same error real signup would surface:');
  console.error('    message:', signErr.message);
  console.error('    status: ', signErr.status);
  console.error('    code:   ', signErr.code);
  // Print full object too — often has nested details
  console.error('    full:   ', JSON.stringify(signErr, null, 2));
} else {
  console.log('  ✓ createUser succeeded — auth + trigger work end-to-end.');
  console.log('    Probe user:', created.user?.id, probeEmail);
  // Confirm creators row was created by the trigger
  const { data: cRow } = await db.from('creators').select('id, full_name, handle').eq('id', created.user.id).maybeSingle();
  console.log('    Creators row from trigger:', cRow || '(none — trigger may be off)');

  // Clean up — never leave probe data behind
  await db.from('creators').delete().eq('id', created.user.id);
  await db.auth.admin.deleteUser(created.user.id);
  console.log('    ✓ probe cleaned up (both auth.users and creators)');
}

if (signErr) {
  console.log('\n  → If you also see "Database error saving new user" here,');
  console.log('    the trigger body is failing. Inspect its source in');
  console.log('    Supabase SQL Editor:');
  console.log("      SELECT pg_get_functiondef(p.oid)");
  console.log("      FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid");
  console.log("      WHERE p.proname = 'handle_new_user';");
}

// ── Final probe: same call the browser wizard makes (anon key) ──
// admin.createUser bypasses lots of Auth-server middleware. The anon
// signUp path goes through ALL of it: rate limits, email confirmation,
// custom hooks, SMTP. If admin succeeds but anon fails, the issue is
// in that middleware, NOT the trigger or the schema.
console.log('\n── synthetic anon supabase.auth.signUp — mirrors the wizard ──');
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!anonKey) {
  console.log('  ⚠ NEXT_PUBLIC_SUPABASE_ANON_KEY missing — skipping');
} else {
  const anonDb = createClient(url, anonKey, { auth: { persistSession: false } });
  const anonEmail = `probe-anon-${Date.now()}@qahwa.test`;
  const anonHandle = `probeanon_${Date.now().toString(36)}`;
  const { data: anonData, error: anonErr } = await anonDb.auth.signUp({
    email: anonEmail,
    password: 'probe-anon-pass-' + Date.now(),
    options: {
      data: { is_creator: 'true', full_name: 'Anon Probe', handle: anonHandle },
    },
  });
  if (anonErr) {
    console.error('  ✕ anon signUp failed — same path the live site hits:');
    console.error('    message:', anonErr.message);
    console.error('    status: ', anonErr.status);
    console.error('    code:   ', anonErr.code);
    console.error('    full:   ', JSON.stringify(anonErr, null, 2));
    console.log('\n  Since admin.createUser succeeded but anon signUp failed,');
    console.log('  the trigger/table is fine — the issue is in Supabase Auth');
    console.log('  middleware. Most common causes:');
    console.log('    1. Email confirmation ON + SMTP provider failing');
    console.log('       (Supabase built-in SMTP rate-limits hard in prod)');
    console.log('    2. Auth → Hooks → Send Email Hook returning non-2xx');
    console.log('    3. Captcha required but not sent');
    console.log('    4. Rate-limit hit on this IP / email domain');
    console.log('  Check: Supabase Dashboard → Auth → Providers → Email');
    console.log('         + Auth → Logs (filter: signup) for the real error');
  } else {
    console.log('  ✓ anon signUp succeeded too!');
    console.log('    user:', anonData.user?.id, '· session:', anonData.session ? 'yes' : 'no (email confirm on)');
    if (anonData.user?.id) {
      await db.from('creators').delete().eq('id', anonData.user.id);
      await db.auth.admin.deleteUser(anonData.user.id);
      console.log('    ✓ probe cleaned up');
    }
    console.log('\n  Both paths work from this script — the live error may be:');
    console.log('    - Transient (rate-limit, transient SMTP failure)');
    console.log('    - Region-specific (Vercel edge region vs your local IP)');
    console.log('    - Browser-specific (CORS, cookie domain)');
  }
}

process.exit(missing.length || insErr || signErr ? 1 : 0);
