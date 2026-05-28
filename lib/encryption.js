// AES-256-GCM encryption for Civil ID and IBAN at rest.
//
// IMPORTANT: the key is resolved lazily on first encrypt()/decrypt() call,
// NOT at module load. Resolving it at import time crashes the Vercel build
// because Next analyses route files during build when env vars aren't yet
// available — `Buffer.from(undefined, 'hex')` throws ERR_INVALID_ARG_TYPE.
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

let _key; // cached after first successful resolve
function getKey() {
  if (_key) return _key;
  const hex = process.env.CIVIL_ID_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'CIVIL_ID_ENCRYPTION_KEY is not set. Add a 64-character hex string ' +
      'to your environment (generate with: node -e "console.log(' +
      "require('crypto').randomBytes(32).toString('hex'))\").",
    );
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error(`CIVIL_ID_ENCRYPTION_KEY must be 32 bytes (64 hex chars); got ${buf.length} bytes.`);
  }
  _key = buf;
  return _key;
}

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(stored) {
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const iv        = Buffer.from(ivHex,  'hex');
  const tag       = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(dataHex,'hex');
  const decipher  = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// Mask helpers don't need the key — kept as pure string ops.
export function maskCivilId(civilId) {
  // Show first 6 digits, mask remaining 6 — e.g. "290514XXXXXX"
  return civilId.slice(0, 6) + 'X'.repeat(6);
}

export function maskIban(iban) {
  // Kuwait IBAN is 30 chars. Show first 6 + last 4, mask the middle —
  // e.g. "KW81NB****************1234" — safe for UI display.
  const v = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (v.length < 10) return v;
  return v.slice(0, 6) + '*'.repeat(v.length - 10) + v.slice(-4);
}
