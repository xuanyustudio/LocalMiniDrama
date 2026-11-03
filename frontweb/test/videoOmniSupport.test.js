import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canUseUniversalOmniVideoApi,
  isSeedance2VideoModel,
  parseAiConfigSettings,
  videoModelNameFromAiConfig,
} from '../src/utils/videoOmniSupport.js'

test('videoModelNameFromAiConfig prefers default_model then first model', () => {
  assert.equal(videoModelNameFromAiConfig({ default_model: 'a' }), 'a')
  assert.equal(videoModelNameFromAiConfig({ model: ['b', 'c'] }), 'b')
  assert.equal(videoModelNameFromAiConfig({ model: 'd' }), 'd')
  assert.equal(videoModelNameFromAiConfig(null), '')
})

test('parseAiConfigSettings handles object, JSON string and invalid JSON', () => {
  assert.deepEqual(parseAiConfigSettings({ settings: { supports_universal_omni: true } }), {
    supports_universal_omni: true,
  })
  assert.deepEqual(parseAiConfigSettings({ settings: '{"supports_universal_omni":1}' }), {
    supports_universal_omni: 1,
  })
  assert.deepEqual(parseAiConfigSettings({ settings: 'not-json' }), {})
  assert.deepEqual(parseAiConfigSettings({}), {})
})

test('isSeedance2VideoModel recognizes 2.x official names and gateway aliases', () => {
  assert.equal(isSeedance2VideoModel('Doubao-Seedance-2.5 260628'), true)
  assert.equal(isSeedance2VideoModel('doubao-seedance-2-0-250528'), true)
  assert.equal(isSeedance2VideoModel('jimeng-video-seedance-2.0'), true)
  assert.equal(isSeedance2VideoModel('mingiz-sd2'), true)
  assert.equal(isSeedance2VideoModel(''), false)
})

test('isSeedance2VideoModel rejects 1.x models', () => {
  assert.equal(isSeedance2VideoModel('doubao-seedance-1-5-pro'), false)
  assert.equal(isSeedance2VideoModel('doubao-seedance-1-0-pro-keep'), false)
})

test('Seedance 2.x on classic volcengine protocol is omni-capable (issue #49)', () => {
  const cfg = {
    provider: 'volcengine',
    api_protocol: 'volcengine',
    model: ['doubao-seedance-2.5-260628'],
    default_model: 'doubao-seedance-2.5-260628',
  }
  assert.equal(canUseUniversalOmniVideoApi(cfg), true)
})

test('kling_omni / volcengine_omni / agnes / cheap_seedance2 stay omni-capable', () => {
  assert.equal(canUseUniversalOmniVideoApi({ api_protocol: 'kling_omni' }), true)
  assert.equal(canUseUniversalOmniVideoApi({ api_protocol: 'volcengine_omni' }), true)
  assert.equal(canUseUniversalOmniVideoApi({ provider: 'agnes', model: 'agnes-video-v2.0' }), true)
  assert.equal(
    canUseUniversalOmniVideoApi({ provider: 'cheap_seedance2', model: 'wb-seedance-2-fast' }),
    true
  )
  assert.equal(canUseUniversalOmniVideoApi({ provider: 'openai', model: 'yk-seedance-mini' }), true)
  assert.equal(canUseUniversalOmniVideoApi({ provider: 'openai', model: 'minimax-h3-1080p-15s' }), true)
})

test('explicit supports_universal_omni setting still enables omni', () => {
  const cfg = { provider: 'openai', model: 'sora-2', settings: '{"supports_universal_omni":true}' }
  assert.equal(canUseUniversalOmniVideoApi(cfg), true)
})

test('non omni-capable models without opt-in are rejected', () => {
  assert.equal(canUseUniversalOmniVideoApi({ provider: 'openai', model: 'sora-2' }), false)
  assert.equal(
    canUseUniversalOmniVideoApi({
      provider: 'volcengine',
      api_protocol: 'volcengine',
      model: 'doubao-seedance-1-5-pro',
    }),
    false
  )
  assert.equal(canUseUniversalOmniVideoApi(null), false)
})
