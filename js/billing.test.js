// billing.test.js
// Run: node js/billing.test.js

import assert from 'node:assert/strict';
import { parseCheckoutReturnStatus } from './billing.js';

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

test('reads a successful checkout return from a query string', () => {
  assert.equal(parseCheckoutReturnStatus('?checkout=success'), 'success');
});

test('reads a cancelled checkout return from a query string', () => {
  assert.equal(parseCheckoutReturnStatus('?checkout=cancelled'), 'cancelled');
});

test('works without the leading question mark too', () => {
  assert.equal(parseCheckoutReturnStatus('checkout=success'), 'success');
});

test('a checkout param with an unrecognized value is treated as absent, not passed through', () => {
  assert.equal(parseCheckoutReturnStatus('?checkout=whatever'), null);
});

test('no checkout param at all returns null', () => {
  assert.equal(parseCheckoutReturnStatus('?foo=bar'), null);
});

test('an empty search string returns null', () => {
  assert.equal(parseCheckoutReturnStatus(''), null);
});

test('other params alongside checkout do not interfere', () => {
  assert.equal(parseCheckoutReturnStatus('?utm_source=x&checkout=success&ref=y'), 'success');
});

console.log(`\n${passed} passed`);
if (process.exitCode) {
  console.log('some tests FAILED — see above');
}
