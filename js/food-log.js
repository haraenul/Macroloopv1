// food-log.js
// Manual food search (USDA FoodData Central + Open Food Facts) and
// logging. Photo-based logging is Phase 4 and lives in photo-log.js.
//
// Two things found while researching this file that change how it's
// written, worth knowing before you touch it:
//
// 1. USDA's /foods/search endpoint has historically returned foodNutrients
//    in a flatter shape (nutrientId/value) than the /food/{id} detail
//    endpoint (nested nutrient.id/amount). Rather than bet on one shape,
//    getNutrient() below reads either. Nutrient values are per 100g for
//    SR Legacy/Foundation foods — always scale from 100g, never assume
//    "per serving".
// 2. Open Food Facts's legacy free-text search (/cgi/search.pl and
//    /api/v2/search) is now flagged by OFF itself as deprecated and has
//    been intermittently returning 503s. Their replacement is
//    Search-a-licious (search.openfoodfacts.org) — currently in beta.
//    This file uses it, wrapped so a failure there degrades to
//    USDA-only results instead of breaking the whole search. Barcode
//    lookups (not used here yet) are unaffected either way.
//
// OFF also rate-limits search to 10 req/min/IP and explicitly asks not to
// wire it to search-as-you-type — see debounce() below and use it.

// Firebase is imported lazily inside the specific functions that need it
// (not at the top of this file) so the pure functions here — scaleToGrams,
// aggregateDailyCalories — stay testable in plain Node. A static top-level
// import would drag in firebase.js's https:// URL imports, which Node's
// module loader can't resolve outside a browser.

// TODO: sign up for a free key at https://fdc.nal.usda.gov/api-key-signup.html
// and paste it here. DEMO_KEY works but has a much lower rate limit.
// This key is client-visible as written (no Netlify function in Phase 1)
// — low stakes since it's free/rate-limited rather than billed, but close
// this out by proxying it once the Phase 4 Netlify function exists.
const USDA_API_KEY = 'DEMO_KEY';

const USDA_NUTRIENT_IDS = { energy: 1008, protein: 1003, fat: 1004, carbs: 1005 };

// ---- USDA FoodData Central ----

function getNutrient(foodNutrients, nutrientId) {
  if (!Array.isArray(foodNutrients)) return 0;
  const hit = foodNutrients.find(
    (n) => n.nutrientId === nutrientId || n.nutrient?.id === nutrientId
  );
  if (!hit) return 0;
  return hit.value ?? hit.amount ?? 0;
}

async function searchUSDA(queryText) {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', USDA_API_KEY);
  url.searchParams.set('query', queryText);
  url.searchParams.set('pageSize', '15');
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Branded');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA search failed: ${res.status}`);
  const data = await res.json();

  const items = (data.foods ?? []).map((food) => ({
    id: `usda:${food.fdcId}`,
    name: food.description,
    source: 'usda',
    // USDA's own well-known gap: many entries — especially Branded —
    // share an identical description ("CHICKEN BREAST") with wildly
    // different calories, and nothing in the name explains why. dataType
    // and brand are the fields that actually disambiguate; surface both.
    dataType: food.dataType ?? null, // 'Foundation' | 'SR Legacy' | 'Branded' | 'Survey (FNDDS)'
    brandOwner: food.brandOwner || food.brandName || null,
    servingSize: food.servingSize && food.servingSizeUnit ? `${food.servingSize}${food.servingSizeUnit}` : null,
    caloriesPer100g: getNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.energy),
    proteinPer100g: getNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.protein),
    carbsPer100g: getNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.carbs),
    fatPer100g: getNutrient(food.foodNutrients, USDA_NUTRIENT_IDS.fat),
    defaultGrams: 100,
  }));

  // Generic reference foods first (what a plain "chicken breast" search
  // usually wants), branded/specific products after. Sort is stable, so
  // USDA's own relevance order is preserved within each group.
  return items.sort((a, b) => (a.dataType === 'Branded' ? 1 : 0) - (b.dataType === 'Branded' ? 1 : 0));
}

// ---- Open Food Facts (via Search-a-licious) ----

