const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const doc = require('../src/services/freeCanvas/document');

describe('free canvas document', () => {
  it('rejects a server field, a cycle, and a second storyboard image edge', () => {
    const id = doc.createIdFactory();
    let graph = doc.emptyGraph();
    const script = doc.createNode(graph, { type: 'script', data: { title: '甲' } }, id);
    graph = script.graph;
    const image = doc.createNode(graph, { type: 'image', data: { prompt: '图', image_url: 'secret' } }, id);
    assert.equal(image.ok, false);
    assert.match(image.error, /不能改/);

    const story = doc.createNode(graph, { type: 'storyboard', data: { duration: 4 } }, id);
    assert.equal(story.ok, false);

    const board = doc.createNode(graph, { type: 'storyboard', data: { shot_number: 1, action: '走' } }, id);
    graph = board.graph;
    const pic = doc.createNode(graph, { type: 'image', data: { prompt: '街' } }, id);
    graph = pic.graph;
    const linked = doc.addEdge(graph, { source: script.node.id, target: board.node.id, relation: 'prompt_for' }, id);
    graph = linked.graph;
    const toPic = doc.addEdge(graph, { source: board.node.id, target: pic.node.id, relation: 'prompt_for' }, id);
    graph = toPic.graph;
    const again = doc.addEdge(graph, { source: board.node.id, target: pic.node.id, relation: 'prompt_for' }, id);
    assert.equal(again.ok, false);
    const self = doc.addEdge(graph, { source: board.node.id, target: board.node.id, relation: 'prompt_for' }, id);
    assert.equal(self.ok, false);
    assert.equal(self.error, '连线会成环');
    assert.equal(doc.reaches({ edges: [{ source: 'b', target: 'a' }] }, 'b', 'a'), true);
  });
});
