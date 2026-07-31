// billing.js
// Client side of the Premium paywall. This module only ever starts a
// checkout session and hands back the URL to redirect to — it never
// sets premium_status itself. That flip happens exclusively in
// stripe-webhook.js once Stripe confirms payment actually succeeded,
// the same "don't trust the client for anything that costs money or
// gates a paid feature" rule analyze-meal-photo.js already applies to
// the free-tier scan cap.
//
// Same absolute-URL requirement as PHOTO_FUNCTION_URL in photo-log.js,
// and for the same reason: GitHub Pages (this app's primary test
// frontend) can't run Netlify Functions at all, so a relative path
// silently 404s from there. DO NOT change this back to a relative path.
const CHECKOUT_FUNCTION_URL = 'https://magnificent-truffle-0d1dc1.netlify.app/.netlify/functions/create-checkout-session';

/** Thrown when the checkout session couldn't be started at all — network failure, or the function itself erroring. */
export class CheckoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CheckoutError';
  }
}

/**
 * Starts a Stripe Checkout session and returns the URL to redirect the
 * browser to. idToken is required for the same reason it's required
 * for photo analysis — the function verifies who's asking rather than
 * trusting a client-supplied uid.
 */
export async function startCheckout(idToken) {
  let res;
  try {
    res = await fetch(CHECKOUT_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    });
  } catch (err) {
    throw new CheckoutError('Could not reach the checkout service.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new CheckoutError(body.error ? `Checkout failed: ${body.error}` : `Checkout request failed (${res.status}).`);
  }

  const { url } = await res.json();
  if (!url) {
    throw new CheckoutError('Checkout session did not return a redirect URL.');
  }
  return url;
}

/**
 * Reads the `?checkout=` query param Stripe's success/cancel URLs come
 * back with. Pure string-parsing (accepts anything URLSearchParams
 * accepts — a "?..." string, a bare query string, or a full URL's
 * search portion) so the app-boot logic that decides which toast to
 * show, if any, is unit-tested without a real window.location.
 */
export function parseCheckoutReturnStatus(search) {
  const params = new URLSearchParams(search);
  const value = params.get('checkout');
  return value === 'success' || value === 'cancelled' ? value : null;
}
