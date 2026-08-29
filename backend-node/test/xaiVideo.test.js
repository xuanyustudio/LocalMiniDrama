const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  XAI_DEFAULT_MODEL,
  XAI_DEFAULT_DURATION,
  XAI_DEFAULT_RESOLUTION,
  XAI_DEFAULT_ASPECT_RATIO,
  XAI_R2V_MAX_REFERENCE_IMAGES,
  XAI_IMAGE_REF_MIX_ERROR,
  resolveXaiVideoResolution,
  clampXaiDuration,
  normalizeXaiGenerateAudio,
  isXaiGrokVideoStyleModel,
  isXaiImagineModel,
  resolveXaiGenerationMode,
  buildXaiImagineVideoBody,
  extractXaiRequestId,
  extractXaiVideoUrl,
  parseXaiPollResult,
  callXaiVideoApi,
  pollVideoTask,
} = require('../src/services/videoClient');

const silentLog = { info() {}, warn() {}, error() {} };

const xaiConfig = {
  provider: 'xai',
  api_protocol: 'xai',
  base_url: 'https://api.x.ai',
  api_key: 'sk-test-not-real',
  endpoint: '/v1/videos/generations',
};

function jsonResponse(obj, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(obj),
    json: async () => obj,
    arrayBuffer: async () => new ArrayBuffer(0),
    headers: { get: () => '' },
  };
}

function installFetchMock({ onPost, polls } = {}) {
  const orig = global.fetch;
  const posts = [];
  let lastAuth = '';
  let pollIdx = 0;
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    const method = String(init.method || 'GET').toUpperCase();
    if (method === 'POST' && u.includes('/v1/videos/generations')) {
      const body = JSON.parse(init.body);
      posts.push(body);
      lastAuth = init.headers && init.headers.Authorization;
      if (onPost) onPost(body, init, u);
      return jsonResponse({ request_id: 'req-mock-1' });
    }
    if (method === 'GET' && /\/v1\/videos\/[^/?]+$/.test(u.split('?')[0])) {
      const list = polls || [];
      const data = list[Math.min(pollIdx, Math.max(0, list.length - 1))] || { status: 'pending' };
      pollIdx += 1;
      return jsonResponse(data);
    }
    return {
      ok: false,
      status: 404,
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => '' },
    };
  };
  return {
    posts,
    get lastAuth() {
      return lastAuth;
    },
    restore() {
      global.fetch = orig;
    },
  };
}

