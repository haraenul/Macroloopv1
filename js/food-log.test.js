// food-log.test.js
// Run: node js/food-log.test.js

import assert from 'node:assert/strict';
import { scaleToGrams, aggregateDailyCalories } from './food-log.js';

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

test('scaling to 100g returns the per-100g values unchanged', () => {
  const item = { caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 };
  assert.deepEqual(scaleToGrams(item, 100), { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 });
});

test('scaling to half the amount halves every value', () => {
  const item = { caloriesPer100g: 200, proteinPer100g: 20, carbsPer100g: 10, fatPer100g: 8 };
  assert.deepEqual(scaleToGrams(item, 50), { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 4 });
});

test('scaling to 0g returns all zeros, not NaN', () => {
  const item = { caloriesPer100g: 200, proteinPer100g: 20, carbsPer100g: 10, fatPer100g: 8 };
  assert.deepEqual(scaleToGrams(item, 0), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
});

test('aggregateDailyCalories fills days with no entries as 0, not a gap', () => {
  const range = {
    '2026-07-01': { e1: { calories: 500 } },
    // 07-02 has no entries at all
    '2026-07-03': { e1: { calories: 300 }, e2: { calories: 200 } },
  };
  const series = aggregateDailyCalories(range, '2026-07-01', '2026-07-03');
  assert.deepEqual(series, [
    { x: '2026-07-01', y: 500 },
    { x: '2026-07-02', y: 0 },
    { x: '2026-07-03', y: 500 },
  ]);
});

test('aggregateDailyCalories sums multiple entries on the same day', () => {
  const range = { '2026-07-01': { a: { calories: 100 }, b: { calories: 250 }, c: { calories: 50 } } };
  const series = aggregateDailyCalories(range, '2026-07-01', '2026-07-01');
  assert.deepEqual(series, [{ x: '2026-07-01', y: 400 }]);
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
