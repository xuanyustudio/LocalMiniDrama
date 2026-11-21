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

  it('keeps an explicit script position when a later batch only adds a group', () => {
    const ids = createIdFactory();
    const placed = applyCommand(emptyGraph(), {
      name: 'apply_ops',
      ops: [
        { op: 'create_node', temp_id: 's', type: 'script', data: { title: '甲' }, position: { x: 10, y: 10 } },
      ],
    }, ids);
    const script = placed.graph.nodes.find((node) => node.type === 'script');
    const grouped = applyCommand(placed.graph, {
      name: 'apply_ops',
      ops: [
        { op: 'group_nodes', node_ids: [script.id] },
      ],
    }, ids);
    const kept = grouped.graph.nodes.find((node) => node.type === 'script');
    const group = grouped.graph.nodes.find((node) => node.type === 'group');
    assert.deepEqual(kept.position, { x: 10, y: 10 });
    assert.equal(group.position, null);
  });
});
