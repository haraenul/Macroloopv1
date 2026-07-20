// settings.test.js
// Run: node js/settings.test.js

import assert from 'node:assert/strict';
import { buildDataExport, shouldShowGapFixerNudge } from './settings.js';

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

test('assembles all sections when everything is provided', () => {
  const result = buildDataExport({
    profile: { sex: 'female' },
    weightLog: { '2026-07-01': { weight_kg: 65 } },
    foodLog: { '2026-07-01': { e1: { calories: 500 } } },
    exerciseLog: { '2026-07-01': { e1: { calories_burned: 200 } } },
    algorithmState: { mode: 'learning' },
  });
  assert.equal(result.profile.sex, 'female');
  assert.equal(result.weight_log['2026-07-01'].weight_kg, 65);
  assert.equal(result.food_log['2026-07-01'].e1.calories, 500);
  assert.equal(result.exercise_log['2026-07-01'].e1.calories_burned, 200);
  assert.equal(result.algorithm_state.mode, 'learning');
  assert.equal(result.format_version, 1);
  assert.ok(result.exported_at);
});

test('missing sections default to empty/null instead of throwing or leaving them undefined', () => {
  const result = buildDataExport({});
  assert.equal(result.profile, null);
  assert.deepEqual(result.weight_log, {});
  assert.deepEqual(result.food_log, {});
  assert.deepEqual(result.exercise_log, {});
  assert.equal(result.algorithm_state, null);
});

test('the export is valid, round-trippable JSON', () => {
  const result = buildDataExport({ profile: { sex: 'male' }, foodLog: { '2026-07-01': {} } });
  const roundTripped = JSON.parse(JSON.stringify(result));
  assert.deepEqual(roundTripped, result);
});

test('no reminder time set means never show the nudge', () => {
  assert.equal(
    shouldShowGapFixerNudge({ reminderTime: null, nowHHMM: '20:00', todayDateStr: '2026-07-14', dismissedDate: null }),
    false
  );
});

test('before the reminder time, do not show it yet', () => {
  assert.equal(
    shouldShowGapFixerNudge({ reminderTime: '18:00', nowHHMM: '14:30', todayDateStr: '2026-07-14', dismissedDate: null }),
    false
  );
});

test('at or after the reminder time, with nothing dismissed today, show it', () => {
  assert.equal(
    shouldShowGapFixerNudge({ reminderTime: '18:00', nowHHMM: '18:00', todayDateStr: '2026-07-14', dismissedDate: null }),
    true
  );
  assert.equal(
    shouldShowGapFixerNudge({ reminderTime: '18:00', nowHHMM: '21:45', todayDateStr: '2026-07-14', dismissedDate: null }),
    true
  );
});

test('already dismissed today means do not show it again', () => {
  assert.equal(
    shouldShowGapFixerNudge({
      reminderTime: '18:00', nowHHMM: '21:00', todayDateStr: '2026-07-14', dismissedDate: '2026-07-14',
    }),
    false
  );
});

test('dismissed on a previous day does not suppress a fresh day\u2019s nudge', () => {
  assert.equal(
    shouldShowGapFixerNudge({
      reminderTime: '18:00', nowHHMM: '21:00', todayDateStr: '2026-07-14', dismissedDate: '2026-07-13',
    }),
    true
  );
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
