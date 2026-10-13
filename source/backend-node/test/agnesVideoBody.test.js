const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAgnesVideoImagePayload,
  buildAgnesVideo25Body,
  formatVideoPostBodyForLog,
  normalizeAgnesVideo25Duration,
  normalizeAgnesVideo25Size,
} = require('../src/services/videoClient');

describe('formatVideoPostBodyForLog', () => {
  it('keeps full http URLs and labels extra_body images with index', () => {
    const formatted = formatVideoPostBodyForLog({
      model: 'agnes-video-v2.0',
      prompt: 'test prompt',
      extra_body: {
        image: ['https://cdn/a.jpg', 'https://cdn/b.png'],
      },
    });
    assert.deepEqual(formatted.extra_body.image, [
      '[0] https://cdn/a.jpg',
      '[1] https://cdn/b.png',
    ]);
    assert.equal(formatted.prompt, 'test prompt');
  });

  it('summarizes base64 image fields', () => {
    const dataUrl = 'data:image/png;base64,' + 'A'.repeat(100);
    const formatted = formatVideoPostBodyForLog({ image: dataUrl });
    assert.match(formatted.image, /^\(base64, \d+ chars\)$/);
  });

  it('summarizes Video 2.5 first_frame / images', () => {
    const formatted = formatVideoPostBodyForLog({
      model: 'agnes-video-2.5-flash',
      mode: 'keyframe',
      first_frame: 'https://cdn/first.jpg',
      last_frame: 'https://cdn/last.jpg',
      images: ['https://cdn/a.jpg'],
    });
    assert.equal(formatted.first_frame, 'https://cdn/first.jpg');
    assert.equal(formatted.last_frame, 'https://cdn/last.jpg');
    assert.deepEqual(formatted.images, ['[0] https://cdn/a.jpg']);
  });
});

describe('buildAgnesVideoImagePayload', () => {
  it('uses extra_body.image array for omni multi-reference without keyframes mode', () => {
    const refs = ['https://cdn/a.jpg', 'https://cdn/b.png', 'https://cdn/c.png'];
    const out = buildAgnesVideoImagePayload({
      useOmniReference: true,
      resolvedRefs: refs,
      firstResolved: 'https://cdn/a.jpg',
      lastResolved: 'https://cdn/z.jpg',
    });
    assert.equal(out.strategy, 'omni_reference_extra_body');
    assert.deepEqual(out.extra_body, { image: refs });
    assert.equal(out.image, undefined);
    assert.equal(out.extra_body.mode, undefined);
  });

  it('uses single top-level image string for one omni reference', () => {
    const out = buildAgnesVideoImagePayload({
      useOmniReference: true,
      resolvedRefs: ['https://cdn/scene.jpg'],
      firstResolved: null,
      lastResolved: null,
    });
    assert.equal(out.strategy, 'omni_reference_single');
    assert.equal(out.image, 'https://cdn/scene.jpg');
  });

  it('uses extra_body keyframes only for classic first/last (not omni)', () => {
    const out = buildAgnesVideoImagePayload({
      useOmniReference: false,
      resolvedRefs: [],
      firstResolved: 'https://cdn/first.jpg',
      lastResolved: 'https://cdn/last.jpg',
    });
    assert.equal(out.strategy, 'classic_keyframes');
    assert.deepEqual(out.extra_body, {
      mode: 'keyframes',
      image: ['https://cdn/first.jpg', 'https://cdn/last.jpg'],
    });
    assert.equal(out.image, undefined);
  });

  it('does not use keyframes mode when omni refs exist', () => {
    const refs = ['https://cdn/s.jpg', 'https://cdn/c.jpg'];
    const out = buildAgnesVideoImagePayload({
      useOmniReference: true,
      resolvedRefs: refs,
      firstResolved: 'https://cdn/s.jpg',
      lastResolved: 'https://cdn/l.jpg',
    });
    assert.equal(out.strategy, 'omni_reference_extra_body');
    assert.equal(out.extra_body.mode, undefined);
  });
});

describe('buildAgnesVideo25Body', () => {
  it('builds text mode with seconds / size / aspect_ratio', () => {
    const { body, strategy } = buildAgnesVideo25Body({
      model: 'agnes-video-2.5-flash',
      prompt: 'a cat walks',
      duration: 8,
      aspect_ratio: '9:16',
      resolution: '1080p',
      useOmniReference: false,
      resolvedRefs: [],
      firstResolved: null,
      lastResolved: null,
    });
    assert.equal(strategy, 'v25_text');
    assert.equal(body.mode, 'text');
    assert.equal(body.seconds, '8');
    assert.equal(body.size, '720P'); // flash fixed
    assert.equal(body.aspect_ratio, '9:16');
    assert.equal(body.width, undefined);
    assert.equal(body.num_frames, undefined);
  });

  it('builds keyframe mode with first/last frame', () => {
    const { body, strategy } = buildAgnesVideo25Body({
      model: 'agnes-video-2.5',
      prompt: 'walk',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '1080p',
      useOmniReference: false,
      resolvedRefs: [],
      firstResolved: 'https://cdn/f.jpg',
      lastResolved: 'https://cdn/l.jpg',
    });
    assert.equal(strategy, 'v25_keyframe');
    assert.equal(body.mode, 'keyframe');
    assert.equal(body.size, '2K');
    assert.equal(body.first_frame, 'https://cdn/f.jpg');
    assert.equal(body.last_frame, 'https://cdn/l.jpg');
  });

  it('builds reference mode and caps flash images at 5', () => {
    const refs = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => `https://cdn/${x}.jpg`);
    const { body, strategy } = buildAgnesVideo25Body({
      model: 'agnes-video-2.5-flash',
      prompt: 'use refs',
      duration: 5,
      aspect_ratio: '16:9',
      useOmniReference: true,
      resolvedRefs: refs,
      firstResolved: null,
      lastResolved: null,
    });
    assert.equal(strategy, 'v25_reference');
    assert.equal(body.mode, 'reference');
    assert.equal(body.images.length, 5);
  });

  it('clamps duration to 4–12 seconds', () => {
    assert.equal(normalizeAgnesVideo25Duration(2), '4');
    assert.equal(normalizeAgnesVideo25Duration(15), '12');
    assert.equal(normalizeAgnesVideo25Duration(5), '5');
  });

  it('flash size is always 720P', () => {
    assert.equal(normalizeAgnesVideo25Size('agnes-video-2.5-flash', '2K'), '720P');
    assert.equal(normalizeAgnesVideo25Size('agnes-video-2.5', '1080p'), '2K');
    assert.equal(normalizeAgnesVideo25Size('agnes-video-2.5', '720p'), '720P');
  });
});
