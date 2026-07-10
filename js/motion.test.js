// motion.test.js
// Run: node js/motion.test.js

import assert from 'node:assert/strict';
import { springStep, isSpringSettled } from './motion.js';

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

/** Runs many small steps to simulate a spring settling, like the real rAF loop would over real time. */
function simulate(target, steps = 600, dt = 1 / 60, opts = {}) {
  let value = 0;
  let velocity = 0;
  for (let i = 0; i < steps; i++) {
    ({ value, velocity } = springStep({ value, velocity, target, dt, ...opts }));
  }
  return { value, velocity };
}

test('a spring released toward a target eventually converges to it', () => {
  const { value, velocity } = simulate(100);
  assert.ok(Math.abs(value - 100) < 0.1, `expected to converge near 100, got ${value}`);
  assert.ok(Math.abs(velocity) < 0.1, `expected velocity to settle near 0, got ${velocity}`);
});

test('starting already at the target with no velocity stays put', () => {
  const { value, velocity } = springStep({ value: 50, velocity: 0, target: 50, dt: 1 / 60 });
  assert.equal(value, 50);
  assert.equal(velocity, 0);
});

test('a single step moves value toward target, not away from it', () => {
  const { value } = springStep({ value: 0, velocity: 0, target: 100, dt: 1 / 60 });
  assert.ok(value > 0 && value < 100, `expected partial progress toward 100, got ${value}`);
});

test('reasonable stiffness/damping does not diverge (blow up to infinity/NaN) over many steps', () => {
  const { value, velocity } = simulate(100, 1000);
  assert.ok(Number.isFinite(value), 'value diverged');
  assert.ok(Number.isFinite(velocity), 'velocity diverged');
});

test('higher damping settles without overshooting past the target', () => {
  // Heavily overdamped: should approach monotonically, never exceeding target.
  let value = 0;
  let velocity = 0;
  let maxValue = 0;
  for (let i = 0; i < 600; i++) {
    ({ value, velocity } = springStep({ value, velocity, target: 100, dt: 1 / 60, stiffness: 170, damping: 60 }));
    maxValue = Math.max(maxValue, value);
  }
  assert.ok(maxValue <= 100.5, `expected little/no overshoot with heavy damping, peaked at ${maxValue}`);
});

test('lower damping overshoots past the target before settling — this is the "spring feel" the design asked for', () => {
  let value = 0;
  let velocity = 0;
  let maxValue = 0;
  for (let i = 0; i < 600; i++) {
    ({ value, velocity } = springStep({ value, velocity, target: 100, dt: 1 / 60, stiffness: 170, damping: 12 }));
    maxValue = Math.max(maxValue, value);
  }
  assert.ok(maxValue > 100, `expected visible overshoot with light damping, peaked at ${maxValue}`);
});

test('the actual default parameters (no overrides) produce visible overshoot, not just a smooth ease — this regressed silently once already', () => {
  let value = 0;
  let velocity = 0;
  let maxValue = 0;
  for (let i = 0; i < 600; i++) {
    ({ value, velocity } = springStep({ value, velocity, target: 100, dt: 1 / 60 })); // no stiffness/damping override
    maxValue = Math.max(maxValue, value);
  }
  assert.ok(maxValue > 100.5, `expected visible overshoot from the real default params, peaked at ${maxValue}`);
});

// --- isSpringSettled ---

test('exactly at target with zero velocity counts as settled', () => {
  assert.equal(isSpringSettled(100, 0, 100), true);
});

test('far from target does not count as settled even with zero velocity', () => {
  assert.equal(isSpringSettled(0, 0, 100), false);
});

test('close to target but still moving fast does not count as settled', () => {
  assert.equal(isSpringSettled(99.9, 50, 100), false);
});

test('custom thresholds are respected', () => {
  assert.equal(isSpringSettled(95, 0, 100, { valueThreshold: 10 }), true);
  assert.equal(isSpringSettled(95, 0, 100, { valueThreshold: 1 }), false);
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
