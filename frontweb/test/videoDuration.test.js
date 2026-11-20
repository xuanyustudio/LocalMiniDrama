import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isSupportedVideoDuration } from '../src/utils/videoDuration.js'

test('shot validation follows the active provider limits', () => {
  const wan = { minSeconds: 2, maxSeconds: 15 }
  const seedance = { minSeconds: 4, maxSeconds: 15 }
  assert.equal(isSupportedVideoDuration(3, wan), true)
  assert.equal(isSupportedVideoDuration(3, seedance), false)
  assert.equal(isSupportedVideoDuration(2, wan), true)
  assert.equal(isSupportedVideoDuration(15, wan), true)
  assert.equal(isSupportedVideoDuration(16, wan), false)
  assert.equal(isSupportedVideoDuration(3.5, wan), false)
})
