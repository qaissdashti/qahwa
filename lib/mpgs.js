// ============================================================
// FILE: /lib/mpgs.js
// PURPOSE: Create a Mastercard Payment Gateway Services (MPGS)
//          Hosted Checkout session and verify the resulting order
//          server-side. Card rail (Visa/Mastercard) — runs alongside
//          the existing MyFatoorah/KNET flow, never replaces it.
// ============================================================

import { getBaseUrl } from '@/lib/baseUrl';

// All MPGS credentials/URLs are resolved at CALL TIME, never at module
// load — the build step runs with no runtime env vars, so reading them
// at import would crash the build. Every exported fn calls this first.
function mpgsConfig() {
  const baseUrl     = (process.env.MPGS_BASE_URL || '').replace(/\/+$/, '');
  const merchantId  = process.env.MPGS_MERCHANT_ID;
  const apiPassword = process.env.MPGS_API_PASSWORD;
  const apiVersion  = process.env.MPGS_API_VERSION;

  if (!baseUrl || !merchantId || !apiPassword || !apiVersion) {
    throw new Error(
      'MPGS not configured (need MPGS_BASE_URL, MPGS_MERCHANT_ID, MPGS_API_PASSWORD, MPGS_API_VERSION)'
    );
  }

  // HTTP Basic — username is "merchant.<MERCHANT_ID>", password the API password.
  const authHeader =
    'Basic ' + Buffer.from(`merchant.${merchantId}:${apiPassword}`).toString('base64');
  const merchantUrl = `${baseUrl}/api/rest/version/${apiVersion}/merchant/${merchantId}`;

  return { merchantUrl, authHeader };
}

/**
 * createCheckoutSession
 * Called when a supporter chooses to pay by card (Visa/Mastercard).
 * Creates an MPGS Hosted Checkout session tied to our tip row.
 *
 * @param {object} params
 * @param {string} params.tipId       - UUID of the tip row (already inserted as 'pending') → order.id
 * @param {number} params.amount      - Total KWD amount e.g. 6.000
 * @param {string} params.creatorName - Display name for the hosted page
 * @param {string} params.handle      - Creator handle for callback routing
 * @returns {object} { sessionId, orderId }
 */
export async function createCheckoutSession({ tipId, amount, creatorName, handle }) {
  const { merchantUrl, authHeader } = mpgsConfig();

  const base = getBaseUrl();
  // Browser is returned here after the hosted page; orderId lets the
  // callback look up the tip. The callback re-verifies SERVER-SIDE — this
  // redirect is never trusted on its own.
  const returnUrl = `${base}/api/payment/callback-card?orderId=${tipId}`;

  const body = {
    apiOperation: 'INITIATE_CHECKOUT',
    interaction: {
      operation: 'PURCHASE',
      returnUrl,
      merchant: {
        name: creatorName || 'Qahwa',
      },
    },
    order: {
      id: tipId,                              // our internal tip ID
      reference: tipId,                       // acquirer requires a unique order ref — reuse the tip ID
      amount: Number(amount.toFixed(3)),
      currency: 'KWD',
      description: handle ? `Qahwa tip for ${handle}` : 'Qahwa tip',  // plain ASCII — portal mangles non-ASCII
    },
    transaction: {
      reference: tipId,                       // acquirer requires a unique transaction ref — reuse the tip ID
    },
  };

  const res = await fetch(`${merchantUrl}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MPGS INITIATE_CHECKOUT failed: ${res.status} — ${err}`);
  }

  const data = await res.json();

  if (data.result !== 'SUCCESS' || !data.session?.id) {
    throw new Error(`MPGS error: ${data.error?.explanation || data.result || 'unknown'}`);
  }

  return {
    sessionId: data.session.id,
    orderId:   String(tipId),
  };
}

/**
 * getOrderStatus
 * Retrieve an MPGS order to confirm payment SERVER-SIDE before we ever
 * mark a tip paid. This is the source of truth — the browser redirect is not.
 *
 * @param {string} orderId - MPGS order.id (== our tip ID)
 * @returns {object} { isPaid, result, status, transactionId, brand }
 */
export async function getOrderStatus(orderId) {
  const { merchantUrl, authHeader } = mpgsConfig();

  const res = await fetch(`${merchantUrl}/order/${orderId}`, {
    method: 'GET',
    headers: { 'Authorization': authHeader },
  });

  if (!res.ok) throw new Error(`MPGS order retrieval failed: ${res.status}`);

  const data = await res.json();

  // A completed purchase reports result=SUCCESS and order status=CAPTURED.
  const result = data.result;
  const status = data.status;
  const isPaid = result === 'SUCCESS' && status === 'CAPTURED';

  // Pull the transaction id + card brand from the latest transaction.
  const txns    = Array.isArray(data.transaction) ? data.transaction : [];
  const lastTxn = txns[txns.length - 1] || {};

  return {
    isPaid,
    result,
    status,
    transactionId:
      lastTxn.transaction?.id || null,
    brand:
      data.sourceOfFunds?.provided?.card?.brand ||
      lastTxn.sourceOfFunds?.provided?.card?.brand ||
      null,
  };
}
