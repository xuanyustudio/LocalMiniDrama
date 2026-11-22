const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { promptForImage, promptForVideo, spokenText } = require('../src/services/freeCanvas/prompts');

const graph = {
  nodes: [
    { id: 'style_2', type: 'style', data: { text: '水墨' } },
    { id: 'style_1', type: 'style', data: { text: '夜戏' } },
    { id: 'c', type: 'character', data: { name: '阿兰', prompt: '短发' } },
    { id: 'b', type: 'storyboard', data: { prompt: '推门', duration: 5, dialogue: '谁' } },
    { id: 'i', type: 'image', data: { prompt: '' } },
    { id: 'v', type: 'video', data: {} },
    { id: 'a', type: 'audio', data: { text: '' } },
  ],
  edges: [
    { source: 'b', target: 'i', relation: 'prompt_for' },
    { source: 'c', target: 'i', relation: 'context_for' },
    { source: 'style_2', target: 'i', relation: 'prompt_for' },
    { source: 'style_1', target: 'i', relation: 'prompt_for' },
    { source: 'i', target: 'v', relation: 'media_input_for' },
    { source: 'b', target: 'a', relation: 'prompt_for' },
  ],
};

describe('free canvas prompts', () => {
  it('joins the storyboard, character, and styles sorted by id', () => {
    const text = promptForImage(graph, 'i');
    assert.match(text, /推门/);
    assert.match(text, /阿兰/);
    assert.match(text, /短发/);
    assert.ok(text.indexOf('夜戏') < text.indexOf('水墨'));
    assert.equal(promptForVideo(graph, 'v').duration, 5);
    assert.match(promptForVideo(graph, 'v').prompt, /夜戏/);
    assert.equal(spokenText(graph, 'a'), '谁');
  });

  it('uses video prompt and upstream image path for i2v', () => {
    const withMedia = {
      nodes: [
        { id: 'i', type: 'image', data: { prompt: '静帧', image_url: '/static/bird.png', local_path: 'free/bird.png' } },
        { id: 'v', type: 'video', data: { prompt: '小鸟飞', duration: 8 } },
      ],
      edges: [{ source: 'i', target: 'v', relation: 'media_input_for' }],
    };
    const built = promptForVideo(withMedia, 'v');
    assert.match(built.prompt, /小鸟飞/);
    assert.equal(built.duration, 8);
    assert.equal(built.imagePath, 'free/bird.png');
  });
});
