// ============================================================
// FILE: /lib/myfatoorah.js
// PURPOSE: Initiate a payment session with MyFatoorah and
//          return a hosted payment URL for the supporter
// ============================================================

import { getBaseUrl } from '@/lib/baseUrl';

const MF_BASE_URL = 'https://api.myfatoorah.com'; // production
// const MF_BASE_URL = 'https://apitest.myfatoorah.com'; // sandbox

/**
 * createInvoice
 * Called when a supporter selects their cups and hits "Send Coffee"
 *
 * @param {object} params
 * @param {string} params.tipId        - UUID of the tip row (already inserted as 'pending')
 * @param {number} params.amount       - Total KWD amount e.g. 6.000
 * @param {string} params.creatorName  - Display name for the payment page
 * @param {string} params.handle       - Creator handle for callback routing
 * @param {number} params.cups         - Number of cups (for display)
 * @returns {object} { invoiceId, paymentUrl }
 */
export async function createInvoice({ tipId, amount, creatorName, handle, cups }) {
  const base = getBaseUrl();
  const callbackUrl = `${base}/api/payment/callback`;
  const errorUrl    = `${base}/${handle}?error=payment_failed`;

  const body = {
    NotificationOption: 'LNK',         // Return a payment link
    InvoiceValue: Number(amount.toFixed(3)),
    CurrencyIso: 'KWD',
    CallBackUrl: callbackUrl,
    ErrorUrl: errorUrl,
    Language: 'AR',                     // Arabic payment page
    CustomerReference: tipId,           // Our internal tip ID
    InvoiceItems: [{
      ItemName: cups === 0
        ? `قهوة لـ ${creatorName} ☕ (أنت رائع)`
        : `${cups} قهوة لـ ${creatorName} ☕`,
      Quantity: 1,
      UnitPrice: Number(amount.toFixed(3)),
    }],
    // Show creator name on payment page
    UserDefinedField: JSON.stringify({ creator: creatorName, handle }),
  };

  const res = await fetch(`${MF_BASE_URL}/v2/SendPayment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MYFATOORAH_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MyFatoorah SendPayment failed: ${res.status} — ${err}`);
  }

  const data = await res.json();

  if (!data.IsSuccess) {
    throw new Error(`MyFatoorah error: ${data.Message}`);
  }

  return {
    invoiceId:  String(data.Data.InvoiceId),
    paymentUrl: data.Data.InvoiceURL,
  };
}

/**
 * getPaymentStatus
 * Poll MyFatoorah to verify a payment (used as backup if webhook is delayed)
 *
 * @param {string} paymentId - From MyFatoorah callback ?paymentId=xxx
 * @returns {object} { isPaid, invoiceId, method }
 */
export async function getPaymentStatus(paymentId) {
  const res = await fetch(`${MF_BASE_URL}/v2/GetPaymentStatus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MYFATOORAH_API_KEY}`,
    },
    body: JSON.stringify({ Key: paymentId, KeyType: 'PaymentId' }),
  });

  if (!res.ok) throw new Error(`GetPaymentStatus failed: ${res.status}`);

  const data = await res.json();

  if (!data.IsSuccess) throw new Error(`MyFatoorah error: ${data.Message}`);

  const invoice = data.Data;
  return {
    isPaid:    invoice.InvoiceStatus === 'Paid',
    invoiceId: String(invoice.InvoiceId),
    method:    invoice.InvoiceTransactions?.[0]?.PaymentMethod || null,
  };
}
