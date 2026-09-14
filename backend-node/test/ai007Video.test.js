const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pickProxyVideoUrl, callAi007VideoApi } = require('../src/services/videoClient');

describe('AI007 video response parsing', () => {
  it('reads a deeply nested completed video URL', () => {
    assert.equal(
      pickProxyVideoUrl({ data: { status: 'SUCCESS', data: { url: 'https://cdn.example.com/final.mp4' } } }),
      'https://cdn.example.com/final.mp4'
    );
  });

  it('submits the AI007 prompt/seconds/image contract', async () => {
    const originalFetch = global.fetch;
    let captured;
    global.fetch = async (url, init) => {
      captured = { url, init };
      return { ok: true, text: async () => JSON.stringify({ task_id: 'task-7' }) };
    };
    try {
      const result = await callAi007VideoApi(
        { base_url: 'https://image.ai007.my/', api_key: 'test-only', endpoint: '/v1/video/generations' },
        { info() {} },
        { model: 'H3', prompt: 'camera pans left', duration: 8, first_frame_url: 'https://cdn.example.com/frame.png' }
      );
      assert.deepEqual(result, { task_id: 'task-7', status: 'processing' });
      assert.equal(captured.url, 'https://image.ai007.my/v1/video/generations');
      assert.deepEqual(JSON.parse(captured.init.body), {
        model: 'H3', prompt: 'camera pans left', seconds: '10', image: 'https://cdn.example.com/frame.png'
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('uses image_urls for Dola multi-reference and keeps the first frame first', async () => {
    const originalFetch = global.fetch;
    let captured;
    global.fetch = async (_url, init) => {
      captured = JSON.parse(init.body);
      return { ok: true, text: async () => JSON.stringify({ task_id: 'task-8' }) };
    };
    try {
      await callAi007VideoApi(
        { base_url: 'https://image.ai007.my', api_key: 'test-only' },
        { info() {} },
        {
          model: 'Dola', prompt: 'one focused action', duration: 6, aspect_ratio: '9:16',
          first_frame_url: 'https://cdn.example.com/start.png',
          reference_urls: ['https://cdn.example.com/character.png', 'https://cdn.example.com/start.png', 'ftp://ignored.example.com/nope.png'],
        }
      );
      assert.deepEqual(captured, {
        model: 'Dola', prompt: 'one focused action', seconds: '10', aspect_ratio: '9:16',
        image_urls: ['https://cdn.example.com/start.png', 'https://cdn.example.com/character.png'],
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('uses singular image for H3 so upstream routes it as image-to-video', async () => {
    const originalFetch = global.fetch;
    let captured;
    global.fetch = async (_url, init) => {
      captured = JSON.parse(init.body);
      return { ok: true, text: async () => JSON.stringify({ task_id: 'task-h3' }) };
    };
    try {
      await callAi007VideoApi(
        { base_url: 'https://image.ai007.my', api_key: 'test-only' },
        { info() {} },
        {
          model: 'H3', prompt: 'continue the exact frame', duration: 6,
          first_frame_url: 'https://cdn.example.com/tail.png',
          reference_urls: ['https://cdn.example.com/character.png'],
        }
      );
      assert.equal(captured.image, 'https://cdn.example.com/tail.png');
      assert.equal(captured.image_urls, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
