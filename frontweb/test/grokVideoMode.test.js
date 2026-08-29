import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  GROK_DEFAULT_ASPECT,
  GROK_DEFAULT_RESOLUTION,
  GROK_DEFAULT_DURATION,
  resolveGrokGenerationMode,
  applyGrokVideoMode,
  isGrok1080pAllowed,
  isXaiVideoConfig,
  composeGrokAwareVideoBody,
} from '../src/utils/grokVideoMode.js'

describe('grokVideoMode', () => {
  it('defaults are 9:16 / 720p / 6s', () => {
    assert.equal(GROK_DEFAULT_ASPECT, '9:16')
    assert.equal(GROK_DEFAULT_RESOLUTION, '720p')
    assert.equal(GROK_DEFAULT_DURATION, 6)
  })

  it('auto: first frame becomes I2V', () => {
    const r = resolveGrokGenerationMode({
      firstFrameUrl: 'https://cdn/first.jpg',
      referenceUrls: ['https://cdn/first.jpg'],
    })
    assert.equal(r.mode, 'i2v')
  })

  it('auto: refs only become R2V', () => {
    const r = resolveGrokGenerationMode({
      referenceUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'],
    })
    assert.equal(r.mode, 'r2v')
  })

  it('rejects mixed first frame and extra refs', () => {
    const r = resolveGrokGenerationMode({
      firstFrameUrl: 'https://cdn/first.jpg',
      referenceUrls: ['https://cdn/other.jpg'],
    })
    assert.equal(r.mode, 'invalid')
  })

  it('R2V caps 1080p to 720p and I2V keeps 1080p', () => {
    const r2v = applyGrokVideoMode('r2v', {
      referenceUrls: ['https://cdn/a.jpg'],
      resolution: '1080p',
    })
    assert.equal(r2v.resolution, '720p')
    assert.equal(r2v.first_frame_url, undefined)
    const i2v = applyGrokVideoMode('i2v', {
      firstFrameUrl: 'https://cdn/first.jpg',
      resolution: '1080p',
    })
    assert.equal(i2v.resolution, '1080p')
    assert.equal(i2v.reference_image_urls, undefined)
    assert.equal(isGrok1080pAllowed('r2v'), false)
    assert.equal(isGrok1080pAllowed('i2v'), true)
  })

  it('isXaiVideoConfig matches xai/grok provider', () => {
    assert.equal(isXaiVideoConfig({ provider: 'xai' }), true)
    assert.equal(isXaiVideoConfig({ api_protocol: 'xai' }), true)
    assert.equal(isXaiVideoConfig({ provider: 'agnes' }), false)
  })

  it('compose exclusive auto I2V drops extra refs', () => {
    const body = composeGrokAwareVideoBody('auto', {
      first_frame_url: 'https://cdn/first.jpg',
      image_url: 'https://cdn/first.jpg',
      reference_image_urls: ['https://cdn/first.jpg'],
      resolution: '720p',
    })
    assert.equal(body.first_frame_url, 'https://cdn/first.jpg')
    assert.equal(body.reference_image_urls, undefined)
    assert.equal(body.aspect_ratio, '9:16')
  })

  it('compose can keep mixed payload for non-xAI vendors', () => {
    const body = composeGrokAwareVideoBody('auto', {
      first_frame_url: 'https://cdn/first.jpg',
      reference_image_urls: ['https://cdn/other.jpg'],
      aspect_ratio: '16:9',
    }, { applyExclusive: false })
    assert.equal(body.first_frame_url, 'https://cdn/first.jpg')
    assert.deepEqual(body.reference_image_urls, ['https://cdn/other.jpg'])
    assert.equal(body.aspect_ratio, '16:9')
  })
})
