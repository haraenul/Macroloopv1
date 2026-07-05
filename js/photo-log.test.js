// photo-log.test.js
// Run: node js/photo-log.test.js

import assert from 'node:assert/strict';
import { computeResizeDimensions, normalizePhotoAnalysis } from './photo-log.js';

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

// --- computeResizeDimensions ---

test('an image already under the max dimension is left unchanged', () => {
  assert.deepEqual(computeResizeDimensions(800, 600, 1024), { width: 800, height: 600 });
});

test('a wide image is scaled down by width, height follows proportionally', () => {
  const result = computeResizeDimensions(2048, 1024, 1024);
  assert.equal(result.width, 1024);
  assert.equal(result.height, 512);
});

test('a tall image is scaled down by height, width follows proportionally', () => {
  const result = computeResizeDimensions(1024, 2048, 1024);
  assert.equal(result.height, 1024);
  assert.equal(result.width, 512);
});

test('a square image exactly at the limit is left unchanged', () => {
  assert.deepEqual(computeResizeDimensions(1024, 1024, 1024), { width: 1024, height: 1024 });
});

// --- normalizePhotoAnalysis ---

test('a well-formed response passes through unchanged', () => {
  const raw = {
    items: [{ name: 'Rice', estimated_portion: '1 cup', calories: 200, protein_g: 4, carbs_g: 45, fat_g: 0, confidence: 'high' }],
  };
  const result = normalizePhotoAnalysis(raw);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].calories, 200);
  assert.equal(result.items[0].confidence, 'high');
});

test('missing or malformed numeric fields default to 0, not NaN', () => {
  const raw = { items: [{ name: 'Mystery', calories: 'a lot', protein_g: null }] };
  const result = normalizePhotoAnalysis(raw);
  assert.equal(result.items[0].calories, 0);
  assert.equal(result.items[0].protein_g, 0);
  assert.equal(Number.isNaN(result.items[0].calories), false);
});

test('an unexpected confidence value falls back to medium rather than breaking the badge display', () => {
  const raw = { items: [{ name: 'X', calories: 100, confidence: 'extremely sure' }] };
  assert.equal(normalizePhotoAnalysis(raw).items[0].confidence, 'medium');
});

test('a missing name falls back to a placeholder instead of an empty label', () => {
  const raw = { items: [{ calories: 50 }] };
  assert.equal(normalizePhotoAnalysis(raw).items[0].name, 'Unknown item');
});

test('a non-array or missing items field produces an empty list, not a crash', () => {
  assert.deepEqual(normalizePhotoAnalysis({}).items, []);
  assert.deepEqual(normalizePhotoAnalysis({ items: 'not an array' }).items, []);
  assert.deepEqual(normalizePhotoAnalysis(null).items, []);
  assert.deepEqual(normalizePhotoAnalysis(undefined).items, []);
});

test('malformed entries inside the items array are dropped, not left to crash rendering', () => {
  const raw = { items: [null, 'a string', 42, { name: 'Valid', calories: 50 }] };
  const result = normalizePhotoAnalysis(raw);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, 'Valid');
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
