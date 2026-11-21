import assert from 'node:assert/strict'
import { test } from 'node:test'
import { productionCostItem, productionCostMessage } from '../src/utils/productionCost.js'

test('identifies chargeable requests and skips uploads, local work, and polling', () => {
  assert.equal(productionCostItem('/dramas/7/adaptation/rewrite', { chapter: 2 }).data.chapter, 2)
  assert.equal(productionCostItem('/dramas/7/adaptation/script', { rewritten: '改写后' }).kind, 'script')
  assert.equal(productionCostItem('/api/v1/storyboards/11/universal-segment-polish-stream').kind, 'polish')
  assert.equal(productionCostItem('/images', { storyboard_id: 11 }).kind, 'storyboard_image')
  assert.equal(productionCostItem('/audio/extract/batch', { storyboard_ids: [11, 12] }).kind, 'tts')
  assert.equal(productionCostItem('/dramas/7/adaptation/source'), null)
  assert.equal(productionCostItem('/episodes/7/finalize', { burn_dialogue_audio: true }), null)
  assert.equal(productionCostItem('/videos/5/resume-poll'), null)
  const file = new FormData()
  file.append('max_chapters', '4')
  assert.equal(productionCostItem('/dramas/import-novel', file), null)
  file.append('ai_summarize', 'true')
  assert.equal(productionCostItem('/dramas/import-novel', file).data.max_chapters, '4')
})

test('displays the known subtotal and keeps multiple unpriced requests labelled as unpriced', () => {
  const unknown = { label: '镜头视频', model: 'custom', maxUsd: null, minUsd: null, note: '暂无报价' }
  const message = productionCostMessage({ partial: true, minUsd: 0.00006, maxUsd: 0.00006, rows: [unknown, unknown,
    { label: '对白', minUsd: 0.00006, maxUsd: 0.00006 },
  ] })
  assert.match(message, /低于 US\$0\.0001，另有未报价项目/)
  assert.match(message, /custom · 2 项 · 暂无单价/)
})

test('story quotes count the premise the backend actually reads; connection tests skip the cost dialog', () => {
  assert.equal(productionCostItem('/generation/story', { premise: '一'.repeat(120) }).data.text_chars, 120)
  assert.equal(productionCostItem('/generation/story', { prompt: '一'.repeat(30) }).data.text_chars, 30)
  assert.equal(productionCostItem('/ai-configs/test', { service_type: 'text' }), null)
  assert.equal(productionCostItem('/storyboards/3/upscale').kind, 'service')
})

test('story bible drafts and AI script reviews are quoted; the free rule check is not', () => {
  assert.deepEqual(productionCostItem('/dramas/4/story-bible/generate', { chapter: 2 }), {
    kind: 'bible', id: '4', data: { ...productionCostItem('/dramas/4/story-bible/generate', { chapter: 2 }).data, chapter: 2, text_chars: 0 } })
  assert.equal(productionCostItem('/dramas/4/story-bible/generate', { text: '一'.repeat(50) }).data.text_chars, 50)
  // 从全书整理要报价；查进度和停止不报价
  const bookItem = productionCostItem('/dramas/4/story-bible/book', { from: 1, to: 40, fresh: true })
  assert.equal(bookItem.kind, 'bible_book')
  assert.deepEqual([bookItem.data.from, bookItem.data.to, bookItem.data.resume], [1, 40, false])
  assert.equal(productionCostItem('/dramas/4/story-bible/book', { resume: true }).data.resume, true)
  assert.equal(productionCostItem('/dramas/4/story-bible/book/cancel', {}), null)
  assert.equal(productionCostItem('/dramas/4/script-review', { script: '林宁：走。', ai: false }), null)
  const review = productionCostItem('/dramas/4/script-review', { script: '林宁：走。', ai: true })
  assert.equal(review.kind, 'review')
  assert.equal(review.data.text_chars, 5)
})
