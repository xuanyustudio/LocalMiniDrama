const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { applyCommand } = require('../src/services/freeCanvas/commands');
const { emptyGraph, createIdFactory } = require('../src/services/freeCanvas/document');

describe('free canvas layout', () => {
  it('places a storyboard to the right of its script', () => {
    const ids = createIdFactory();
    const result = applyCommand(emptyGraph(), {
      name: 'apply_ops',
      ops: [
        { op: 'create_node', temp_id: 's', type: 'script', data: { title: '甲' } },
        { op: 'create_node', temp_id: 'b', type: 'storyboard', data: { shot_number: 1 } },
        { op: 'create_edge', source: 's', target: 'b', relation: 'prompt_for' },
        { op: 'layout_nodes' },
      ],
    }, ids);
    const script = result.graph.nodes.find((node) => node.type === 'script');
    const board = result.graph.nodes.find((node) => node.type === 'storyboard');
    assert.equal(script.position.x, 80);
    assert.equal(board.position.x, 400);
    assert.ok(board.position.y >= script.position.y);
  });
});
