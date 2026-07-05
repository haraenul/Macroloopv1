// exercise-log.test.js
// Run: node js/exercise-log.test.js

import assert from 'node:assert/strict';
import { calculateCaloriesBurned, ACTIVITIES } from './exercise-log.js';

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

test('30 min brisk walk at 70kg matches the compendium formula by hand', () => {
  // 4.3 MET * 70kg * 0.5h = 150.5 -> rounds to 151
  assert.equal(calculateCaloriesBurned(4.3, 70, 30), 151);
});

test('doubling duration doubles calories burned (linear in time)', () => {
  const half = calculateCaloriesBurned(7.5, 80, 30);
  const full = calculateCaloriesBurned(7.5, 80, 60);
  assert.equal(full, half * 2);
});

test('every catalog activity except "custom" has a positive MET value', () => {
  const missing = ACTIVITIES.filter((a) => a.id !== 'custom' && !(a.met > 0));
  assert.deepEqual(missing, []);
});

test('missing/zero inputs return 0, not NaN — a half-filled form should not show garbage', () => {
  assert.equal(calculateCaloriesBurned(null, 70, 30), 0);
  assert.equal(calculateCaloriesBurned(5, 70, 0), 0);
  assert.equal(calculateCaloriesBurned(5, 0, 30), 0);
  assert.equal(Number.isNaN(calculateCaloriesBurned(undefined, undefined, undefined)), false);
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
