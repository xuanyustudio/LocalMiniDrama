const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { applyCommand } = require('../src/services/freeCanvas/commands');
const { emptyGraph, createIdFactory } = require('../src/services/freeCanvas/document');

describe('free canvas commands', () => {
  it('builds a script-storyboard-image chain or rolls back', () => {
    const ids = createIdFactory();
    const ok = applyCommand(emptyGraph(), {
      name: 'apply_ops',
      ops: [
        { op: 'create_node', temp_id: 's', type: 'script', data: { title: '甲' } },
        { op: 'create_node', temp_id: 'b', type: 'storyboard', data: { shot_number: 1, action: '推门' } },
        { op: 'create_node', temp_id: 'i', type: 'image', data: { prompt: '' } },
        { op: 'create_edge', source: 's', target: 'b', relation: 'prompt_for' },
        { op: 'create_edge', source: 'b', target: 'i', relation: 'prompt_for' },
      ],
    }, ids);
    assert.equal(ok.ok, true);
    assert.equal(ok.graph.nodes.length, 3);
    assert.equal(ok.graph.edges.length, 2);
    assert.equal(ok.receipt.created.length, 3);

    const bad = applyCommand(emptyGraph(), {
      name: 'apply_ops',
      ops: [
        { op: 'create_node', temp_id: 's', type: 'script', data: { title: '甲' } },
        { op: 'create_edge', source: 's', target: 'missing', relation: 'prompt_for' },
      ],
    }, ids);
    assert.equal(bad.ok, false);
    assert.equal(bad.graph, undefined);
  });

  it('rejects the 41st op and a server field inside the batch', () => {
    const ids = createIdFactory();
    const ops = Array.from({ length: 41 }, (_, index) => ({
      op: 'create_node', temp_id: `t${index}`, type: 'text', data: { text: String(index) },
    }));
    assert.equal(applyCommand(emptyGraph(), { name: 'apply_ops', ops }, ids).ok, false);
    const secret = applyCommand(emptyGraph(), {
      name: 'apply_ops',
      ops: [{ op: 'create_node', temp_id: 'i', type: 'image', data: { prompt: 'a', image_url: 'x' } }],
    }, ids);
    assert.equal(secret.ok, false);
  });
});
