'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveStoryboardFieldsFromAi } = require('../src/services/episodeStoryboardService');

function derive(input, opts = {}) {
  const storyboard = { storyboard_number: 1, ...input };
  deriveStoryboardFieldsFromAi(storyboard, '电影感二维动画', '9:16', opts);
  return storyboard.duration;
}

test('storyboard duration follows spoken content instead of the project clip default', () => {
  const short = derive({ dialogue: '快走。', action: '她转身。' }, { targetClipDuration: 15 });
  const long = derive({ dialogue: '门后的灯突然亮了起来，你把那封信交给我，然后立刻离开这里，不要回头。', action: '她迟疑地抬手，把信封推过门缝，随后退后一步。' }, { targetClipDuration: 4 });
  assert.equal(short, 5);
  assert.ok(long >= 10, `expected dialogue-driven duration, got ${long}`);
  assert.ok(long <= 15);
});

test('empty storyboard uses project clip duration as a bounded fallback', () => {
  assert.equal(derive({}, { targetClipDuration: 9 }), 10);
  assert.equal(derive({}, { targetClipDuration: 30 }), 30);
});

test('action complexity increases duration without exceeding provider bounds', () => {
  const simple = derive({ action: '她抬头。' });
  const complex = derive({ action: '她推门，跨进玄关，收起雨伞，擦去信封雨水，回头确认门外无人，随后把钥匙举到灯下。' });
  assert.ok(complex > simple, `${complex} should exceed ${simple}`);
  assert.ok(complex <= 30);
});
