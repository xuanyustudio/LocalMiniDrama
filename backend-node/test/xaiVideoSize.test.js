const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const videoClient = require('../src/services/videoClient');

describe('xAI video size', () => {
  it('maps official sizes to WxH instead of 480P', () => {
    assert.equal(videoClient.formatXaiOfficialSize('480P'), '848x480');
    assert.equal(videoClient.formatXaiOfficialSize('480p'), '848x480');
    assert.equal(videoClient.formatXaiOfficialSize('720P'), '1280x720');
    assert.equal(videoClient.formatXaiOfficialSize('1080p'), '1920x1080');
    assert.equal(videoClient.formatXaiOfficialSize(''), '1280x720');
  });

  it('keeps proxy grok-video size as 480P/720P', () => {
    assert.equal(videoClient.formatGrokVideo3Size('480p'), '480P');
    assert.equal(videoClient.formatGrokVideo3Size('720p'), '720P');
  });

  it('treats grok-imagine models as official pixel size', () => {
    assert.equal(videoClient.usesXaiOfficialPixelSize({
      base_url: 'https://api.x.ai',
    }, 'grok-imagine-video-1.5-lite'), true);
    assert.equal(videoClient.isXaiGrokVideoStyleModel('grok-imagine-video-1.5-lite'), false);
    assert.equal(videoClient.isXaiGrokVideoStyleModel('grok-video-3'), true);
  });
});
