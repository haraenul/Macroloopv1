// barcode-log.test.js
// Run: node js/barcode-log.test.js

import assert from 'node:assert/strict';
import {
  isValidBarcode,
  isBarcodeDetectionSupported,
  deriveCaloriesPer100g,
  normalizeOFFProduct,
  BarcodeNotFoundError,
  IncompleteProductError,
} from './barcode-log.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
    process.exitCode = 1;
  }
}

// --- isValidBarcode ---

test('accepts a 13-digit EAN-13', () => {
  assert.equal(isValidBarcode('3017624010701'), true);
});

test('accepts a 12-digit UPC-A', () => {
  assert.equal(isValidBarcode('012345678905'), true);
});

test('accepts an 8-digit EAN-8', () => {
  assert.equal(isValidBarcode('12345670'), true);
});

test('trims whitespace before checking', () => {
  assert.equal(isValidBarcode('  3017624010701  '), true);
});

test('rejects a barcode that is too short', () => {
  assert.equal(isValidBarcode('12345'), false);
});

test('rejects letters', () => {
  assert.equal(isValidBarcode('30176A4010701'), false);
});

test('rejects empty, null, and undefined', () => {
  assert.equal(isValidBarcode(''), false);
  assert.equal(isValidBarcode(null), false);
  assert.equal(isValidBarcode(undefined), false);
});

// --- isBarcodeDetectionSupported ---

test('reports unsupported in a plain Node environment (no window/BarcodeDetector)', () => {
  assert.equal(isBarcodeDetectionSupported(), false);
});

// --- deriveCaloriesPer100g ---

test('uses energy-kcal_100g directly when present', () => {
  assert.equal(deriveCaloriesPer100g({ 'energy-kcal_100g': 250 }), 250);
});

test('falls back to converting energy_100g from kJ when kcal is missing', () => {
  const result = deriveCaloriesPer100g({ energy_100g: 2000 });
  assert.ok(Math.abs(result - 478.01) < 0.05, `expected ~478.01, got ${result}`);
});

test('prefers the direct kcal field over converting kJ when both are present', () => {
  assert.equal(deriveCaloriesPer100g({ 'energy-kcal_100g': 250, energy_100g: 9999 }), 250);
});

test('returns null when neither energy field is present', () => {
  assert.equal(deriveCaloriesPer100g({}), null);
  assert.equal(deriveCaloriesPer100g(undefined), null);
});

test('parses a numeric string, since OFF fields are not always typed as numbers', () => {
  assert.equal(deriveCaloriesPer100g({ 'energy-kcal_100g': '250' }), 250);
});

test('rejects a negative value rather than trusting it', () => {
  assert.equal(deriveCaloriesPer100g({ 'energy-kcal_100g': -5 }), null);
});

// --- normalizeOFFProduct ---

test('status 0 (not in the database) throws BarcodeNotFoundError', () => {
  assert.throws(() => normalizeOFFProduct('123', { status: 0 }), BarcodeNotFoundError);
});

test('a missing product object throws BarcodeNotFoundError even if status says found', () => {
  assert.throws(() => normalizeOFFProduct('123', { status: 1 }), BarcodeNotFoundError);
});

test('a product with no name throws IncompleteProductError', () => {
  assert.throws(
    () => normalizeOFFProduct('123', { status: 1, product: { nutriments: { 'energy-kcal_100g': 250 } } }),
    IncompleteProductError
  );
});

test('a product with a name but no usable energy field throws IncompleteProductError', () => {
  assert.throws(
    () => normalizeOFFProduct('123', { status: 1, product: { product_name: 'Mystery Bar', nutriments: {} } }),
    IncompleteProductError
  );
});

test('a complete product normalizes into the app foodItem shape', () => {
  const result = normalizeOFFProduct('3017624010701', {
    status: 1,
    product: {
      product_name: 'Nutella',
      brands: 'Ferrero',
      nutriments: {
        'energy-kcal_100g': 539,
        proteins_100g: 6.3,
        carbohydrates_100g: 57.5,
        fat_100g: 30.9,
      },
    },
  });
  assert.deepEqual(result, {
    id: 'off-3017624010701',
    name: 'Nutella (Ferrero)',
    source: 'Open Food Facts',
    caloriesPer100g: 539,
    proteinPer100g: 6.3,
    carbsPer100g: 57.5,
    fatPer100g: 30.9,
  });
});

test('a product with no brand field uses the plain product name', () => {
  const result = normalizeOFFProduct('123', {
    status: 1,
    product: { product_name: 'Generic Rice', nutriments: { 'energy-kcal_100g': 130 } },
  });
  assert.equal(result.name, 'Generic Rice');
});

test('missing macro fields default to 0 rather than throwing, since calories is what matters most', () => {
  const result = normalizeOFFProduct('123', {
    status: 1,
    product: { product_name: 'Sparse Entry', nutriments: { 'energy-kcal_100g': 40 } },
  });
  assert.equal(result.proteinPer100g, 0);
  assert.equal(result.carbsPer100g, 0);
  assert.equal(result.fatPer100g, 0);
});

test('a kJ-only product still normalizes correctly end to end', () => {
  const result = normalizeOFFProduct('123', {
    status: 1,
    product: { product_name: 'Kilojoule Only', nutriments: { energy_100g: 1046 } },
  });
  assert.equal(result.caloriesPer100g, 250); // 1046 / 4.184 ≈ 250.0
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
