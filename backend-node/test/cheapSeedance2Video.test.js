const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const videoClient = require('../src/services/videoClient');

describe('cheap_seedance2 helpers', () => {
  it('isCheapSeedance2Provider', () => {
    assert.equal(videoClient.isCheapSeedance2Provider('cheap_seedance2'), true);
    assert.equal(videoClient.isCheapSeedance2Provider('Cheap_Seedance2'), true);
    assert.equal(videoClient.isCheapSeedance2Provider('openai'), false);
  });

  it('normalizeCheapSeedance2Duration for wb-seedance-2-fast', () => {
    const m = 'wb-seedance-2-fast';
    assert.equal(videoClient.normalizeCheapSeedance2Duration(undefined, m), '10');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(null, m), '10');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(3, m), '5');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(5, m), '5');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(8, m), '10');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(10, m), '10');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(12, m), '10');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(20, m), '10');
  });

  it('normalizeCheapSeedance2Duration for yk and minimax-h3-1080p-15s (4-15s)', () => {
    for (const m of ['yk-seedance-mini', 'yk-seedance2.0-fast', 'yk-seedance2.0', 'minimax-h3-1080p-15s']) {
      assert.equal(videoClient.normalizeCheapSeedance2Duration(undefined, m), '5');
      assert.equal(videoClient.normalizeCheapSeedance2Duration(3, m), '4');
      assert.equal(videoClient.normalizeCheapSeedance2Duration(8, m), '8');
      assert.equal(videoClient.normalizeCheapSeedance2Duration(15, m), '15');
      assert.equal(videoClient.normalizeCheapSeedance2Duration(20, m), '15');
    }
  });

  it('normalizeCheapSeedance2Size', () => {
    assert.equal(videoClient.normalizeCheapSeedance2Size('16:9'), '1280x720');
    assert.equal(videoClient.normalizeCheapSeedance2Size('9:16'), '720x1280');
    assert.equal(videoClient.normalizeCheapSeedance2Size('1:1'), '1024x1024');
    assert.equal(videoClient.normalizeCheapSeedance2Size('1:1', 'yk-seedance2.0'), '720x720');
    assert.equal(videoClient.normalizeCheapSeedance2Size('4:3'), '960x720');
    assert.equal(videoClient.normalizeCheapSeedance2Size('3:4'), '720x960');
    assert.equal(videoClient.normalizeCheapSeedance2Size('21:9'), '1680x720');
    assert.equal(videoClient.normalizeCheapSeedance2Size(''), '1280x720');
    assert.equal(videoClient.normalizeCheapSeedance2Size('16:9', 'minimax-h3-1080p-15s'), '1920x1080');
    assert.equal(videoClient.normalizeCheapSeedance2Size('9:16', 'minimax-h3-1080p-15s'), '1080x1920');
    assert.equal(videoClient.normalizeCheapSeedance2Size('1:1', 'minimax-h3-1080p-15s'), '1920x1080');
  });

  it('cheapSeedance2MaxImages', () => {
    assert.equal(videoClient.cheapSeedance2MaxImages('minimax-h3-1080p-15s'), 1);
    assert.equal(videoClient.cheapSeedance2MaxImages('yk-seedance-mini'), 9);
    assert.equal(videoClient.cheapSeedance2MaxImages('wb-seedance-2-fast'), 9);
  });

  it('buildCheapSeedance2ContentUrl', () => {
    const url = videoClient.buildCheapSeedance2ContentUrl(
      { base_url: 'https://workbench.ohmybb.xyz/api/openai' },
      'task_abc'
    );
    assert.equal(url, 'https://workbench.ohmybb.xyz/api/openai/v1/videos/task_abc/content');
    assert.equal(videoClient.buildCheapSeedance2ContentUrl({ base_url: '' }, 'x'), null);
    assert.equal(videoClient.buildCheapSeedance2ContentUrl({ base_url: 'https://x' }, ''), null);
  });

  it('configSupportsUniversalOmni', () => {
    assert.equal(videoClient.configSupportsUniversalOmni({ provider: 'cheap_seedance2' }), true);
    assert.equal(videoClient.configSupportsUniversalOmni({
      provider: 'openai',
      settings: JSON.stringify({ supports_universal_omni: true }),
    }), true);
    assert.equal(videoClient.configSupportsUniversalOmni({
      provider: 'openai',
      settings: '{}',
    }), false);
  });
});
