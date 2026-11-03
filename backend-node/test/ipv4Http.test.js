const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatNetError, ipv4Request } = require('../src/utils/ipv4Http');

describe('ipv4Http', () => {
  it('formatNetError keeps the socket error code', () => {
    const err = new Error('fetch failed');
    err.cause = { code: 'ECONNRESET' };
    assert.equal(formatNetError(err), 'fetch failed (ECONNRESET)');
    const already = new Error('connect ETIMEDOUT');
    already.code = 'ETIMEDOUT';
    assert.equal(formatNetError(already), 'connect ETIMEDOUT');
  });

  it('ipv4Request rejects a bad url without calling the network', async () => {
    await assert.rejects(() => ipv4Request('not a url'), /Invalid URL/);
  });
});
