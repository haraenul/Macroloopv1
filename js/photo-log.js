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
const PHOTO_FUNCTION_URL = '/.netlify/functions/analyze-meal-photo';

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
 */
export function normalizePhotoAnalysis(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    items: items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Unknown item',
        estimated_portion: typeof item.estimated_portion === 'string' ? item.estimated_portion : '',
        calories: toNonNegativeNumber(item.calories),
        protein_g: toNonNegativeNumber(item.protein_g),
        carbs_g: toNonNegativeNumber(item.carbs_g),
        fat_g: toNonNegativeNumber(item.fat_g),
        confidence: VALID_CONFIDENCE.has(item.confidence) ? item.confidence : 'medium',
      })),
  };
}

/**
 * Calls the analysis function. idToken is required — the function uses
 * it to verify who's calling (brief 7's rate limit / free-tier cap has
 * to be enforced against a trusted uid, not one the client could just
 * claim) — see the function source for the server side of this.
 */
export async function analyzeMealPhoto(imageBase64, idToken) {
  const res = await fetch(PHOTO_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ imageBase64 }),
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new PhotoLimitError(body.limit ?? 3);
  }
  if (!res.ok) {
    throw new Error(`Photo analysis failed (${res.status})`);
  }
  return normalizePhotoAnalysis(await res.json());
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
