// photo-log.js
// Client side of brief 4.3: capture -> compress -> call the function ->
// get back structured items -> the caller renders them as an EDITABLE
// DRAFT (never auto-committed) -> logPhotoItems() only runs after the
// user confirms.
//
// Configure this if the function ends up hosted somewhere other than
// same-origin Netlify Functions (e.g. GitHub Pages can't run functions
// at all — see the delivery notes for why this is a real decision, not
// a formality).
// DO NOT change this back to a relative path ('/.netlify/functions/...').
// This exact line has reverted to the relative default THREE times across
// different sessions/edits. It must stay a full absolute URL because the
// app is tested from GitHub Pages (a different origin than Netlify) —
// a relative path resolves against whatever origin loaded the page, and
// silently 404s from GitHub Pages specifically. If you're editing this
// file for an unrelated reason, leave this line untouched.
const PHOTO_FUNCTION_URL = 'soft-liger-d65c1e.netlify.app';

const MAX_DIMENSION = 1024; // plenty for food recognition; keeps the payload (and API cost) small
const JPEG_QUALITY = 0.8;

/** Pure aspect-ratio-preserving scale-down — pulled out so it's testable without a DOM/Image. */
export function computeResizeDimensions(width, height, maxDimension = MAX_DIMENSION) {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const scale = maxDimension / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Resizes/re-encodes an image file to a compressed base64 JPEG (no "data:" prefix). */
export function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the image'));
      img.onload = () => {
        const { width, height } = computeResizeDimensions(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export class PhotoLimitError extends Error {
  constructor(limit) {
    super(`Monthly free photo-scan limit (${limit}) reached`);
    this.name = 'PhotoLimitError';
    this.limit = limit;
  }
}

/** The request itself didn't complete — client's connection, or the function endpoint unreachable. Next step: retry. */
export class PhotoNetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PhotoNetworkError';
  }
}

/** The request completed, but the AI analysis pipeline or its output didn't hold up — a provider error, an unparseable/empty response, or zero usable items after validation. Next step: a clearer photo, or log manually. Distinct from PhotoNetworkError on purpose — "check your connection" is actively wrong advice for this case. */
export class PhotoValidationError extends Error {
  constructor(reason) {
    super(`Photo analysis did not produce a usable result: ${reason}`);
    this.name = 'PhotoValidationError';
    this.reason = reason;
  }
}

const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

function toNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Validates and normalizes the vision model's parsed JSON into the shape
 * the review UI expects. LLM JSON output can't be fully trusted even
 * with response_format: json_object enforced server-side — a field can
 * be missing, a number can arrive as a string, confidence can be some
 * unexpected value. Everything defaults defensively rather than letting
 * a malformed response crash the review screen. The item-level total is
 * computed by the caller by summing these (now-trustworthy) items,
 * rather than trusting the model's own reported total, which isn't
 * guaranteed to be internally consistent with its own item list.
 *
 * identified defaults to true unless the model explicitly says false —
 * an unidentified item keeps null macros rather than being coerced to 0,
 * since a silent zero looks like a confident "no calories" estimate
 * rather than "we don't know"; the review UI renders these distinctly
 * and asks the user to fill them in.
 */
export function normalizePhotoAnalysis(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    items: items
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const identified = item.identified !== false;
        return {
          name:
            typeof item.name === 'string' && item.name.trim()
              ? item.name.trim()
              : identified
              ? 'Unknown item'
              : 'Unidentified item',
          estimated_portion: typeof item.estimated_portion === 'string' ? item.estimated_portion : '',
          identified,
          calories: identified ? toNonNegativeNumber(item.calories) : null,
          protein_g: identified ? toNonNegativeNumber(item.protein_g) : null,
          carbs_g: identified ? toNonNegativeNumber(item.carbs_g) : null,
          fat_g: identified ? toNonNegativeNumber(item.fat_g) : null,
          confidence: VALID_CONFIDENCE.has(item.confidence) ? item.confidence : 'medium',
        };
      }),
  };
}

/**
 * Calls the analysis function. idToken is required — the function uses
 * it to verify who's calling (brief 7's rate limit / free-tier cap has
 * to be enforced against a trusted uid, not one the client could just
 * claim) — see the function source for the server side of this.
 *
 * Throws PhotoNetworkError, PhotoValidationError, or PhotoLimitError —
 * three distinct, deliberately different failure modes so the caller
 * can point the user at the right next step instead of one generic
 * "check your connection" message that's wrong for two of the three.
 */
export async function analyzeMealPhoto(imageBase64, idToken) {
  let res;
  try {
    res = await fetch(PHOTO_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ imageBase64 }),
    });
  } catch (err) {
    throw new PhotoNetworkError('Could not reach the photo analysis service.');
  }

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new PhotoLimitError(body.limit ?? 3);
  }
  if (res.status === 502) {
    // The function's own "the vision provider call or its response
    // didn't work out" cases — a validation/provider problem, not the
    // user's connection.
    const body = await res.json().catch(() => ({}));
    throw new PhotoValidationError(body.error ?? 'provider_error');
  }
  if (!res.ok) {
    throw new PhotoNetworkError(`Photo analysis request failed (${res.status}).`);
  }

  const normalized = normalizePhotoAnalysis(await res.json());
  if (normalized.items.length === 0) {
    throw new PhotoValidationError('no_items_recognized');
  }
  return normalized;
}

/**
 * True when the result is worth flagging before the user just logs it
 * blind: any unidentified items, or most of the identified ones came
 * back low confidence. Not an error — the analysis succeeded, it's just
 * uncertain — so this drives an inline banner in the review sheet, not
 * a thrown error or a toast.
 */
export function needsCloserLook(items) {
  if (items.some((item) => !item.identified)) return true;
  const identified = items.filter((item) => item.identified);
  if (identified.length === 0) return false;
  const lowCount = identified.filter((item) => item.confidence === 'low').length;
  return lowCount / identified.length >= 0.5;
}

/** Logs each reviewed/edited item as its own food_log entry — keeps the existing per-item schema rather than inventing a "meal" grouping. */
export async function logPhotoItems(uid, date, items) {
  const { addFoodLogEntry } = await import('./firebase.js');
  const ids = [];
  for (const item of items) {
    ids.push(
      await addFoodLogEntry(uid, date, {
        name: item.name,
        calories: Math.round(item.calories),
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        source: 'photo',
        timestamp: new Date().toISOString(),
      })
    );
  }
  return ids;
}
