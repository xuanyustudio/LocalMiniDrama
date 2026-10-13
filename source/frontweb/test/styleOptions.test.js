import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_STYLE_VALUE,
  stylePromptMetadataForSave,
  findStyleOption,
  getStyleLabel,
  getStylePromptEn,
  getStylePromptZh,
} from '../src/constants/styleOptions.js'

test('preset returns zh/en prompts', () => {
  const m = stylePromptMetadataForSave('realistic')
  assert.ok(m.style_prompt_zh.includes('写实'))
  assert.ok(m.style_prompt_en.includes('photorealistic'))
})

test('empty style clears prompts', () => {
  assert.deepEqual(stylePromptMetadataForSave(''), {
    style_prompt_zh: '',
    style_prompt_en: '',
  })
})

test('custom with prompt writes same zh/en', () => {
  const desc = '赛博朋克水墨，霓虹映在宣纸上'
  assert.deepEqual(stylePromptMetadataForSave(CUSTOM_STYLE_VALUE, desc), {
    style_prompt_zh: desc,
    style_prompt_en: desc,
  })
})

test('custom without prompt does not write literal custom', () => {
  assert.deepEqual(stylePromptMetadataForSave(CUSTOM_STYLE_VALUE), {
    style_prompt_zh: '',
    style_prompt_en: '',
  })
  assert.deepEqual(stylePromptMetadataForSave(CUSTOM_STYLE_VALUE, '  '), {
    style_prompt_zh: '',
    style_prompt_en: '',
  })
})

test('unknown legacy string still mirrors zh/en', () => {
  assert.deepEqual(stylePromptMetadataForSave('古风仙侠'), {
    style_prompt_zh: '古风仙侠',
    style_prompt_en: '古风仙侠',
  })
})

test('getStyleLabel covers custom and presets', () => {
  assert.equal(getStyleLabel('realistic'), '写实')
  assert.equal(getStyleLabel(CUSTOM_STYLE_VALUE), '自定义')
  assert.equal(getStyleLabel('2d gufeng'), '2D 古风')
  assert.equal(getStyleLabel('unknown-x'), 'unknown-x')
})

test('findStyleOption does not treat custom as preset', () => {
  assert.equal(findStyleOption(CUSTOM_STYLE_VALUE), null)
})

test('getStylePrompt helpers do not return literal custom', () => {
  assert.equal(getStylePromptEn(CUSTOM_STYLE_VALUE), undefined)
  assert.equal(getStylePromptZh(CUSTOM_STYLE_VALUE), undefined)
})
