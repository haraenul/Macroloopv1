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
  computeEWMA,
  backCalculateTDEE,
  updateAdaptiveTDEE,
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

// --- Phase 3: computeEWMA ---

test('computeEWMA matches hand-calculated values for a 3-point series', () => {
  // seed=80; then 0.2*79+0.8*80=79.8; then 0.2*79.5+0.8*79.8=79.74
  const series = [{ x: 'd1', y: 80 }, { x: 'd2', y: 79 }, { x: 'd3', y: 79.5 }];
  const smoothed = computeEWMA(series, 0.2);
  assert.equal(smoothed[0].y, 80);
  assert.equal(smoothed[1].y, 79.8);
  assert.ok(Math.abs(smoothed[2].y - 79.74) < 1e-9);
});

test('computeEWMA on an empty series returns an empty series', () => {
  assert.deepEqual(computeEWMA([]), []);
});

test('computeEWMA on a single point returns it unchanged (nothing to smooth against yet)', () => {
  const smoothed = computeEWMA([{ x: 'd1', y: 72.4 }]);
  assert.equal(smoothed.length, 1);
  assert.equal(smoothed[0].y, 72.4);
});

// --- Phase 3: backCalculateTDEE ---

test("matches the brief's own worked example exactly: 2000 kcal/day, -0.7kg over 14 days -> 2385", () => {
  assert.equal(backCalculateTDEE(2000, -0.7, 14), 2385);
});

test('checks out in both directions, per the brief\u2019s own note: TDEE -> implied weight change -> back to the same TDEE', () => {
  const assumedTDEE = 2385;
  const avgIntake = 2000;
  const days = 14;
  // Forward: a 385 kcal/day deficit at that intake implies a 0.7kg loss.
  const impliedDeltaKg = -((avgIntake - assumedTDEE) * days) / 7700;
  assert.ok(Math.abs(impliedDeltaKg - 0.7) < 1e-9);
  // Backward: feeding that implied loss back in recovers the same TDEE.
  const recovered = backCalculateTDEE(avgIntake, -impliedDeltaKg, days);
  assert.ok(Math.abs(recovered - assumedTDEE) < 1e-9);
});

test('a weight-gain scenario produces a TDEE estimate below intake, not above', () => {
  // Eating a surplus and gaining weight means real TDEE is lower than intake.
  const tdee = backCalculateTDEE(2800, 0.5, 14); // +0.5kg gained
  assert.ok(tdee < 2800);
});

// --- Phase 3: updateAdaptiveTDEE (full pipeline) ---

function flatIntake(days, kcal) {
  return Array.from({ length: days }, (_, i) => ({ x: `d${i + 1}`, y: kcal }));
}

test('fewer than 14 days of data stays in learning mode, estimate untouched', () => {
  const result = updateAdaptiveTDEE({
    weightSeries: [{ x: 'd1', y: 80 }, { x: 'd10', y: 79 }],
    intakeSeries: flatIntake(10, 2000),
    currentEstimate: 2200,
    daysOfData: 10,
    sex: 'male',
  });
  assert.equal(result.mode, 'learning');
  assert.equal(result.estimate, 2200);
});

test('enough days but inconsistent logging stays in learning mode', () => {
  const intake = flatIntake(14, 2000);
  // Zero out more than 30% of days -> consistency drops below the 0.7 gate.
  for (let i = 0; i < 6; i++) intake[i].y = 0;
  const result = updateAdaptiveTDEE({
    weightSeries: [{ x: 'd1', y: 80 }, { x: 'd14', y: 79 }],
    intakeSeries: intake,
    currentEstimate: 2200,
    daysOfData: 20,
    sex: 'male',
  });
  assert.equal(result.mode, 'learning');
  assert.equal(result.estimate, 2200);
});

test('sufficient data switches to personalized mode with a blended estimate, matching the pipeline built from already-tested pieces', () => {
  const weightSeries = [{ x: 'd1', y: 80 }, { x: 'd14', y: 79 }];
  const intakeSeries = flatIntake(14, 2000);
  const currentEstimate = 2200;

  const result = updateAdaptiveTDEE({ weightSeries, intakeSeries, currentEstimate, daysOfData: 14, sex: 'male' });

  // Expected value derived by composing the same already-tested building
  // blocks by hand, not re-guessing the pipeline's own arithmetic.
  const trend = computeEWMA(weightSeries);
  const deltaWeightKg = trend[trend.length - 1].y - trend[0].y;
  const empirical = backCalculateTDEE(2000, deltaWeightKg, 14);
  const blended = 0.6 * empirical + 0.4 * currentEstimate;
  const expected = Math.round(Math.min(Math.max(blended, currentEstimate * 0.9), currentEstimate * 1.1));

  assert.equal(result.mode, 'personalized');
  assert.equal(result.estimate, expected);
});

test('a large empirical swing is capped to within 10% of the prior estimate, not applied raw', () => {
  // Heavy loss at a high intake implies a much higher real TDEE than
  // 2200 — engineered to blow well past the +10% cap (2420).
  const result = updateAdaptiveTDEE({
    weightSeries: [{ x: 'd1', y: 90 }, { x: 'd14', y: 85 }],
    intakeSeries: flatIntake(14, 3000),
    currentEstimate: 2200,
    daysOfData: 14,
    sex: 'male',
  });
  assert.equal(result.mode, 'personalized');
  assert.equal(result.estimate, Math.round(2200 * 1.1));
});

test('the personalized estimate never drops below the sex-specific safety floor', () => {
  // Very low prior estimate near the female floor, plus data implying an
  // even lower TDEE — the floor must win over both the blend and the cap.
  const result = updateAdaptiveTDEE({
    weightSeries: [{ x: 'd1', y: 55 }, { x: 'd14', y: 56 }], // gained while "cutting" hard
    intakeSeries: flatIntake(14, 1100),
    currentEstimate: 1250,
    daysOfData: 14,
    sex: 'female',
  });
  assert.equal(result.mode, 'personalized');
  assert.equal(result.estimate, SAFETY_FLOOR_KCAL.female);
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
