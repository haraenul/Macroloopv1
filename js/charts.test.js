// charts.test.js
// Run: node js/charts.test.js

import assert from 'node:assert/strict';
import { computeChartPoints } from './charts.js';

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

test('two points span the full plot area at the given padding', () => {
  const { plotted } = computeChartPoints(
    [{ x: 'd1', y: 0 }, { x: 'd2', y: 100 }],
    { width: 100, height: 100, padding: 10 }
  );
  assert.equal(plotted[0].px, 10);
  assert.equal(plotted[1].px, 90);
  assert.equal(plotted[0].py, 90); // y=0 (lowest) plots near the bottom
  assert.equal(plotted[1].py, 10); // y=100 (highest) plots near the top
});

test('a single point is centered horizontally, not divided by zero', () => {
  const { plotted } = computeChartPoints([{ x: 'd1', y: 50 }], { width: 100, height: 100, padding: 0 });
  assert.equal(plotted.length, 1);
  assert.equal(plotted[0].px, 50);
  assert.ok(Number.isFinite(plotted[0].py));
});

test('flat data (all equal y) does not divide by zero', () => {
  const { plotted } = computeChartPoints(
    [{ x: 'd1', y: 40 }, { x: 'd2', y: 40 }, { x: 'd3', y: 40 }],
    { width: 100, height: 100, padding: 0 }
  );
  plotted.forEach((p) => assert.ok(Number.isFinite(p.py)));
});

test('a reference value outside the data range shares the same scale as the points, not a separate one', () => {
  // Single point at y=50; reference (e.g. a calorie target) at 150 —
  // above the data. Both must be positioned using one consistent scale,
  // otherwise the target line and the plotted point silently disagree.
  const { plotted, referencePy } = computeChartPoints(
    [{ x: 'd1', y: 50 }],
    { width: 100, height: 100, padding: 0, referenceValue: 150 }
  );
  // range becomes 50-150 (100 units); point at the bottom (py=100),
  // reference at the very top (py=0) since it's the max of the range.
  assert.equal(plotted[0].py, 100);
  assert.equal(referencePy, 0);
});

test('no reference value means referencePy is null', () => {
  const { referencePy } = computeChartPoints([{ x: 'd1', y: 10 }], { width: 100, height: 100 });
  assert.equal(referencePy, null);
});

test('empty input returns an empty plotted array instead of throwing', () => {
  const { plotted } = computeChartPoints([], { width: 100, height: 100 });
  assert.deepEqual(plotted, []);
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
