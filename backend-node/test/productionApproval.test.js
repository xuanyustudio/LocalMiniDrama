const { test } = require('node:test');
const assert = require('node:assert/strict');
const { offerApproval, confirmApproval, approvalContext, requireApproval } = require('../src/services/productionApproval');

function run(token, method = 'POST') {
  const req = { method, get: () => token };
  let allowed = false;
  approvalContext(req, null, () => {
    try { requireApproval('video'); allowed = true; } catch { allowed = false; }
  });
  return allowed;
}

test('a confirmed receipt stays valid across a long batch and is bounded by its request count', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  const receipt = confirmApproval(offerApproval(new Set(['video']), 3));
  assert.ok(receipt);
  // Each shot takes 20 minutes: 60 minutes in total, well past the 30-minute window.
  assert.equal(run(receipt), true);
  t.mock.timers.tick(20 * 60 * 1000);
  assert.equal(run(receipt, 'PUT'), false, 'non-POST requests neither use nor extend the receipt');
  assert.equal(run(receipt), true);
  t.mock.timers.tick(20 * 60 * 1000);
  assert.equal(run(receipt), true);
  assert.equal(run(receipt), false, 'the request count is exhausted');
});

test('an idle receipt still expires', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  const receipt = confirmApproval(offerApproval(new Set(['video']), 2));
  t.mock.timers.tick(31 * 60 * 1000);
  assert.equal(run(receipt), false);
});
