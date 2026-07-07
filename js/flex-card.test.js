// flex-card.test.js
// Run: node js/flex-card.test.js

import assert from 'node:assert/strict';
import { getMostRecentCompletedWeekStart, computeFlexCardStats, computeStreak } from './flex-card.js';

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

function d(dateStr) {
  return new Date(`${dateStr}T12:00:00`); // noon, to sidestep any timezone-edge midnight ambiguity
}
function fmt(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// --- getMostRecentCompletedWeekStart ---
// July 2026: Mon 6th, Sun 12th, Mon 13th.

test('on a Monday, the completed week is the one that just ended (last Monday), not this week', () => {
  assert.equal(fmt(getMostRecentCompletedWeekStart(d('2026-07-06'))), '2026-06-29');
});

test('mid-week, the completed week is still last week — this week is not done yet', () => {
  assert.equal(fmt(getMostRecentCompletedWeekStart(d('2026-07-08'))), '2026-06-29');
});

test("on this week's own Sunday, it still isn't completed until Monday arrives", () => {
  assert.equal(fmt(getMostRecentCompletedWeekStart(d('2026-07-12'))), '2026-06-29');
});

test('the following Monday rolls the completed week forward by exactly 7 days', () => {
  assert.equal(fmt(getMostRecentCompletedWeekStart(d('2026-07-13'))), '2026-07-06');
});

// --- computeFlexCardStats ---

test('consistency score and average calories are computed only from days that were actually logged', () => {
  const foodLogRange = {
    '2026-06-29': { a: { calories: 2000 } },
    '2026-06-30': { a: { calories: 1800 } },
    // rest of the week has no entries
  };
  const stats = computeFlexCardStats({ weekStart: d('2026-06-29'), foodLogRange, target: 2000 });
  assert.equal(stats.daysLogged, 2);
  assert.equal(stats.consistencyScore, 2 / 7);
  assert.equal(stats.avgCalories, 1900);
  assert.equal(stats.weekDates.length, 7);
  assert.equal(stats.weekDates[0], '2026-06-29');
  assert.equal(stats.weekDates[6], '2026-07-05');
});

test('adherence is a percentage of target, rounded', () => {
  const foodLogRange = { '2026-06-29': { a: { calories: 1900 } } };
  const stats = computeFlexCardStats({ weekStart: d('2026-06-29'), foodLogRange, target: 2000 });
  assert.equal(stats.adherencePct, 95);
});

test('a week with no logged days at all does not divide by zero', () => {
  const stats = computeFlexCardStats({ weekStart: d('2026-06-29'), foodLogRange: {}, target: 2000 });
  assert.equal(stats.daysLogged, 0);
  assert.equal(stats.avgCalories, 0);
  assert.equal(stats.adherencePct, 0);
});

// --- computeStreak ---

test('an unbroken run of days counts the full streak', () => {
  const foodLogRange = {
    '2026-07-04': { a: { calories: 2000 } },
    '2026-07-05': { a: { calories: 2000 } },
    '2026-07-06': { a: { calories: 2000 } },
  };
  assert.equal(computeStreak(foodLogRange, '2026-07-06'), 3);
});

test('a gap breaks the streak at the gap, not before it', () => {
  const foodLogRange = {
    '2026-07-03': { a: { calories: 2000 } }, // logged, but before the gap
    '2026-07-05': { a: { calories: 2000 } },
    '2026-07-06': { a: { calories: 2000 } },
    // 07-04 missing — breaks the chain
  };
  assert.equal(computeStreak(foodLogRange, '2026-07-06'), 2);
});

test("today not being logged yet doesn't zero out an otherwise-intact streak", () => {
  const foodLogRange = {
    '2026-07-04': { a: { calories: 2000 } },
    '2026-07-05': { a: { calories: 2000 } },
    // today (07-06) has nothing yet — the day isn't over
  };
  assert.equal(computeStreak(foodLogRange, '2026-07-06'), 2);
});

test('no logged days at all gives a streak of 0, not an error', () => {
  assert.equal(computeStreak({}, '2026-07-06'), 0);
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
