// netlify/functions/food-photo.js
//
// Server-side proxy for Unsplash's Random Photo endpoint. The Access Key
// must stay out of client code — this is not just good practice, it's a
// hard requirement in Unsplash's own API Guidelines: "Your application's
// Access Key and Secret Key must remain confidential. This may require
// using a proxy if accessing the API client-side." This function is that
// proxy. Only the Access Key is ever read here; the Secret Key is for an
// OAuth flow this app doesn't use (letting a user log into Unsplash
// through the app) and isn't needed for read-only photo requests.
//
// Deliberately NOT gated behind Firebase auth like analyze-meal-photo.js:
// the first place this is used (the intro screens) runs before a new
// user has signed up, so there's no ID token yet to verify. There's also
// no per-user cost or quota to protect here the way there is for the
// paid vision-model calls, so the asymmetry with that function is
// intentional, not an oversight.
//
// Needs one environment variable set in Netlify:
//   UNSPLASH_ACCESS_KEY  - the Access Key from unsplash.com/developers
//                           (the app's "Keys" section, NOT the Secret Key)

const UTM = 'utm_source=macroloop&utm_medium=referral';

function jsonResponse(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const query = (event.queryStringParameters || {}).query;
  if (!query || typeof query !== 'string' || query.length > 100) {
    return jsonResponse(400, { error: 'missing_or_invalid_query' });
  }
  const orientation = (event.queryStringParameters || {}).orientation === 'squarish' ? 'squarish' : 'landscape';

  if (!process.env.UNSPLASH_ACCESS_KEY) {
    console.error('food-photo: UNSPLASH_ACCESS_KEY not configured in this environment');
    return jsonResponse(500, { error: 'not_configured' });
  }

  let data;
  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=${orientation}&content_filter=high`,
      { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } },
    );
    if (!response.ok) {
      const bodyText = await response.text();
      console.error('food-photo: Unsplash returned', response.status, bodyText.slice(0, 300));
      // 403 here almost always means the Demo app hasn't had its Access
      // Key's domain/rate-limit sorted yet, or the 50/hour Demo cap was
      // hit — both are useful to tell apart from a generic 502 in logs.
      return jsonResponse(response.status === 403 || response.status === 429 ? 429 : 502, { error: 'unsplash_error' });
    }
    data = await response.json();
  } catch (err) {
    console.error('food-photo: network error reaching Unsplash', err);
    return jsonResponse(502, { error: 'unsplash_unreachable' });
  }

  if (!data.urls?.regular) {
    console.error('food-photo: unexpected Unsplash response shape', JSON.stringify(data).slice(0, 300));
    return jsonResponse(502, { error: 'unexpected_response' });
  }

  // Only what the client needs to hotlink (never re-host — required by
  // Unsplash's Hotlinking guideline) and attribute (required by their
  // Attribution guideline) the photo. Not the raw response, which would
  // pass along more than the client has any use for.
  return jsonResponse(200, {
    url: data.urls.regular,
    urlSmall: data.urls.small,
    colorHint: data.color,
    photographerName: data.user?.name || 'Unknown',
    photographerUrl: data.user?.links?.html ? `${data.user.links.html}?${UTM}` : `https://unsplash.com/?${UTM}`,
    unsplashUrl: `https://unsplash.com/?${UTM}`,
  });
};
