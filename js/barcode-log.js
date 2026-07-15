// barcode-log.js
// Barcode side of packaged-food logging: get a barcode (camera photo or
// typed manually) -> look it up on Open Food Facts -> normalize into
// this app's existing foodItem shape -> hand off to the search flow's
// own selectFood()/confirm-log-btn, rather than building a second
// review UI. A barcode is always exactly one product, unlike a photo
// which can hold several dishes, so there's no multi-item review sheet
// to build here — the existing detail/grams/confirm screen already
// does everything a single matched item needs.
//
// No server-side function needed either: Open Food Facts' product-read
// endpoint is free, keyless, and meant to be called straight from a
// client (unlike the vision API in Phase 4, which had to hide a paid
// key behind a function). See:
// https://openfoodfacts.github.io/openfoodfacts-server/api/

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const KJ_PER_KCAL = 4.184;

/**
 * Sanity-checks a barcode before spending an API call on it — catches
 * an obviously bad manual entry (letters, a phone number, an empty
 * field) without trying to enforce exact EAN/UPC/GTIN length rules,
 * since OFF accepts several standard lengths and inventing a stricter
 * check here would just risk rejecting something valid.
 */
export function isValidBarcode(code) {
  const trimmed = String(code ?? '').trim();
  return /^\d{8,14}$/.test(trimmed);
}

export function isBarcodeDetectionSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export class BarcodeNotFoundError extends Error {
  constructor(barcode) {
    super(`No product found for barcode ${barcode}`);
    this.name = 'BarcodeNotFoundError';
    this.barcode = barcode;
  }
}

export class IncompleteProductError extends Error {
  constructor(barcode, name) {
    super(`${name || 'This product'} doesn't have nutrition data on Open Food Facts yet`);
    this.name = 'IncompleteProductError';
    this.barcode = barcode;
  }
}

function toNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * OFF entries are community-filled and don't always have the direct
 * kcal field — some only have energy in kJ. Split out on its own since
 * getting this conversion wrong silently mislabels every calorie value
 * downstream, and a fixed kJ input makes it trivial to check by hand.
 */
export function deriveCaloriesPer100g(nutriments) {
  const kcal = toNonNegativeNumber(nutriments?.['energy-kcal_100g']);
  if (kcal !== null) return kcal;
  const kj = toNonNegativeNumber(nutriments?.['energy_100g']);
  if (kj !== null) return kj / KJ_PER_KCAL;
  return null;
}

/**
 * Normalizes a raw OFF API response into the same {id, name, source,
 * caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g} shape
 * searchFoods() already returns — so the result can go straight into
 * the existing scaleToGrams()/logFood() pipeline (and, for free, into
 * frequent_foods the next time logFood's touchFrequentFood runs — a
 * second scan of the same product becomes a Recent-list tap, no API
 * call needed). Missing macros default to 0 rather than blocking the
 * log — calories is the number the rest of the flow depends on
 * (confirmLargeEntry, the daily total); a product with calories but an
 * incomplete macro breakdown is still usable. Missing name or calories
 * isn't, so those throw instead of silently logging a zero/placeholder.
 */
export function normalizeOFFProduct(barcode, data) {
  if (!data || data.status !== 1 || !data.product) {
    throw new BarcodeNotFoundError(barcode);
  }
  const product = data.product;
  const name = typeof product.product_name === 'string' ? product.product_name.trim() : '';
  const caloriesPer100g = deriveCaloriesPer100g(product.nutriments ?? {});

  if (!name || caloriesPer100g === null) {
    throw new IncompleteProductError(barcode, name);
  }

  const brand = typeof product.brands === 'string' ? product.brands.split(',')[0].trim() : '';

  return {
    id: `off-${barcode}`,
    name: brand ? `${name} (${brand})` : name,
    source: 'Open Food Facts',
    caloriesPer100g: Math.round(caloriesPer100g),
    proteinPer100g: toNonNegativeNumber(product.nutriments?.proteins_100g) ?? 0,
    carbsPer100g: toNonNegativeNumber(product.nutriments?.carbohydrates_100g) ?? 0,
    fatPer100g: toNonNegativeNumber(product.nutriments?.fat_100g) ?? 0,
  };
}

/**
 * Fetches and normalizes a product by barcode. No key, no auth — OFF's
 * product-read endpoint is open by design. One thing worth knowing:
 * OFF asks integrators to send a descriptive User-Agent, but browsers
 * block scripts from setting that header at all (a forbidden header
 * name per the Fetch spec) — there's no client-side way to honor that
 * request. If this ever moves behind a function for other reasons,
 * set one there.
 */
export async function lookupBarcode(barcode) {
  const trimmed = String(barcode ?? '').trim();
  if (!isValidBarcode(trimmed)) {
    throw new Error("That doesn't look like a valid barcode");
  }
  const url = `${OFF_BASE_URL}/${trimmed}.json?fields=product_name,brands,nutriments`;
  const res = await fetch(url);
  if (res.status === 503) {
    throw new Error('Open Food Facts is busy right now — try again in a moment');
  }
  if (!res.ok) {
    throw new Error(`Barcode lookup failed (${res.status})`);
  }
  return normalizeOFFProduct(trimmed, await res.json());
}

/**
 * Decodes a single captured photo (same file-input-with-capture
 * pattern as photo-log.js, not a live getUserMedia video loop — this
 * app has no live-scanning code anywhere yet, and reusing the pattern
 * that's already proven to work here is worth more than a marginally
 * faster scan) and runs the browser's native BarcodeDetector on it
 * once. Returns the first detected value, or null if none found —
 * callers should fall back to manual entry either way, since
 * BarcodeDetector doesn't exist on every browser (notably Safari) and
 * a blurry or angled photo just won't decode even where it does exist.
 */
export async function detectBarcodeFromImage(file) {
  if (!isBarcodeDetectionSupported()) return null;

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('Could not decode the image'));
    image.onload = () => resolve(image);
    image.src = dataUrl;
  });

  const detector = new window.BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
  });
  const codes = await detector.detect(img);
  return codes.length > 0 ? codes[0].rawValue : null;
}
