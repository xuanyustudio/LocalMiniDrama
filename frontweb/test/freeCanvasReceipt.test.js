import test from 'node:test'
import assert from 'node:assert/strict'
import { applyReceipt, pendingConfirmNodes, assistantTextChangesGraph, documentFromCommandResponse } from '../src/utils/freeCanvasReceipt.js'

test('applies a receipt and ignores assistant prose', () => {
  const doc = { nodes: [], edges: [] }
  const next = applyReceipt(doc, {
    ok: true,
    graph: { nodes: [{ id: 'script_1', type: 'script' }], edges: [] },
  })
  assert.equal(next.nodes[0].id, 'script_1')
  assert.equal(assistantTextChangesGraph('已经建好剧本节点'), false)

  assert.equal(applyReceipt(doc, undefined), doc)
  assert.equal(applyReceipt(doc, { ok: false, graph: { nodes: [{ id: 'wiped' }], edges: [] } }), doc)
  assert.equal(applyReceipt(doc, { ok: true }), doc)
})

test('one canvas has a single confirm card', () => {
  const nodes = [
    { id: 'a', status: 'awaiting_confirm' },
    { id: 'b', status: 'awaiting_confirm' },
    { id: 'c', status: 'idle' },
  ]
  assert.deepEqual(pendingConfirmNodes(nodes).map((node) => node.id), ['a', 'b'])
})

test('reads the document from a command response and ignores chat text', () => {
  const doc = documentFromCommandResponse({ canvas: { document: { nodes: [{ id: 'n' }] } } })
  assert.equal(doc.nodes[0].id, 'n')
  assert.equal(documentFromCommandResponse({ reply: '已经做好了' }), null)
})