describe('xAI Imagine Video 1.5 helpers', () => {
  it('defaults to grok-imagine-video-1.5 and 720p / 9:16 / 6s / generate_audio false', () => {
    assert.equal(XAI_DEFAULT_MODEL, 'grok-imagine-video-1.5');
    const built = buildXaiImagineVideoBody({ prompt: 'a cat walks' });
    assert.equal(built.error, undefined);
    assert.equal(built.mode, 't2v');
    assert.equal(built.body.model, 'grok-imagine-video-1.5');
    assert.equal(built.body.duration, XAI_DEFAULT_DURATION);
    assert.equal(built.body.duration, 6);
    assert.equal(built.body.resolution, XAI_DEFAULT_RESOLUTION);
    assert.equal(built.body.aspect_ratio, XAI_DEFAULT_ASPECT_RATIO);
    assert.equal(built.body.generate_audio, false);
    assert.equal(built.body.image, undefined);
    assert.equal(built.body.reference_images, undefined);
    assert.equal(built.body.size, undefined);
    assert.equal(built.body.images, undefined);
  });

  it('does not treat grok-imagine-video-1.5 as grok-video-3 body', () => {
    assert.equal(isXaiGrokVideoStyleModel('grok-imagine-video-1.5'), false);
    assert.equal(isXaiGrokVideoStyleModel('grok-imagine-video'), false);
    assert.equal(isXaiImagineModel('grok-imagine-video-1.5'), true);
    assert.equal(isXaiGrokVideoStyleModel('grok-video-3'), true);
    assert.equal(isXaiGrokVideoStyleModel('grok_video_3'), true);
  });

  it('maps 480p / 720p / 1080p and caps R2V at 720p', () => {
    assert.equal(resolveXaiVideoResolution('480p'), '480p');
    assert.equal(resolveXaiVideoResolution('720p'), '720p');
    assert.equal(resolveXaiVideoResolution('1080p'), '1080p');
    assert.equal(resolveXaiVideoResolution(undefined), '720p');
    assert.equal(resolveXaiVideoResolution('1080p', 't2v'), '1080p');
    assert.equal(resolveXaiVideoResolution('1080p', 'i2v'), '1080p');
    assert.equal(resolveXaiVideoResolution('1080p', 'r2v'), '720p');
  });

  it('clamps duration to 1–15 seconds', () => {
    assert.equal(clampXaiDuration(1), 1);
    assert.equal(clampXaiDuration(15), 15);
    assert.equal(clampXaiDuration(6), 6);
    assert.equal(clampXaiDuration(99), 15);
    assert.equal(clampXaiDuration(0), 6);
    assert.equal(clampXaiDuration(undefined), 6);
  });

  it('generate_audio switch defaults false and can be enabled', () => {
    assert.equal(normalizeXaiGenerateAudio(undefined), false);
    assert.equal(normalizeXaiGenerateAudio(0), false);
    assert.equal(normalizeXaiGenerateAudio(true), true);
    assert.equal(normalizeXaiGenerateAudio(1), true);
    const on = buildXaiImagineVideoBody({ prompt: 'p', generate_audio: true });
    assert.equal(on.body.generate_audio, true);
  });

  it('T2V / I2V / R2V are mutually exclusive', () => {
    const t2v = resolveXaiGenerationMode({ prompt: 'p' });
    assert.equal(t2v.mode, 't2v');
    assert.equal(t2v.image, null);

    const i2v = resolveXaiGenerationMode({
      first_frame_url: 'https://cdn.example.com/first.jpg',
      reference_urls: ['https://cdn.example.com/first.jpg'],
    });
    assert.equal(i2v.mode, 'i2v');
    assert.equal(i2v.image, 'https://cdn.example.com/first.jpg');
    assert.equal(i2v.reference_images, null);

    const r2v = resolveXaiGenerationMode({
      reference_urls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    });
    assert.equal(r2v.mode, 'r2v');
    assert.equal(r2v.image, null);
    assert.equal(r2v.reference_images.length, 2);
  });

  it('rejects image + extra reference_images before any request', () => {
    const mixed = resolveXaiGenerationMode({
      image_url: 'https://cdn.example.com/first.jpg',
      reference_urls: ['https://cdn.example.com/char.jpg'],
    });
    assert.equal(mixed.error, XAI_IMAGE_REF_MIX_ERROR);

    const built = buildXaiImagineVideoBody({
      prompt: 'walk',
      image_url: 'https://cdn.example.com/first.jpg',
      reference_urls: ['https://cdn.example.com/char.jpg'],
    });
    assert.equal(built.error, XAI_IMAGE_REF_MIX_ERROR);
  });

  it('R2V keeps at most 7 reference images and 1080p becomes 720p in body', () => {
    const urls = Array.from({ length: 9 }, (_, i) => `https://cdn.example.com/r${i}.jpg`);
    const mode = resolveXaiGenerationMode({ reference_urls: urls });
    assert.equal(mode.mode, 'r2v');
    assert.equal(mode.reference_images.length, XAI_R2V_MAX_REFERENCE_IMAGES);
    const built = buildXaiImagineVideoBody({
      prompt: 'walk',
      reference_urls: urls.slice(0, 2),
      resolution: '1080p',
    });
    assert.equal(built.mode, 'r2v');
    assert.equal(built.body.resolution, '720p');
    assert.equal(built.body.image, undefined);
    assert.equal(built.body.reference_images.length, 2);
  });
});

describe('xAI poll parse', () => {
  it('reads request_id and video.url', () => {
    assert.equal(extractXaiRequestId({ request_id: 'abc-1' }), 'abc-1');
    assert.equal(
      extractXaiVideoUrl({
        status: 'done',
        video: { url: 'https://vidgen.x.ai/xai-video-abc.mp4', duration: 6, respect_moderation: true },
      }),
      'https://vidgen.x.ai/xai-video-abc.mp4'
    );
  });

  it('maps pending / done / failed / expired', () => {
    assert.equal(parseXaiPollResult({ status: 'pending' }).status, 'pending');
    const done = parseXaiPollResult({
      status: 'done',
      video: { url: 'https://vidgen.x.ai/out.mp4', duration: 6, respect_moderation: true },
    });
    assert.equal(done.status, 'done');
    assert.equal(done.video_url, 'https://vidgen.x.ai/out.mp4');

    const failed = parseXaiPollResult({
      status: 'failed',
      error: { code: 'invalid_argument', message: 'Prompt cannot be empty' },
    });
    assert.equal(failed.status, 'failed');
    assert.match(failed.error, /Prompt cannot be empty/);

    const expired = parseXaiPollResult({ status: 'expired' });
    assert.equal(expired.status, 'expired');
    assert.match(expired.error, /expired/);
  });

  it('treats respect_moderation false as failure', () => {
    const r = parseXaiPollResult({
      status: 'done',
      video: { url: '', duration: 6, respect_moderation: false },
    });
    assert.equal(r.status, 'failed');
    assert.match(r.error, /moderation/);
  });
});

