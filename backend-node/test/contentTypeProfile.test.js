'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PROFILES, getContentTypeProfile, parseMetadata } = require('../src/services/contentTypeProfile');

test('all supported production modes expose complete generation guidance', () => {
  assert.deepEqual(Object.keys(PROFILES), ['anime_series', 'short_drama', 'short_video', 'store_promo']);
  for (const [key, profile] of Object.entries(PROFILES)) {
    assert.equal(profile.defaultAspectRatio, '9:16', key);
    assert.ok(profile.targetSeconds >= 30, key);
    assert.ok(profile.storyRule.length > 20, key);
    assert.ok(profile.storyboardRule.length > 20, key);
  }
});

test('metadata can be read from persisted JSON and object values', () => {
  assert.equal(getContentTypeProfile('{"content_type":"anime_series"}').key, 'anime_series');
  assert.equal(getContentTypeProfile({ content_type: 'short_video' }).targetSeconds, 30);
});

test('unknown or malformed metadata safely falls back to short drama', () => {
  assert.deepEqual(parseMetadata('{broken'), {});
  assert.equal(getContentTypeProfile('{broken').key, 'short_drama');
  assert.equal(getContentTypeProfile({ content_type: 'unknown' }).key, 'short_drama');
});
