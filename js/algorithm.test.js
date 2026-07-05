// algorithm.test.js
// Run: node js/algorithm.test.js
//
// Plain Node + the built-in assert module — no test framework, matching
// the project's no-build-step philosophy. Exits non-zero on failure.
//
// Note: these cover the Phase 1 *static* formula. The brief's 4.5 worked
// example (2000 kcal/day, 14 days, -0.7kg -> 2385 kcal) is for the
// adaptive updateAdaptiveTDEE() function, which is Phase 3 scope — it
// belongs in this file once that function exists, not before.

import assert from 'node:assert/strict';
import {
  calculateBMR,
  calculateTDEE,
  calculateTarget,
  calculateMacroTargets,
  SAFETY_FLOOR_KCAL,
  ACTIVITY_MULTIPLIERS,
} from './algorithm.js';

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

// --- BMR: Mifflin-St Jeor, checked by hand ---

test('BMR (male) matches Mifflin-St Jeor by hand', () => {
  // 30yo male, 80kg, 180cm: 10*80 + 6.25*180 - 5*30 + 5 = 1780
  const bmr = calculateBMR({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 });
  assert.equal(bmr, 1780);
});

test('BMR (female) matches Mifflin-St Jeor by hand', () => {
  // 30yo female, 65kg, 165cm: 10*65 + 6.25*165 - 5*30 - 161 = 1370.25
  const bmr = calculateBMR({ sex: 'female', weightKg: 65, heightCm: 165, age: 30 });
  assert.equal(bmr, 1370.25);
});

// --- TDEE ---

test('TDEE applies the sedentary multiplier', () => {
  assert.equal(calculateTDEE(1780, 'sedentary'), 1780 * ACTIVITY_MULTIPLIERS.sedentary);
});

test('TDEE throws on an unrecognized activity level', () => {
  assert.throws(() => calculateTDEE(1780, 'superhuman'));
});

// --- Target: deficit math should check out in both directions ---

test('a 1%/week cut on an 80kg male comes out to TDEE minus 880 kcal/day', () => {
  // weeklyChange = 0.01 * 80kg * 7700 = 6160 kcal/week -> /7 = 880 kcal/day.
  // Comfortably above the 1500 floor, so this exercises the plain math path.
  const { target, warning } = calculateTarget({
    tdee: 2500,
    goal: 'lose',
    weightKg: 80,
    sex: 'male',
    ratePercent: 1,
  });
  assert.equal(target, 2500 - 880);
  assert.equal(warning, null); // 1% is the top of "sustainable", not past it
});

test('maintain returns TDEE unchanged, no floor logic involved', () => {
  const { target, warning } = calculateTarget({
    tdee: 2200,
    goal: 'maintain',
    weightKg: 70,
    sex: 'female',
  });
  assert.equal(target, 2200);
  assert.equal(warning, null);
});

test('a rate past 1%/week warns even when it does not hit the floor', () => {
  const { warning } = calculateTarget({
    tdee: 2800,
    goal: 'lose',
    weightKg: 90,
    sex: 'male',
    ratePercent: 1.5,
  });
  assert.ok(warning, 'expected a sustainability warning above 1%/week');
});

// --- Safety floor: the one guarantee here that can't fail silently ---

test('an aggressive cut on a low-TDEE profile is clamped to the female floor', () => {
  // Small, older, sedentary woman: BMR = 10*50 + 6.25*155 - 5*45 - 161 = 1082.75
  // TDEE (sedentary x1.2) = 1299.3
  // 1%/week cut = 50kg * 7700 * 0.01 / 7 = 550 kcal/day -> raw target ~749.3,
  // well under the 1200 floor. The clamp must catch this, not pass it through.
  const bmr = calculateBMR({ sex: 'female', weightKg: 50, heightCm: 155, age: 45 });
  const tdee = calculateTDEE(bmr, 'sedentary');
  const { target, warning } = calculateTarget({
    tdee,
    goal: 'lose',
    weightKg: 50,
    sex: 'female',
    ratePercent: 1,
  });
  assert.equal(target, SAFETY_FLOOR_KCAL.female);
  assert.ok(warning, 'expected a warning when the floor clamps the target');
});

test('the male floor (not the female one) is used for a male profile', () => {
  const { target } = calculateTarget({
    tdee: 1400,
    goal: 'lose',
    weightKg: 55,
    sex: 'male',
    ratePercent: 1,
  });
  assert.equal(target, SAFETY_FLOOR_KCAL.male);
});

// --- Macro split ---

test('macro grams reconstruct back to close to the calorie target', () => {
  const { proteinG, fatG, carbG } = calculateMacroTargets(2000, 75);
  const reconstructed = proteinG * 4 + fatG * 9 + carbG * 4;
  assert.ok(Math.abs(reconstructed - 2000) <= 5, `reconstructed ${reconstructed}, too far from 2000`);
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
