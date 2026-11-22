const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const videoClient = require('../src/services/videoClient');

describe('cheap_seedance2 helpers', () => {
  it('isCheapSeedance2Provider', () => {
    assert.equal(videoClient.isCheapSeedance2Provider('cheap_seedance2'), true);
    assert.equal(videoClient.isCheapSeedance2Provider('Cheap_Seedance2'), true);
    assert.equal(videoClient.isCheapSeedance2Provider('openai'), false);
  });

  it('normalizeCheapSeedance2Duration for wb-seedance-2-fast (4-10s)', () => {
    const m = 'wb-seedance-2-fast';
    assert.equal(videoClient.normalizeCheapSeedance2Duration(undefined, m), '10');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(null, m), '10');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(3, m), '4');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(5, m), '5');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(8, m), '8');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(10, m), '10');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(12, m), '10');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(20, m), '10');
  });

  it('normalizeCheapSeedance2Duration for 4-15s and 4-30s models', () => {
    for (const m of ['mb-minimax-h3-f-fast-480p', 'doubao-seedance-2-0-mini-480p']) {
      assert.equal(videoClient.normalizeCheapSeedance2Duration(undefined, m), '5');
      assert.equal(videoClient.normalizeCheapSeedance2Duration(3, m), '4');
      assert.equal(videoClient.normalizeCheapSeedance2Duration(8, m), '8');
      assert.equal(videoClient.normalizeCheapSeedance2Duration(15, m), '15');
      assert.equal(videoClient.normalizeCheapSeedance2Duration(20, m), '15');
    }
    assert.equal(videoClient.normalizeCheapSeedance2Duration(undefined, 'seedance2.5-full-480p'), '4');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(30, 'seedance2.5-full-480p'), '30');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(40, 'seedance2.5-full-480p'), '30');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(undefined, 'mb-seedance2.5-480p'), '5');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(30, 'mb-seedance2.5-480p'), '30');
    assert.equal(videoClient.normalizeCheapSeedance2Duration(3, 'wb-seedance-2.5'), '4');
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
    assert.equal(videoClient.normalizeCheapSeedance2Size('16:9', 'mb-minimax-h3-f-fast-480p'), '854x480');
    assert.equal(videoClient.normalizeCheapSeedance2Size('9:16', 'mb-minimax-h3-f-fast-480p'), '480x854');
    assert.equal(videoClient.normalizeCheapSeedance2Size('1:1', 'mb-minimax-h3-f-fast-480p'), '854x480');
    assert.equal(videoClient.normalizeCheapSeedance2Size('16:9', 'doubao-seedance-2-0-mini-480p'), '854x480');
    assert.equal(videoClient.normalizeCheapSeedance2Size('1:1', 'seedance2.5-full-480p'), '480x480');
    assert.equal(videoClient.normalizeCheapSeedance2Size('21:9', 'mb-seedance2.5-480p'), '1120x480');
    assert.equal(videoClient.normalizeCheapSeedance2Size('9:16', 'minimax-h3-1080p-15s'), '480x854');
  });

  it('cheapSeedance2MaxImages', () => {
    assert.equal(videoClient.cheapSeedance2MaxImages('mb-minimax-h3-f-fast-480p'), 9);
    assert.equal(videoClient.cheapSeedance2MaxImages('doubao-seedance-2-0-mini-480p'), 9);
    assert.equal(videoClient.cheapSeedance2MaxImages('wb-seedance-2-fast'), 9);
    assert.equal(videoClient.cheapSeedance2MaxImages('seedance2.5-full-480p'), 30);
    assert.equal(videoClient.cheapSeedance2MaxImages('mb-seedance2.5-480p'), 30);
  });

  it('retired workbench models remap, and ohmybb never uses official MiniMax H3', () => {
    assert.equal(videoClient.remapRetiredCheapSeedance2Model('wb-seedance-2.5'), 'wb-seedance-2-fast');
    assert.equal(videoClient.remapRetiredCheapSeedance2Model('minimax-h3-1080p-15s'), 'mb-minimax-h3-f-fast-480p');
    assert.equal(videoClient.remapRetiredCheapSeedance2Model('wb-seedance-2-fast'), 'wb-seedance-2-fast');
    assert.equal(videoClient.isMinimaxH3Model('MiniMax-H3'), true);
    assert.equal(videoClient.isMinimaxH3Model('mb-minimax-h3-f-fast-480p'), false);
    assert.equal(videoClient.isMinimaxH3Model('minimax-h3-480p'), false);
    const workbench = {
      provider: 'cheap_seedance2',
      api_protocol: 'minimax_h3',
      base_url: 'https://workbench.ohmybb.xyz/api/openai',
      default_model: 'mb-minimax-h3-f-fast-480p',
    };
    assert.equal(videoClient.resolveVideoProtocol(workbench, 'wb-seedance-2.5'), 'sora');
    assert.equal(videoClient.resolveVideoProtocol(workbench, 'mb-minimax-h3-f-fast-480p'), 'sora');
    assert.equal(videoClient.resolveVideoProtocol({
      provider: 'minimax_h3',
      base_url: 'https://api.minimaxi.com',
      default_model: 'MiniMax-H3',
    }, 'MiniMax-H3'), 'minimax_h3');
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

  it('needsAuthenticatedVideoDownload for content urls and provider', () => {
    assert.equal(videoClient.needsAuthenticatedVideoDownload({ provider: 'cheap_seedance2' }, 'chatfire', ''), true);
    assert.equal(videoClient.needsAuthenticatedVideoDownload({
      provider: 'openai',
      base_url: 'https://workbench.ohmybb.xyz/api/openai',
    }, 'chatfire', ''), true);
    assert.equal(videoClient.needsAuthenticatedVideoDownload(
      { provider: 'openai' },
      'chatfire',
      'https://workbench.ohmybb.xyz/api/openai/v1/videos/abc/content'
    ), true);
    assert.equal(videoClient.needsAuthenticatedVideoDownload(
      { provider: 'openai', base_url: 'https://api.openai.com' },
      'openai',
      'https://cdn.example.com/a.mp4'
    ), false);
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
