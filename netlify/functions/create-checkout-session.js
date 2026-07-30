// netlify/functions/create-checkout-session.js
//
// Starts a Stripe Checkout session for the Premium subscription. Same
// non-negotiable as analyze-meal-photo.js: the Stripe secret key lives
// only here, never in client code, and the uid comes from a
// Firebase-verified token, never from anything the client claims about
// itself.
//
// This function does NOT flip premium_status — it only starts a
// checkout session. The actual upgrade happens in stripe-webhook.js,
// triggered by Stripe itself once payment succeeds, so a user closing
// the tab mid-checkout can never grant themselves premium client-side.
//
// Needs environment variables set in Netlify:
//   STRIPE_SECRET_KEY        - from the Stripe dashboard
//   STRIPE_PRICE_ID          - the Price ID for the Premium subscription
//                              (create this as a recurring Price in the
//                              Stripe dashboard first)
//   FIREBASE_SERVICE_ACCOUNT - same service account JSON as the photo function
//   FIREBASE_DATABASE_URL    - same RTDB URL as the photo function
//   SITE_URL                 - fallback return origin if a request ever
//                              arrives without an Origin header (normal
//                              browser fetches always send one; this is
//                              a defensive fallback, not the main path)

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) {
    return jsonResponse(401, { error: 'missing_auth_token' });
  }

  let uid;
  let userRecord;
  try {
    uid = (await admin.auth().verifyIdToken(idToken)).uid;
    userRecord = await admin.auth().getUser(uid);
  } catch (err) {
    return jsonResponse(401, { error: 'invalid_auth_token' });
  }

  if (!process.env.STRIPE_PRICE_ID) {
    console.error('create-checkout-session: STRIPE_PRICE_ID is not set');
    return jsonResponse(500, { error: 'billing_not_configured' });
  }

  const db = admin.database();
  const billingSnap = await db.ref(`users/${uid}/billing`).get();
  const existingCustomerId = (billingSnap.val() || {}).stripe_customer_id || null;

  // GitHub Pages is this app's primary test frontend, Netlify hosts the
  // functions — the same split analyze-meal-photo.js works around — so
  // the return URL has to be wherever THIS request actually came from,
  // not a single hardcoded origin. A normal cross-origin fetch always
  // sends Origin; SITE_URL only covers the unlikely case it's missing.
  const origin = event.headers.origin || process.env.SITE_URL;
  if (!origin) {
    console.error('create-checkout-session: no Origin header and no SITE_URL fallback set');
    return jsonResponse(500, { error: 'billing_not_configured' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      // uid is threaded through three separate ways — client_reference_id,
      // top-level metadata, and subscription_data.metadata — so the
      // webhook can recover it from whichever event object it's handed,
      // rather than depending on exactly one field surviving the round trip.
      client_reference_id: uid,
      metadata: { firebase_uid: uid },
      subscription_data: { metadata: { firebase_uid: uid } },
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: userRecord.email || undefined }),
    });

    return jsonResponse(200, { url: session.url });
  } catch (err) {
    console.error('create-checkout-session: Stripe error', err);
    return jsonResponse(502, { error: 'checkout_session_failed' });
  }
};
