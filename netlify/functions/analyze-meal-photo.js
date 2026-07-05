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

const FREE_MONTHLY_LIMIT = 3; // brief section 5's pricing table
const MIN_SECONDS_BETWEEN_SCANS = 10; // cheap guard against accidental double-submits or scripted spam

// Close to the brief's own prompt verbatim — it's specific and well-reasoned,
// no strong reason to rewrite it.
const FOOD_ANALYSIS_PROMPT = `You are a nutrition estimation engine for a food-logging app. From the photo:
1. Identify each visually distinct food item.
2. Estimate portion size using visible reference cues (plate size, utensils, hand scale).
3. Estimate calories and macros (protein/carbs/fat in grams) per item and in total.
4. Assign a confidence level (high/medium/low) per item — lower it whenever there's visible sauce, oil, or hidden/mixed ingredients.
If an item is ambiguous, give your best guess and flag low confidence rather than refusing.
Respond with ONLY valid JSON in this schema, no other text:
{
  "items": [
    { "name": "string", "estimated_portion": "string", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "confidence": "high" | "medium" | "low" }
  ],
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number,
  "estimation_notes": "string"
}`;

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
        // Provider-agnostic per the brief — swap via env var, no redeploy.
        // Double check this default is still current on OpenRouter before
        // going live; vision-model pricing/availability moves quickly.
        model: process.env.VISION_MODEL || 'google/gemini-2.5-flash',
        max_tokens: 2000,
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

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return jsonResponse(502, { error: 'unparseable_response' });
  }

  // Only spend a free scan on a result the client can actually use.
  await usageRef.update({
    last_scan_at: new Date().toISOString(),
    [monthKey]: usedThisMonth + 1,
  });

  return jsonResponse(200, parsed);
};
