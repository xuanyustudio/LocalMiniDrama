'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  unwrapModelArkAssetView,
  normalizeModelArkAssetStatus,
  assetUrlForVideo,
  parseSettingsJson,
} = require('../src/services/modelArkAssetConfigService');

describe('modelArkAssetConfigService', () => {
  it('unwrapModelArkAssetView reads Result.Id', () => {
    const asset = unwrapModelArkAssetView({
      Result: { Id: 'asset-abc', Status: 'Available', Name: 'hero' },
    });
    assert.equal(asset.id, 'asset-abc');
    assert.equal(asset.status, 'active');
    assert.equal(asset.name, 'hero');
  });

  it('normalizeModelArkAssetStatus maps common values', () => {
    assert.equal(normalizeModelArkAssetStatus('Available'), 'active');
    assert.equal(normalizeModelArkAssetStatus('Processing'), 'processing');
    assert.equal(normalizeModelArkAssetStatus('Failed'), 'failed');
  });

  it('assetUrlForVideo builds asset:// from id', () => {
    assert.equal(assetUrlForVideo({ id: 'asset-xyz' }), 'asset://asset-xyz');
    assert.equal(assetUrlForVideo({ asset_url: 'asset://already' }), 'asset://already');
  });

  it('parseSettingsJson handles object or string', () => {
    assert.deepEqual(parseSettingsJson('{"auth_mode":"volc_sign"}'), { auth_mode: 'volc_sign' });
    assert.deepEqual(parseSettingsJson({ asset_group_id: 'g1' }), { asset_group_id: 'g1' });
  });
});