async function searchOFF(queryText) {
  const url = new URL('https://search.openfoodfacts.org/search');
  url.searchParams.set('q', queryText);
  url.searchParams.set('page_size', '15');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OFF search failed: ${res.status}`);
  const data = await res.json();

  // Beta API — response shape isn't fully pinned down, so read defensively
  // and bail to an empty list rather than throw on an unexpected shape.
  const hits = data.hits ?? data.products ?? [];

  return hits
    .map((hit) => {
      const n = hit.nutriments ?? {};
      const per100 = (key) => n[`${key}_100g`] ?? n[key] ?? 0;
      return {
        id: `off:${hit.code ?? hit._id ?? hit.id}`,
        name: hit.product_name ?? hit.product_name_en ?? 'Unknown product',
        source: 'off',
        dataType: null,
        brandOwner: hit.brands || null,
        servingSize: hit.serving_size || null,
        caloriesPer100g: per100('energy-kcal'),
        proteinPer100g: per100('proteins'),
        carbsPer100g: per100('carbohydrates'),
        fatPer100g: per100('fat'),
        defaultGrams: 100,
      };
    })
    .filter((item) => item.name && item.name !== 'Unknown product');
}

/**
 * Searches both providers concurrently. A failure in one (OFF's beta
 * search in particular) doesn't take down the other — you get USDA
 * results with OFF silently omitted rather than no results at all.
 */
export async function searchFoods(queryText) {
  const [usda, off] = await Promise.allSettled([searchUSDA(queryText), searchOFF(queryText)]);
  const results = [];
  if (usda.status === 'fulfilled') results.push(...usda.value);
  else console.warn('USDA search failed:', usda.reason);
  if (off.status === 'fulfilled') results.push(...off.value);
  else console.warn('OFF search failed:', off.reason);
  return results;
}

/** Wrap the search-input handler with this — OFF allows 10 req/min/IP. */
export function debounce(fn, ms = 600) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ---- Scaling + logging ----

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** Scales a searched food's per-100g values to the grams actually eaten. */
export function scaleToGrams(foodItem, grams) {
  const factor = grams / 100;
  return {
    calories: Math.round(foodItem.caloriesPer100g * factor),
    protein_g: round1(foodItem.proteinPer100g * factor),
    carbs_g: round1(foodItem.carbsPer100g * factor),
    fat_g: round1(foodItem.fatPer100g * factor),
  };
}

/**
 * Logs a food entry and updates the frequent-foods list in one call.
 * grams is what the user actually confirmed eating.
 */
export async function logFood(uid, date, foodItem, grams) {
  const { addFoodLogEntry, touchFrequentFood } = await import('./firebase.js');
  const scaled = scaleToGrams(foodItem, grams);
  const entry = {
    name: foodItem.name,
    ...scaled,
    grams,
    source: foodItem.source,
    timestamp: new Date().toISOString(),
  };
  const entryId = await addFoodLogEntry(uid, date, entry);
  await touchFrequentFood(uid, foodItem.id, {
    name: foodItem.name,
    caloriesPer100g: foodItem.caloriesPer100g,
    proteinPer100g: foodItem.proteinPer100g,
    carbsPer100g: foodItem.carbsPer100g,
    fatPer100g: foodItem.fatPer100g,
    defaultGrams: grams,
  });
  return entryId;
}

/** Frequent foods sorted by how often they're actually used — brief 4.2. */
export async function getFrequentFoodsSorted(uid) {
  const { getFrequentFoods } = await import('./firebase.js');
  const map = await getFrequentFoods(uid);
  return Object.entries(map)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0));
}

// ---- Daily calorie totals (Progress trend chart) ----

function enumerateDates(startDate, endDate) {
  const dates = [];
  const cur = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const pad = (n) => String(n).padStart(2, '0');
  while (cur <= end) {
    dates.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * Pure: sums calories per date from a getFoodLogRange()-shaped object
 * ({date: {entryId: entry}}), filling 0 for days with no entries so the
 * trend chart shows real gaps instead of silently skipping them.
 */
export function aggregateDailyCalories(foodLogRange, startDate, endDate) {
  return enumerateDates(startDate, endDate).map((date) => {
    const entries = Object.values(foodLogRange[date] ?? {});
    const total = entries.reduce((sum, e) => sum + (e.calories || 0), 0);
    return { x: date, y: total };
  });
}

export async function getDailyCalorieTotals(uid, startDate, endDate) {
  const { getFoodLogRange } = await import('./firebase.js');
  const range = await getFoodLogRange(uid, startDate, endDate);
  return aggregateDailyCalories(range, startDate, endDate);
}
