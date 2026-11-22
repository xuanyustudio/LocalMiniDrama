const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { runNode, confirmRun } = require('../src/services/freeCanvas/run');

function scriptGraph() {
  return {
    nodes: [{ id: 's', type: 'script', status: 'idle', data: { title: '甲', premise: '前提', text: '' } }],
    edges: [],
  };
}

describe('free canvas text run', () => {
  it('refuses text generation when no text model is configured', async () => {
    let called = 0;
    const graph = scriptGraph();
    const result = await runNode(graph, { node_ids: ['s'], action: 'generate_text' }, {
      hasTextModel: () => false,
      completeText: async () => { called += 1; return '正文'; },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, '请先在 AI 配置里添加对应模型');
    assert.equal(called, 0);
    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.nodes[0].data.text, '');
  });

  it('writes script text and splits storyboards without keeping a failed batch', async () => {
    const written = await runNode(scriptGraph(), { node_ids: ['s'], action: 'generate_text', instruction: '短一点' }, {
      hasTextModel: () => true,
      completeText: async (prompt) => {
        assert.match(prompt, /前提/);
        assert.match(prompt, /短一点/);
        return '正文';
      },
    });
    assert.equal(written.ok, true);
    assert.equal(written.graph.nodes[0].data.text, '正文');
    assert.equal(written.graph.nodes[0].status, 'succeeded');

    const split = await runNode(written.graph, { node_ids: ['s'], action: 'split_storyboards' }, {
      hasTextModel: () => true,
      completeText: async () => '说明 [{"action":"推门","dialogue":"谁","prompt":"夜","duration":5},{"action":"回头","dialogue":"我","prompt":"灯","duration":3}]',
    });
    assert.equal(split.ok, true);
    const boards = split.graph.nodes.filter((node) => node.type === 'storyboard');
    assert.equal(boards.length, 2);
    assert.deepEqual(boards.map((node) => node.data.shot_number), [1, 2]);
    assert.equal(split.graph.edges.filter((edge) => edge.relation === 'prompt_for' && edge.source === 's').length, 2);

    const again = await runNode(split.graph, { node_ids: ['s'], action: 'split_storyboards' }, {
      hasTextModel: () => true,
      completeText: async () => '[]',
    });
    assert.equal(again.ok, false);
    assert.equal(again.error, '这个剧本已经有分镜');
    assert.equal(split.graph.nodes.length, 3);

    const tooMany = await runNode(scriptGraph(), { node_ids: ['s'], action: 'split_storyboards' }, {
      completeText: async () => JSON.stringify(Array.from({ length: 31 }, () => ({ action: '走' }))),
    });
    assert.equal(tooMany.ok, false);
    assert.equal(tooMany.graph, undefined);

    const thrown = await runNode(scriptGraph(), { node_ids: ['s'], action: 'generate_text' }, {
      completeText: async () => { throw new Error('down'); },
    });
    assert.equal(thrown.ok, false);
    assert.equal(thrown.graph, undefined);
  });

  it('asks before creating images and does not call the provider early', async () => {
    const graph = {
      nodes: [
        { id: 'a', type: 'image', status: 'idle', data: { prompt: '门' } },
        { id: 'b', type: 'image', status: 'idle', data: { prompt: '窗' } },
        { id: 'v', type: 'video', status: 'idle', data: {} },
      ],
      edges: [],
    };
    let images = 0;
    const pending = await runNode(graph, { node_ids: ['a', 'b'], action: 'generate_image' }, {
      hasImageModel: () => true,
      createImage: async () => { images += 1; return { id: 9 }; },
    });
    assert.equal(images, 0);
    assert.equal(pending.ok, true);
    assert.equal(pending.pending, true);
    assert.equal(pending.graph.nodes.filter((node) => node.status === 'awaiting_confirm').length, 2);

    const blocked = await runNode(pending.graph, { node_ids: ['v'], action: 'generate_video' }, {
      hasVideoModel: () => true,
      createVideo: async () => { throw new Error('should not run'); },
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error, '还有未确认的生成');

    const cancelled = await confirmRun(pending.graph, false, {});
    assert.equal(cancelled.cancelled, true);
    assert.equal(cancelled.graph.nodes.every((node) => node.status === 'idle'), true);

    const confirmed = await confirmRun(pending.graph, true, {
      createImage: async (body) => {
        images += 1;
        assert.equal(body.drama_id, 0);
        assert.equal(body.storyboard_id, null);
        return { id: 40 + images };
      },
    }, { aspectRatio: '9:16' });
    assert.equal(images, 2);
    assert.equal(confirmed.graph.nodes.find((node) => node.id === 'a').status, 'running');
    assert.equal(confirmed.graph.nodes.find((node) => node.id === 'a').data.generation_id, 41);
  });
});
