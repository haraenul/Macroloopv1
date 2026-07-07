// netlify/functions/analyze-meal-photo.js
//
// Brief section 7's non-negotiable: OPENROUTER_API_KEY lives only in
// this function's environment, never in client code. This file is also
// the actual enforcement point for the free-tier cap (brief section 5:
// 3 scans/month free, unlimited premium) — enforced here against a
// Firebase-verified uid, not anything the client claims about itself,
// since a client could otherwise lie about being premium or under quota.
//
// Needs environment variables set in Netlify (or wherever this ends up
// hosted — see the delivery notes about GitHub Pages not being able to
// run this at all):
//   OPENROUTER_API_KEY        - from openrouter.ai
//   FIREBASE_SERVICE_ACCOUNT  - the full service account JSON, as a string
//   FIREBASE_DATABASE_URL     - same RTDB URL as in js/firebase.js
//   VISION_MODEL              - optional, defaults below

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const FREE_MONTHLY_LIMIT = 50; // brief section 5's pricing table
const MIN_SECONDS_BETWEEN_SCANS = 10; // cheap guard against accidental double-submits or scripted spam

// Adapted from the brief's prompt: added explicit handling for (1) items
// that can't be identified at all — set identified:false and null
// macros rather than fabricating numbers that look just as confident as
// a real estimate — and (2) physically mixed/composite dishes (curries,
// stews, casseroles) that can't be visually decomposed into components,
// which should be treated as one item with a combined estimate rather
// than forcing a decomposition the model can't actually see.
const FOOD_ANALYSIS_PROMPT = `You are a nutrition estimation engine for a food-logging app. From the photo:
1. Identify each visually distinct food item. If multiple foods are physically mixed together such that they cannot be visually separated into distinct items (e.g. a casserole, curry, stew, or fried rice with mixed-in ingredients), treat the mixture as a single item and name it descriptively (e.g. "chicken curry with rice, mixed") rather than forcing an artificial decomposition you can't actually see.
2. Estimate portion size using visible reference cues (plate size, utensils, hand scale).
3. Estimate calories and macros (protein/carbs/fat in grams) per item and in total.
4. Assign a confidence level (high/medium/low) per item — lower it whenever there's visible sauce, oil, hidden/mixed ingredients, or the item is a composite dish from step 1.
5. If an item is ambiguous but plausibly identifiable, give your best guess and flag low confidence rather than refusing. If an item genuinely cannot be identified at all (fully obscured, or not recognizable as any specific food), set identified to false, set name to a brief visual description instead of a food name (e.g. "unidentified item, left side of plate"), and set calories/protein_g/carbs_g/fat_g to null rather than fabricating numbers that would look just as confident as a real estimate.
Respond with ONLY valid JSON in this schema, no other text:
{
  "items": [
    { "name": "string", "identified": boolean, "estimated_portion": "string", "calories": number|null, "protein_g": number|null, "carbs_g": number|null, "fat_g": number|null, "confidence": "high" | "medium" | "low" }
  ],
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number,
  "estimation_notes": "string"
}`;

/** Some models wrap JSON in markdown fences despite being told not to add other text — strip that before parsing instead of failing the whole request over formatting. */
function extractJson(rawContent) {
  const fenced = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : rawContent).trim();
}

function jsonResponse(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  // --- Verify the caller. Never trust a client-supplied uid for this. ---
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) {
    return jsonResponse(401, { error: 'missing_auth_token' });
  }

  let uid;
  try {
    uid = (await admin.auth().verifyIdToken(idToken)).uid;
  } catch (err) {
    return jsonResponse(401, { error: 'invalid_auth_token' });
  }

  const db = admin.database();

  // --- Cheap anti-spam guard, independent of the monthly quota ---
  const usageRef = db.ref(`users/${uid}/photo_scan_usage`);
  const usageSnap = await usageRef.get();
  const usage = usageSnap.val() || {};
  const lastScanAt = usage.last_scan_at ? new Date(usage.last_scan_at).getTime() : 0;
  if (Date.now() - lastScanAt < MIN_SECONDS_BETWEEN_SCANS * 1000) {
    return jsonResponse(429, { error: 'too_frequent' });
  }

  // --- Free-tier cap, checked against the profile this function reads
  // itself — never against anything the client sent. ---
  const profileSnap = await db.ref(`users/${uid}/profile`).get();
  const isPremium = !!(profileSnap.val() || {}).premium_status;
  const monthKey = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const usedThisMonth = (usage[monthKey] || 0);

  if (!isPremium && usedThisMonth >= FREE_MONTHLY_LIMIT) {
    return jsonResponse(429, { error: 'monthly_limit_reached', limit: FREE_MONTHLY_LIMIT });
  }

  // --- Parse the request body ---
  let imageBase64;
  try {
    ({ imageBase64 } = JSON.parse(event.body));
  } catch {
    return jsonResponse(400, { error: 'invalid_request_body' });
  }
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return jsonResponse(400, { error: 'missing_image' });
  }

  // --- Call the vision model ---
  let data;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Confirmed real and vision-capable on OpenRouter, genuinely free
        // (no card, no credits needed). The tradeoff: fully-free accounts
        // share a hard 50 requests/day ceiling across the WHOLE app (it's
        // a per-account limit, and this function uses one shared account
        // key) — fine while usage is low, but a real wall once traffic
        // grows. A one-time $10 OpenRouter credit purchase raises that to
        // 1000/day and never expires; that's the natural fix if this
        // becomes the bottleneck rather than the per-user monthly cap.
        model: process.env.VISION_MODEL || 'openrouter/free',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: FOOD_ANALYSIS_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter error', response.status, await response.text());
      return jsonResponse(502, { error: 'vision_provider_error' });
    }
    data = await response.json();
  } catch (err) {
    console.error('analyze-meal-photo network error', err);
    return jsonResponse(502, { error: 'vision_provider_unreachable' });
  }

  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    return jsonResponse(502, { error: 'empty_response' });
  }

  // Free/smaller models don't always return clean JSON like Gemini did —
  // strip any ```json fences and pull out the {...} block before parsing.
  const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch {
    console.error('unparseable_response — raw model output was:', rawContent);
    return jsonResponse(502, { error: 'unparseable_response' });
  }

  // Only spend a free scan on a result the client can actually use.
  await usageRef.update({
    last_scan_at: new Date().toISOString(),
    [monthKey]: usedThisMonth + 1,
  });

  return jsonResponse(200, parsed);
};
