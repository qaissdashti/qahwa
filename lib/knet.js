// ============================================================
// FILE: /lib/knet.js
// PURPOSE: KNET KPAY direct integration (RAW method). Builds the
//          encrypted payment redirect URL and decrypts KNET's
//          response trandata. Mirrors KNET's PHP RAW sample exactly.
//
// Runs alongside MyFatoorah/KNET and MPGS — this is the direct
// KPAY rail. Uses only Node's built-in crypto (no deps).
// ============================================================

import crypto from 'crypto';

// All KNET credentials are resolved at CALL TIME, never at module load —
// the build step runs with no runtime env vars, so reading them at import
// would crash the build. Every exported fn calls this first.
function knetConfig() {
  const tranportalId       = process.env.KNET_TRANPORTAL_ID;
  const tranportalPassword = process.env.KNET_TRANPORTAL_PASSWORD;
  const resourceKey        = process.env.KNET_RESOURCE_KEY;
  const gatewayUrl         = process.env.KNET_GATEWAY_URL;
  const appUrl             = process.env.NEXT_PUBLIC_APP_URL;

  if (!tranportalId || !tranportalPassword || !resourceKey || !gatewayUrl || !appUrl) {
    throw new Error(
      'KNET not configured (need KNET_TRANPORTAL_ID, KNET_TRANPORTAL_PASSWORD, KNET_RESOURCE_KEY, KNET_GATEWAY_URL, NEXT_PUBLIC_APP_URL)'
    );
  }

  return { tranportalId, tranportalPassword, resourceKey, gatewayUrl, appUrl };
}

// KNET's PHP RAW sample uses AES-128-CBC where the key AND the IV are both
// the first 16 bytes of the resource key. PHP's openssl silently truncates
// the key string to 16 bytes, and the sample passes the key itself as the IV.
function keyIv(resourceKey) {
  return Buffer.from(resourceKey, 'utf8').subarray(0, 16);
}

// Encrypt: manual PKCS5 padding, AES-128-CBC with autoPadding off, lowercase hex.
function encryptAES(plaintext, resourceKey) {
  const k = keyIv(resourceKey);

  const buf = Buffer.from(plaintext, 'utf8');
  const pad = 16 - (buf.length % 16);            // PKCS5: 1..16 bytes
  const padded = Buffer.concat([buf, Buffer.alloc(pad, pad)]);

  const cipher = crypto.createCipheriv('aes-128-cbc', k, k);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString('hex');
}

// Decrypt: AES-128-CBC with autoPadding off, then strip PKCS5 padding manually.
function decryptAES(hexString, resourceKey) {
  const k = keyIv(resourceKey);

  const decipher = crypto.createDecipheriv('aes-128-cbc', k, k);
  decipher.setAutoPadding(false);
  const out = Buffer.concat([decipher.update(Buffer.from(hexString, 'hex')), decipher.final()]);

  const pad = out[out.length - 1];               // last byte = pad length
  if (pad < 1 || pad > 16) throw new Error('KNET decrypt: invalid PKCS5 padding');
  return out.subarray(0, out.length - pad).toString('utf8');
}

/**
 * buildPaymentUrl
 * Build the KNET KPAY redirect URL for a tip.
 *
 * @param {object} params
 * @param {number} params.amount  - KWD amount (rendered with 3 decimals, e.g. 5.000)
 * @param {string} params.trackId - Our internal tracking id (tip id)
 * @param {string} params.udf1    - User-defined field 1 (passed back on response)
 * @returns {string} Full KPAY PaymentHTTP.htm redirect URL
 */
export function buildPaymentUrl({ amount, trackId, udf1 }) {
  const { tranportalId, tranportalPassword, resourceKey, gatewayUrl, appUrl } = knetConfig();

  // KNET requires both response + error URLs, with NO query strings allowed.
  // Optional override: KNET_CALLBACK_BASE lets us point the response/error
  // URLs at a different base than NEXT_PUBLIC_APP_URL when set.
  const callbackBase = process.env.KNET_CALLBACK_BASE || appUrl;
  const responseURL = `${callbackBase}/api/payment/callback-knet`;
  const errorURL    = `${callbackBase}/api/payment/callback-knet`;

  // Plaintext params — order is significant and must match KNET's sample.
  const plaintext =
    `id=${tranportalId}` +
    `&password=${tranportalPassword}` +
    `&action=1` +
    `&langid=USA` +
    `&currencycode=414` +
    `&amt=${Number(amount).toFixed(3)}` +
    `&responseURL=${responseURL}` +
    `&errorURL=${errorURL}` +
    `&trackid=${trackId}` +
    `&udf1=${udf1}`;

  const trandata = encodeURIComponent(encryptAES(plaintext, resourceKey));

  return `${gatewayUrl}/kpg/PaymentHTTP.htm?param=paymentInit` +
    `&trandata=${trandata}` +
    `&tranportalId=${tranportalId}` +
    `&responseURL=${encodeURIComponent(responseURL)}` +
    `&errorURL=${encodeURIComponent(errorURL)}`;
}

/**
 * decryptTrandata
 * Decrypt KNET's response trandata and parse it into a plain object.
 *
 * @param {string} hexString - The `trandata` hex string from KNET's callback
 * @returns {object} Parsed key/value pairs (paymentid, result, tranid, trackid, udf1, ...)
 */
export function decryptTrandata(hexString) {
  const { resourceKey } = knetConfig();

  const decrypted = decryptAES(hexString, resourceKey);

  const params = new URLSearchParams(decrypted);
  const result = {};
  for (const [key, value] of params) result[key] = value;
  return result;
}
