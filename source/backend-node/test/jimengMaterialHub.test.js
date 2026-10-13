'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  hubBusinessErrorMessage,
  normalizeMaterialHubToken,
  tokenFingerprint,
  unwrapMaterialHubAssetView,
} = require('../src/services/jimengMaterialHubService');

describe('jimengMaterialHub response parsing', () => {
  it('hubBusinessErrorMessage detects model_ark 200+error body', () => {
    const msg = hubBusinessErrorMessage({
      error: '[Failed to download media from the provided URL.]',
    });
    assert.match(msg, /download media/i);
  });

  it('unwrapMaterialHubAssetView parses flat AssetView', () => {
    const asset = unwrapMaterialHubAssetView({
      id: 'asset-20260602203139-2vr49',
      asset_url: 'asset://asset-20260602203139-2vr49',
      status: 'processing',
    });
    assert.equal(asset.id, 'asset-20260602203139-2vr49');
    assert.equal(asset.status, 'processing');
  });

  it('unwrapMaterialHubAssetView parses data wrapper', () => {
    const asset = unwrapMaterialHubAssetView({
      data: { asset_id: 'AST-1', status: 'active', asset_url: 'asset://x' },
    });
    assert.equal(asset.id, 'AST-1');
  });

  it('unwrapMaterialHubAssetView returns null when only error field', () => {
    assert.equal(unwrapMaterialHubAssetView({ error: 'failed' }), null);
  });

  it('normalizeMaterialHubToken strips Bearer and zero-width chars', () => {
    const t = normalizeMaterialHubToken('Bearer sk-test\u200bkey\u200b');
    assert.equal(t, 'sk-testkey');
  });

  it('tokenFingerprint shows head and tail only', () => {
    assert.equal(tokenFingerprint('sk-abcdefghijklmnop'), 'sk-abcd…mnop');
  });
});
