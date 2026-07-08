// gap-fixer.test.js
// Run: node js/gap-fixer.test.js

import assert from 'node:assert/strict';
import { pickGapFixerCombos, COMBO_LIBRARY } from './gap-fixer.js';

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

test('no calories remaining returns no combos, not an error', () => {
  const result = pickGapFixerCombos({
    remainingCalories: 0, remainingProtein: 20, remainingCarbs: 20, remainingFat: 10,
    targetProtein: 100, targetCarbs: 200, targetFat: 60,
  });
  assert.deepEqual(result.combos, []);
  assert.equal(result.priorityMacro, null);
});

test('every returned combo fits within the remaining calorie budget', () => {
  const { combos } = pickGapFixerCombos({
    remainingCalories: 250, remainingProtein: 30, remainingCarbs: 20, remainingFat: 10,
    targetProtein: 100, targetCarbs: 200, targetFat: 60,
  });
  combos.forEach((c) => assert.ok(c.calories <= 250, `${c.id} at ${c.calories} exceeds the 250 budget`));
});

test('a protein shortfall that is small in grams but large as a fraction of target still wins the ranking', () => {
  // Protein: 10g remaining of a 20g target = 50% left (a big relative gap).
  // Carbs: 40g remaining of a 300g target = ~13% left (a small relative gap).
  // A raw-gram comparison would wrongly favor carbs (40 > 10); the
  // relative comparison should correctly favor protein.
  const { priorityMacro } = pickGapFixerCombos({
    remainingCalories: 500,
    remainingProtein: 10, targetProtein: 20,
    remainingCarbs: 40, targetCarbs: 300,
    remainingFat: 5, targetFat: 60,
  });
  assert.equal(priorityMacro, 'protein_g');
});

test('ranked combos are sorted by the priority macro, highest first', () => {
  const { combos, priorityMacro } = pickGapFixerCombos({
    remainingCalories: 1000,
    remainingProtein: 80, targetProtein: 100,
    remainingCarbs: 20, targetCarbs: 200,
    remainingFat: 5, targetFat: 60,
    count: 5,
  });
  assert.equal(priorityMacro, 'protein_g');
  for (let i = 1; i < combos.length; i++) {
    assert.ok(combos[i - 1].protein_g >= combos[i].protein_g, 'not sorted descending by protein_g');
  }
});

test('count limits how many combos come back', () => {
  const { combos } = pickGapFixerCombos({
    remainingCalories: 2000,
    remainingProtein: 100, targetProtein: 100,
    remainingCarbs: 100, targetCarbs: 100,
    remainingFat: 100, targetFat: 100,
    count: 2,
  });
  assert.equal(combos.length, 2);
});

test('a very small remaining budget that fits nothing returns an empty list, not a crash', () => {
  const { combos } = pickGapFixerCombos({
    remainingCalories: 10,
    remainingProtein: 5, targetProtein: 100,
    remainingCarbs: 5, targetCarbs: 100,
    remainingFat: 5, targetFat: 100,
  });
  assert.deepEqual(combos, []);
});

test('every combo in the library has a positive calorie value and all four macro fields', () => {
  COMBO_LIBRARY.forEach((c) => {
    assert.ok(c.calories > 0, `${c.id} has non-positive calories`);
    ['protein_g', 'carbs_g', 'fat_g'].forEach((field) => {
      assert.ok(typeof c[field] === 'number' && c[field] >= 0, `${c.id} missing/invalid ${field}`);
    });
  });
});

// --- excludeIds rotation (the confirmed "refresh does nothing" bug) ---

test('the exact bug report: calling twice with no exclusion returns identical combos', () => {
  const args = {
    remainingCalories: 500,
    remainingProtein: 30, targetProtein: 100,
    remainingCarbs: 40, targetCarbs: 200,
    remainingFat: 10, targetFat: 60,
  };
  const first = pickGapFixerCombos(args);
  const second = pickGapFixerCombos(args);
  assert.deepEqual(second.combos.map((c) => c.id), first.combos.map((c) => c.id));
});

test('passing the first call\u2019s ids as excludeIds surfaces different combos on the second call', () => {
  const args = {
    remainingCalories: 500,
    remainingProtein: 30, targetProtein: 100,
    remainingCarbs: 40, targetCarbs: 200,
    remainingFat: 10, targetFat: 60,
  };
  const first = pickGapFixerCombos(args);
  const second = pickGapFixerCombos({ ...args, excludeIds: first.combos.map((c) => c.id) });
  const overlap = second.combos.filter((c) => first.combos.some((f) => f.id === c.id));
  assert.deepEqual(overlap, []);
});

test('once exclusions exhaust everything that fits, the list resets instead of dead-ending empty', () => {
  const args = {
    remainingCalories: 200, // only a few combos fit this budget at all
    remainingProtein: 30, targetProtein: 100,
    remainingCarbs: 40, targetCarbs: 200,
    remainingFat: 10, targetFat: 60,
    count: 10,
  };
  const allFitting = pickGapFixerCombos(args).combos;
  // Exclude every single one that fits — nothing should be left to show.
  const second = pickGapFixerCombos({ ...args, excludeIds: allFitting.map((c) => c.id) });
  assert.ok(second.combos.length > 0, 'expected a reset, not an empty list, once everything fitting was excluded');
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
