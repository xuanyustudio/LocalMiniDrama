const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');

const context = new AsyncLocalStorage();
const approvals = new Map();
// An offer must be confirmed within this window. A confirmed receipt stays valid while
// it keeps being used: each consumed request extends it, so long batches (one shot at a
// time, minutes each) do not expire midway. The request count still bounds the receipt.
const lifetime = 30 * 60 * 1000;

function offerApproval(scopes, requests) {
  if (!scopes.size) return null;
  const now = Date.now();
  for (const [token, approval] of approvals) {
    if (approval.expires <= now) approvals.delete(token);
  }
  const token = randomUUID();
  approvals.set(token, { scopes, requests, expires: now + lifetime, confirmed: false });
  return token;
}

function confirmApproval(token) {
  const approval = approvals.get(token);
  if (!approval || approval.confirmed || approval.expires <= Date.now()) return null;
  approvals.delete(token);
  const receipt = randomUUID();
  approvals.set(receipt, { ...approval, confirmed: true, expires: Date.now() + lifetime });
  return receipt;
}

function approvalContext(req, _res, next) {
  const token = req.get('X-Production-Approval');
  const approval = approvals.get(token);
  if (!approval?.confirmed || approval.expires <= Date.now() || req.method !== 'POST') return next();
  if (--approval.requests === 0) approvals.delete(token);
  else approval.expires = Date.now() + lifetime;
  return context.run(approval.scopes, next);
}

function requireApproval(scope) {
  if (!context.getStore()?.has(scope)) {
    const error = new Error('这次云端生成尚未确认费用。请回到工作台查看报价并确认。');
    error.code = 'PRODUCTION_APPROVAL_REQUIRED';
    throw error;
  }
}

module.exports = { offerApproval, confirmApproval, approvalContext, requireApproval };
