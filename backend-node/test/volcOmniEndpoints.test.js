const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildVideoUrl, buildQueryUrl } = require('../src/services/videoClient');

describe('Volcengine Omni endpoint routing', () => {
  const customConfig = {
    provider: 'custom-seedance-relay',
    api_protocol: 'volcengine_omni',
    base_url: 'https://relay.example.com/seedance/api/v3',
  };

  it('uses the Volcengine task endpoints for a custom provider', () => {
    assert.equal(
      buildVideoUrl(customConfig, { defaultEndpoint: '/v1/videos/generations' }),
      'https://relay.example.com/seedance/api/v3/contents/generations/tasks'
    );
    assert.equal(
      buildQueryUrl(customConfig, 'task/42'),
      'https://relay.example.com/seedance/api/v3/contents/generations/tasks/task%2F42'
    );
  });

  it('keeps explicit custom endpoint overrides', () => {
    const config = {
      ...customConfig,
      endpoint: '/custom/create',
      query_endpoint: '/custom/query/{taskId}',
    };
    assert.equal(buildVideoUrl(config), 'https://relay.example.com/seedance/api/v3/custom/create');
    assert.equal(
      buildQueryUrl(config, 'task/42'),
      'https://relay.example.com/seedance/api/v3/custom/query/task%2F42'
    );
  });

  it('does not change OpenAI-compatible custom providers', () => {
    const config = {
      provider: 'custom-relay',
      api_protocol: 'openai',
      base_url: 'https://relay.example.com',
    };
    assert.equal(
      buildVideoUrl(config, { defaultEndpoint: '/v1/videos/generations' }),
      'https://relay.example.com/v1/videos/generations'
    );
    assert.equal(buildQueryUrl(config, 'task-42'), 'https://relay.example.com/video/task/task-42');
  });
});
