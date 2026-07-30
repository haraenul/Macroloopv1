// netlify/functions/stripe-webhook.js
//
// Listens for Stripe's checkout.session.completed and subscription
// status-change events. This is the ONLY place premium_status actually
// flips — never the client, and never create-checkout-session.js
// itself (that function only starts a session; this one reacts to
// Stripe confirming what actually happened, the same "never trust the
// client, verify against what a server already knows" rule
// analyze-meal-photo.js applies to the free-tier photo scan cap).
//
// Needs environment variables set in Netlify:
//   STRIPE_SECRET_KEY        - same key as create-checkout-session.js
//   STRIPE_WEBHOOK_SECRET    - from the Stripe dashboard, once this
//                              function's deployed URL is registered
//                              there as a webhook endpoint
//   FIREBASE_SERVICE_ACCOUNT - same service account JSON as the other functions
//   FIREBASE_DATABASE_URL    - same RTDB URL as the other functions

const admin = require('firebase-admin');
const Stripe = require('stripe');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

function jsonResponse(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/**
 * Recovers the firebase uid from whichever event object Stripe sends —
 * a Checkout Session carries client_reference_id and its own metadata;
 * a Subscription only carries the metadata copied onto it at creation.
 * Checking both spots matches the redundancy create-checkout-session.js
 * writes on the way in, so losing any one field isn't fatal.
 */
function extractFirebaseUid(stripeObject) {
  return stripeObject.client_reference_id || stripeObject.metadata?.firebase_uid || null;
}

async function setPremiumStatus(uid, isPremium, extraBillingFields = {}) {
  if (!uid) {
    console.error('stripe-webhook: no firebase uid on event object — cannot update premium_status');
    return;
  }
  const db = admin.database();
  await db.ref(`users/${uid}/profile`).update({ premium_status: isPremium });
  if (Object.keys(extraBillingFields).length > 0) {
    await db.ref(`users/${uid}/billing`).update(extraBillingFields);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const signature = event.headers['stripe-signature'];
  // constructEvent needs the exact raw bytes the signature was computed
  // over — Netlify may deliver the body base64-encoded depending on
  // content-type detection, so this has to be undone before verifying,
  // not the JSON.parse()'d object.
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', err.message);
    return jsonResponse(400, { error: 'invalid_signature' });
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        await setPremiumStatus(extractFirebaseUid(session), true, {
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          updated_at: new Date().toISOString(),
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        const isActive = ['active', 'trialing'].includes(subscription.status);
        await setPremiumStatus(extractFirebaseUid(subscription), isActive, {
          updated_at: new Date().toISOString(),
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        await setPremiumStatus(extractFirebaseUid(subscription), false, {
          updated_at: new Date().toISOString(),
        });
        break;
      }

      default:
        // Acknowledged but intentionally ignored — Stripe sends dozens
        // of event types this app has no use for.
        break;
    }
  } catch (err) {
    console.error('stripe-webhook: error handling event', stripeEvent.type, err);
    return jsonResponse(500, { error: 'webhook_processing_failed' });
  }

  return jsonResponse(200, { received: true });
};
