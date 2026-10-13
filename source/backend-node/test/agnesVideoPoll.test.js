const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  pickProxyVideoUrl,
  extractAgnesVideoUrl,
  buildAgnesPollUrl,
  getAgnesApiRoot,
} = require('../src/services/videoClient');

describe('extractAgnesVideoUrl (align new-api)', () => {
  it('reads MP4 from remixed_from_video_id like new-api ExtractVideoURLFromJSON', () => {
    const data = {
      status: 'completed',
      progress: 100,
      remixed_from_video_id:
        'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/2026/06/15/video_7237611b.mp4',
      video_id: 'video_7237611b',
    };
    assert.equal(
      extractAgnesVideoUrl(data),
      'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/2026/06/15/video_7237611b.mp4'
    );
  });

  it('prefers video_url when present', () => {
    const data = {
      status: 'completed',
      video_url: 'https://cdn.example.com/a.mp4',
      remixed_from_video_id: 'https://cdn.example.com/b.mp4',
    };
    assert.equal(extractAgnesVideoUrl(data), 'https://cdn.example.com/a.mp4');
  });

  it('reads nested data.url', () => {
    assert.equal(
      extractAgnesVideoUrl({ status: 'completed', data: { url: 'https://cdn.example.com/nested.mp4' } }),
      'https://cdn.example.com/nested.mp4'
    );
  });

  it('reads metadata.url from current Agnes completed response', () => {
    const data = {
      id: 'task_Xo3H2kNa6Z2KbfpNqQgZaVzIrQg59BM6',
      video_id: 'task_Xo3H2kNa6Z2KbfpNqQgZaVzIrQg59BM6',
      status: 'completed',
      progress: 100,
      size: '1280x704',
      metadata: {
        size_mapping: { adjusted: true, width: 1280, height: 704 },
        url: 'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/task_Xo3H2kNa6Z2KbfpNqQgZaVzIrQg59BM6.mp4',
      },
    };
    assert.equal(
      extractAgnesVideoUrl(data),
      'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/task_Xo3H2kNa6Z2KbfpNqQgZaVzIrQg59BM6.mp4'
    );
  });
});

describe('pickProxyVideoUrl Agnes completed task', () => {
  it('reads MP4 from remixed_from_video_id when video_url is absent', () => {
    const data = {
      status: 'completed',
      progress: 100,
      remixed_from_video_id:
        'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/2026/06/15/video_7237611b.mp4',
      video_id: 'video_7237611b',
    };
    assert.equal(
      pickProxyVideoUrl(data),
      'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/2026/06/15/video_7237611b.mp4'
    );
  });

  it('reads metadata.url from relay Seedance completed response', () => {
    const mp4 =
      'https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/doubao-seedance-2-0/example.mp4?X-Tos-Algorithm=TOS4-HMAC-SHA256';
    const data = {
      id: 'task_KOcn1bDY7csXysnnw9WgDOSZEc6wzkGf',
      object: 'video',
      model: 'guanzhuan-seedance2.0',
      status: 'completed',
      progress: 100,
      metadata: { url: mp4 },
    };
    assert.equal(pickProxyVideoUrl(data), mp4);
  });
});

describe('buildAgnesPollUrl (align new-api FetchTask)', () => {
  it('builds GET {origin}/v1/videos/{task_id} and strips trailing /v1 from base', () => {
    const url = buildAgnesPollUrl(
      {
        base_url: 'https://apihub.agnes-ai.com/v1',
        provider: 'agnes',
        api_protocol: 'agnes',
        model: ['agnes-video-v2.0'],
        query_endpoint: '/videos/{taskId}',
      },
      'task_BApSMkXkE5AejHAHZZq099wLOOyc4RUd'
    );
    assert.equal(
      url,
      'https://apihub.agnes-ai.com/v1/videos/task_BApSMkXkE5AejHAHZZq099wLOOyc4RUd'
    );
  });

  it('also works when base already has no /v1', () => {
    const url = buildAgnesPollUrl(
      { base_url: 'https://apihub.agnes-ai.com', provider: 'agnes', api_protocol: 'agnes' },
      'task_abc'
    );
    assert.equal(url, 'https://apihub.agnes-ai.com/v1/videos/task_abc');
  });

  it('builds GET /agnesapi for Video 2.5 with video_id + model_name', () => {
    const url = buildAgnesPollUrl(
      {
        base_url: 'https://apihub.agnes-ai.com/v1',
        provider: 'agnes',
        api_protocol: 'agnes',
        model: ['agnes-video-2.5-flash'],
        default_model: 'agnes-video-2.5-flash',
        query_endpoint: '/agnesapi',
      },
      'video_abc123'
    );
    assert.equal(
      url,
      'https://apihub.agnes-ai.com/agnesapi?video_id=video_abc123&model_name=agnes-video-2.5-flash'
    );
  });

  it('uses explicit model over config default for 2.5 poll URL', () => {
    const url = buildAgnesPollUrl(
      {
        base_url: 'https://apihub.agnes-ai.com/v1',
        model: ['agnes-video-v2.0'],
        default_model: 'agnes-video-v2.0',
      },
      'video_xyz',
      'agnes-video-2.5'
    );
    assert.equal(
      url,
      'https://apihub.agnes-ai.com/agnesapi?video_id=video_xyz&model_name=agnes-video-2.5'
    );
  });

  it('getAgnesApiRoot matches new-api apiOrigin', () => {
    assert.equal(getAgnesApiRoot('https://apihub.agnes-ai.com'), 'https://apihub.agnes-ai.com');
    assert.equal(getAgnesApiRoot('https://apihub.agnes-ai.com/v1'), 'https://apihub.agnes-ai.com');
    assert.equal(getAgnesApiRoot('https://apihub.agnes-ai.com/v1/'), 'https://apihub.agnes-ai.com');
  });
});
