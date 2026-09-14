const test = require('node:test');
const assert = require('node:assert/strict');

const modelArkAssetProxyService = require('../src/services/modelArkAssetProxyService');

test('ModelArk Volcengine signer still produces an Authorization header with patched dependencies', async () => {
  const originalFetch = global.fetch;
  let captured = null;
  global.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const result = await modelArkAssetProxyService.callModelArkAsset({
      base_url: 'https://ark.cn-beijing.volces.com/api/v3',
      action: 'ListAssetGroups',
      body: { PageNumber: 1, PageSize: 1, Filter: { GroupType: 'AIGC' } },
      path_mode: 'open_api_query',
      api_version: '2024-01-01',
      auth_mode: 'volc_sign',
      access_key_id: 'AKIDEXAMPLE',
      secret_access_key: 'SECRETEXAMPLE',
      sign_region: 'cn-beijing',
      sign_service: 'ark',
    });

    assert.deepEqual(result, { ok: true });
    assert.ok(captured);
    assert.match(captured.url, /Action=ListAssetGroups/);
    assert.match(String(captured.init.headers.Authorization || ''), /Credential=AKIDEXAMPLE/);
  } finally {
    global.fetch = originalFetch;
  }
});
