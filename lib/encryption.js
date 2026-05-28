// AES-256-GCM encryption for Civil ID and IBAN at rest
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.CIVIL_ID_ENCRYPTION_KEY, 'hex'); // 32 bytes

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
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
  const decipher  = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

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
