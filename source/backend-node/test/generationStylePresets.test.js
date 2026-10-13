const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveStylePreset } = require('../src/constants/generationStylePresets');

const EXTRA = [
  '2d gufeng',
  'xianxia 3d',
  'gufeng 3d',
  'neo chinese guochao',
  'neo gufeng',
  'urban romance comic',
  'korean romance webtoon',
];

for (const value of EXTRA) {
  test(`resolves ${value}`, () => {
    const p = resolveStylePreset(value);
    assert.ok(p, `missing preset ${value}`);
    assert.ok(p.zh.length > 10);
    assert.ok(p.en.length > 10);
  });
}

test('custom is not a preset', () => {
  assert.equal(resolveStylePreset('custom'), null);
});
