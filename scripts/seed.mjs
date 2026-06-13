// Dev seed: creates test creators (auth users -> trigger makes creators rows),
// enriches their profiles, inserts paid tips (balance trigger), one creator
// awaiting verification, and a pending payout. Idempotent — safe to re-run.
//
//   node scripts/seed.mjs
//
// Requires SUPABASE service-role creds in .env.local.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── load .env.local ────────────────────────────────────────────
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) { console.error('Missing Supabase env'); process.exit(1); }

const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
const PASSWORD = 'qahwa1234';
const FEE_PCT = 7;

const r3 = (n) => Number(n.toFixed(3));
const split = (gross) => {
  const fee = r3(gross * FEE_PCT / 100);
  return { gross_amount_kd: r3(gross), platform_fee_kd: fee, net_amount_kd: r3(gross - fee), fee_pct: FEE_PCT };
};
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

// ── seed definitions ───────────────────────────────────────────
const CREATORS = [
  { email: 'noura@qahwa.test',  handle: 'noura',   full_name: 'نورة العتيبي',  emoji: '🎨', price: 1.0, bio: 'رسامة كويتية • محتوى فني يومي', verified: true },
  { email: 'salem@qahwa.test',  handle: 'salem',   full_name: 'سالم الفهد',    emoji: '🎙️', price: 1.5, bio: 'بودكاست تقني بالعربي', verified: true },
  { email: 'dana@qahwa.test',   handle: 'dana',    full_name: 'دانة المطيري',  emoji: '📚', price: 2.0, bio: 'مراجعات كتب وقراءات', verified: true },
  { email: 'yousef@qahwa.test', handle: 'yousef',  full_name: 'يوسف العنزي',   emoji: '🎮', price: 1.0, bio: 'ستريمر ألعاب', verified: false }, // awaits review
];

const TIPS_BY_HANDLE = {
  noura: [
    { name: 'أحمد',   cups: 3, gross: 3.0, msg: 'رسوماتك تجنّن! واصلي 🎨', days: 1 },
    { name: 'مريم',   cups: 1, gross: 1.0, msg: 'أول قهوة مني ☕', days: 2 },
    { name: 'فيصل',   amazing: true, gross: 10.0, msg: 'دعم خاص لمشروعك الجديد', days: 4 },
    { name: 'لطيفة',  cups: 5, gross: 5.0, msg: null, days: 6 },
  ],
  salem: [
    { name: 'عبدالله', cups: 1, gross: 1.5, msg: 'الحلقة الأخيرة كانت ممتازة', days: 1 },
    { name: 'حصة',     amazing: true, gross: 7.5, msg: 'شكراً على المحتوى المجاني', days: 3 },
    { name: 'بدر',     cups: 3, gross: 4.5, msg: null, days: 5 },
  ],
  dana: [
    { name: 'سارة',   cups: 1, gross: 2.0, msg: 'ترشيحاتك دايماً بمحلها 📚', days: 2 },
    { name: 'خالد',   cups: 1, gross: 2.0, msg: null, days: 8 },
  ],
};

async function deleteSeedUser(email) {
  // listUsers is paginated; scan a few pages for our test emails
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) { await db.auth.admin.deleteUser(u.id); return; } // cascades to creators
    if (data.users.length < 200) break;
  }
}

async function tinyPng() {
  // 1x1 transparent PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );
}

async function run() {
  console.log('— Qahwa seed —');
  const idByHandle = {};

  for (const c of CREATORS) {
    await deleteSeedUser(c.email);
    const { data: created, error } = await db.auth.admin.createUser({
      email: c.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { is_creator: 'true', full_name: c.full_name, handle: c.handle },
    });
    if (error) throw new Error(`createUser ${c.email}: ${error.message}`);
    const id = created.user.id;
    idByHandle[c.handle] = id;

    // trigger created the creators row; enrich it
    await db.from('creators').update({
      bio: c.bio,
      avatar_emoji: c.emoji,
      coffee_price_kd: c.price,
      is_active: true,
      is_verified: c.verified,
      verification_status: c.verified ? 'approved' : 'under_review',
    }).eq('id', id);

    if (c.verified) {
      await db.from('verifications').upsert({
        creator_id: id, phone_verified: true, phone_verified_at: daysAgo(10),
        civil_id_masked: '290514XXXXXX', status: 'approved', reviewed_at: daysAgo(9),
      }, { onConflict: 'creator_id' });
      await db.from('creators').update({ phone: '+96550001111', whatsapp_number: '+96550001111' }).eq('id', id);
    } else {
      // awaiting review: upload a placeholder selfie so admin can preview it
      const path = `${id}/selfie-seed.png`;
      await db.storage.from('selfies').upload(path, await tinyPng(), { contentType: 'image/png', upsert: true });
      await db.from('verifications').upsert({
        creator_id: id, phone_verified: true, phone_verified_at: daysAgo(1),
        civil_id_masked: '301122XXXXXX', selfie_url: path, status: 'under_review',
      }, { onConflict: 'creator_id' });
      await db.from('creators').update({ phone: '+96550002222', whatsapp_number: '+96550002222' }).eq('id', id);
    }
    console.log(`  ✓ creator @${c.handle} (${c.verified ? 'verified' : 'under review'})`);
  }

  // tips (paid -> balance trigger fires)
  let tipCount = 0;
  for (const [handle, tips] of Object.entries(TIPS_BY_HANDLE)) {
    const creator_id = idByHandle[handle];
    for (const t of tips) {
      await db.from('tips').insert({
        creator_id,
        supporter_name: t.name,
        supporter_phone: '+9655' + Math.floor(1000000 + Math.random() * 8999999),
        cups: t.amazing ? 0 : t.cups,
        is_amazing: !!t.amazing,
        ...split(t.gross),
        message: t.msg,
        payment_method: 'knet',
        status: 'paid',
        paid_at: daysAgo(t.days),
        created_at: daysAgo(t.days),
        whatsapp_notified_at: daysAgo(t.days),
      });
      tipCount++;
    }
  }
  console.log(`  ✓ ${tipCount} paid tips inserted (balances updated by trigger)`);

  // a pending payout for the payouts queue
  await db.from('payouts').insert({
    creator_id: idByHandle['noura'],
    amount_kd: 5.0,
    bank_name: 'بنك الكويت الوطني',
    account_holder: 'نورة العتيبي',
    iban: 'KW81NBOK0000000000001234560101',
    method: 'bank_transfer',
    status: 'pending',
  });
  console.log('  ✓ 1 pending payout (for @noura)');

  // summary
  const { data: cs } = await db.from('creators')
    .select('handle, balance_kd, total_tips_count').in('handle', CREATORS.map((c) => c.handle));
  console.log('\nBalances:');
  for (const c of cs || []) console.log(`  @${c.handle}: ${Number(c.balance_kd).toFixed(3)} KD across ${c.total_tips_count} tips`);

  console.log(`\nTest logins (password for all: ${PASSWORD}):`);
  for (const c of CREATORS) console.log(`  ${c.email}  ->  buymeqahwa.com/${c.handle}`);
  console.log('\nDone.');
}

run().catch((e) => { console.error('\nSEED FAILED:', e.message); process.exit(1); });
