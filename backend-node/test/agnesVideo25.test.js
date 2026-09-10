const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isAgnesVideo25,
  agnes25Seconds,
  buildAgnesVideo25ImagePayload,
  buildAgnesPollUrl,
} = require('../src/services/videoClient');

describe('isAgnesVideo25', () => {
  it('matches agnes-video-2.5 family models', () => {
    assert.equal(isAgnesVideo25('agnes-video-2.5-flash'), true);
    assert.equal(isAgnesVideo25('agnes-video-2.5'), true);
  });

  it('does not match v2.0 or other models', () => {
    assert.equal(isAgnesVideo25('agnes-video-v2.0'), false);
    assert.equal(isAgnesVideo25('kling-v2'), false);
    assert.equal(isAgnesVideo25(''), false);
    assert.equal(isAgnesVideo25(null), false);
  });
});

describe('agnes25Seconds', () => {
  it('formats duration as a string in the 4-12 range', () => {
    assert.equal(agnes25Seconds(5), '5');
    assert.equal(agnes25Seconds(8), '8');
  });

  it('clamps out-of-range values and falls back to default 5', () => {
    assert.equal(agnes25Seconds(2), '4');
    assert.equal(agnes25Seconds(30), '12');
    assert.equal(agnes25Seconds(null), '5');
    assert.equal(agnes25Seconds(undefined), '5');
    assert.equal(agnes25Seconds('abc'), '5');
  });
});

describe('buildAgnesVideo25ImagePayload', () => {
  it('uses top-level images array capped at 5 for reference mode', () => {
    const refs = ['https://cdn/1.jpg', 'https://cdn/2.jpg', 'https://cdn/3.jpg'];
    const out = buildAgnesVideo25ImagePayload({ resolvedRefs: refs });
    assert.deepEqual(out, { mode: 'reference', images: refs });
  });

  it('caps reference images at the Flash limit of 5', () => {
    const refs = ['https://cdn/1.jpg', 'https://cdn/2.jpg', 'https://cdn/3.jpg', 'https://cdn/4.jpg', 'https://cdn/5.jpg', 'https://cdn/6.jpg'];
    const out = buildAgnesVideo25ImagePayload({ resolvedRefs: refs });
    assert.equal(out.mode, 'reference');
    assert.equal(out.images.length, 5);
  });

  it('uses keyframe with first_frame only', () => {
    const out = buildAgnesVideo25ImagePayload({ resolvedRefs: [], firstResolved: 'https://cdn/first.jpg', lastResolved: null });
    assert.deepEqual(out, { mode: 'keyframe', first_frame: 'https://cdn/first.jpg' });
  });

  it('uses keyframe with both first and last frames', () => {
    const out = buildAgnesVideo25ImagePayload({ resolvedRefs: [], firstResolved: 'https://cdn/first.jpg', lastResolved: 'https://cdn/last.jpg' });
    assert.deepEqual(out, {
      mode: 'keyframe',
      first_frame: 'https://cdn/first.jpg',
      last_frame: 'https://cdn/last.jpg',
    });
  });

  it('falls back to text mode when no media is provided', () => {
    const out = buildAgnesVideo25ImagePayload({ resolvedRefs: [], firstResolved: null, lastResolved: null });
    assert.deepEqual(out, { mode: 'text' });
  });
});

describe('buildAgnesPollUrl with agnes-video-2.5-flash', () => {
  it('appends model_name for 2.5 models (required by keyframe/reference modes)', () => {
    const url = buildAgnesPollUrl(
      {
        base_url: 'https://api.agnes-ai.cn/v1',
        provider: 'agnes',
        api_protocol: 'agnes',
        model: ['agnes-video-2.5-flash'],
        default_model: 'agnes-video-2.5-flash',
        query_endpoint: '/videos/{taskId}',
      },
      'task_f9KR0Wy1BaluMcW92RhASmAKl2KwZDqS'
    );
    assert.equal(
      url,
      'https://api.agnes-ai.cn/v1/videos/task_f9KR0Wy1BaluMcW92RhASmAKl2KwZDqS?model_name=agnes-video-2.5-flash'
    );
  });

  it('does not append model_name for v2.0 models', () => {
    const url = buildAgnesPollUrl(
      {
        base_url: 'https://apihub.agnes-ai.com/v1',
        provider: 'agnes',
        api_protocol: 'agnes',
        model: ['agnes-video-v2.0'],
        query_endpoint: '/videos/{taskId}',
      },
      'task_abc'
    );
    assert.equal(url, 'https://apihub.agnes-ai.com/v1/videos/task_abc');
  });
});
