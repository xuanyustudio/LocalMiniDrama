const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mapAgnesImageSizeSpec, isAgnesImageConfig } = require('../src/services/imageClient');

describe('mapAgnesImageSizeSpec', () => {
  it('maps 9:16 project size to 2K portrait', () => {
    assert.deepEqual(mapAgnesImageSizeSpec('1440x2560'), { size: '2K', ratio: '9:16' });
  });

  it('maps 16:9 project size to 2K landscape', () => {
    assert.deepEqual(mapAgnesImageSizeSpec('2560x1440'), { size: '2K', ratio: '16:9' });
  });

  it('maps 1:1 project size to 2K square', () => {
    assert.deepEqual(mapAgnesImageSizeSpec('1920x1920'), { size: '2K', ratio: '1:1' });
  });

  it('keeps explicit size tiers', () => {
    assert.deepEqual(mapAgnesImageSizeSpec('1K'), { size: '1K', ratio: '1:1' });
    assert.deepEqual(mapAgnesImageSizeSpec('3k'), { size: '3K', ratio: '1:1' });
  });

  it('maps smaller squares to 1K', () => {
    assert.deepEqual(mapAgnesImageSizeSpec('1024x1024'), { size: '1K', ratio: '1:1' });
  });
});

describe('isAgnesImageConfig', () => {
  it('detects agnes provider even when api_protocol is openai', () => {
    assert.equal(
      isAgnesImageConfig({ provider: 'agnes', base_url: 'https://apihub.agnes-ai.com/v1', api_protocol: 'openai' }, 'agnes-image-2.5-flash'),
      true
    );
  });
});