describe('xAI callXaiVideoApi mock HTTP', () => {
  const prevKey = process.env.XAI_API_KEY;
  before(() => {
    process.env.XAI_API_KEY = 'sk-test-env-only';
  });
  after(() => {
    if (prevKey == null) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = prevKey;
  });

  it('refuses to POST when XAI_API_KEY is missing and ignores config.api_key', async () => {
    delete process.env.XAI_API_KEY;
    const mock = installFetchMock();
    try {
      const result = await callXaiVideoApi(
        { ...xaiConfig, api_key: 'sk-from-sqlite-must-not-be-used' },
        silentLog,
        { prompt: 'should not send' }
      );
      assert.equal(result.error, 'XAI_API_KEY is not set');
      assert.equal(mock.posts.length, 0);
    } finally {
      mock.restore();
      process.env.XAI_API_KEY = 'sk-test-env-only';
    }
  });

  it('T2V posts prompt only (no image / reference_images) and returns request_id', async () => {
    const mock = installFetchMock();
    try {
      const result = await callXaiVideoApi(xaiConfig, silentLog, {
        prompt: 'A lantern festival alley at night',
      });
      assert.equal(result.request_id, 'req-mock-1');
      assert.equal(result.task_id, 'req-mock-1');
      assert.equal(mock.posts.length, 1);
      const body = mock.posts[0];
      assert.equal(body.model, 'grok-imagine-video-1.5');
      assert.equal(body.prompt, 'A lantern festival alley at night');
      assert.equal(body.generate_audio, false);
      assert.equal(body.resolution, '720p');
      assert.equal(body.aspect_ratio, '9:16');
      assert.equal(body.duration, 6);
      assert.equal(body.image, undefined);
      assert.equal(body.reference_images, undefined);
      assert.equal(body.images, undefined);
      assert.equal(body.size, undefined);
      assert.equal(mock.lastAuth, 'Bearer sk-test-env-only');
    } finally {
      mock.restore();
    }
  });

  it('I2V posts image and never reference_images', async () => {
    const mock = installFetchMock();
    try {
      const result = await callXaiVideoApi(xaiConfig, silentLog, {
        prompt: 'slow push in',
        first_frame_url: 'https://cdn.example.com/first.jpg',
        image_url: 'https://cdn.example.com/first.jpg',
        reference_urls: ['https://cdn.example.com/first.jpg'],
        duration: 8,
        aspect_ratio: '9:16',
        resolution: '1080p',
      });
      assert.equal(result.task_id, 'req-mock-1');
      assert.equal(mock.posts.length, 1);
      const body = mock.posts[0];
      assert.deepEqual(body.image, { url: 'https://cdn.example.com/first.jpg' });
      assert.equal(body.reference_images, undefined);
      assert.equal(body.resolution, '1080p');
      assert.equal(body.duration, 8);
    } finally {
      mock.restore();
    }
  });

  it('R2V posts reference_images and never image', async () => {
    const mock = installFetchMock();
    try {
      const result = await callXaiVideoApi(xaiConfig, silentLog, {
        prompt: 'the person from <IMAGE_0> turns',
        reference_urls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
        resolution: '1080p',
      });
      assert.equal(result.task_id, 'req-mock-1');
      const body = mock.posts[0];
      assert.equal(body.image, undefined);
      assert.deepEqual(body.reference_images, [
        { url: 'https://cdn.example.com/a.jpg' },
        { url: 'https://cdn.example.com/b.jpg' },
      ]);
      assert.equal(body.resolution, '720p');
    } finally {
      mock.restore();
    }
  });

  it('does not POST when image and extra reference_images are mixed', async () => {
    const mock = installFetchMock();
    try {
      const result = await callXaiVideoApi(xaiConfig, silentLog, {
        prompt: 'walk',
        image_url: 'https://cdn.example.com/first.jpg',
        reference_urls: ['https://cdn.example.com/char.jpg'],
      });
      assert.equal(result.error, XAI_IMAGE_REF_MIX_ERROR);
      assert.equal(mock.posts.length, 0);
    } finally {
      mock.restore();
    }
  });
});

describe('xAI pollVideoTask mock HTTP', () => {
  const prevKey = process.env.XAI_API_KEY;
  before(() => {
    process.env.XAI_API_KEY = 'sk-test-env-only';
  });
  after(() => {
    if (prevKey == null) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = prevKey;
  });

  it('continues through pending then returns video.url on done', async () => {
    const mock = installFetchMock({
      polls: [
        { status: 'pending' },
        {
          status: 'done',
          video: {
            url: 'https://vidgen.x.ai/xai-video-req-mock-1.mp4',
            duration: 6,
            respect_moderation: true,
          },
          model: 'grok-imagine-video-1.5',
        },
      ],
    });
    try {
      const result = await pollVideoTask(null, silentLog, 1, 'req-mock-1', xaiConfig, 5, 1);
      assert.equal(result.video_url, 'https://vidgen.x.ai/xai-video-req-mock-1.mp4');
      assert.equal(result.error, undefined);
    } finally {
      mock.restore();
    }
  });

  it('stops on failed', async () => {
    const mock = installFetchMock({
      polls: [
        {
          status: 'failed',
          error: { code: 'internal_error', message: 'engine failed' },
        },
      ],
    });
    try {
      const result = await pollVideoTask(null, silentLog, 1, 'req-mock-1', xaiConfig, 3, 1);
      assert.match(result.error, /engine failed/);
      assert.equal(result.video_url, undefined);
    } finally {
      mock.restore();
    }
  });

  it('stops on expired', async () => {
    const mock = installFetchMock({
      polls: [{ status: 'expired' }],
    });
    try {
      const result = await pollVideoTask(null, silentLog, 1, 'req-mock-1', xaiConfig, 3, 1);
      assert.match(result.error, /expired/);
    } finally {
      mock.restore();
    }
  });
});
