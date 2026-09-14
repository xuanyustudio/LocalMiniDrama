const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isForbiddenVideoModel,
  filterUsableVideoModels,
  filterDiscoveredProjectVideoModels,
  quantizeStoryboardDuration,
  chooseVideoModel,
} = require('../src/services/videoModelPolicy');

describe('video model policy', () => {
  it('removes Hailuo and every Seedance 1.0 spelling', () => {
    assert.equal(isForbiddenVideoModel('MiniMax-Hailuo-2.3'), true);
    assert.equal(isForbiddenVideoModel('doubao-seedance-1-0-pro-250528'), true);
    assert.equal(isForbiddenVideoModel('seedance-1.0-lite'), true);
    assert.deepEqual(filterUsableVideoModels(['H3', 'seedance-1.0', 'seedance-2.5-30s']), ['H3', 'seedance-2.5-30s']);
  });

  it('keeps only project video families from a mixed upstream catalog', () => {
    assert.deepEqual(
      filterDiscoveredProjectVideoModels(['gpt-image-2', 'H3', 'seedance-1.0-fast-5s', 'seedance-2.5-30s']),
      ['H3', 'seedance-2.5-30s']
    );
  });

  it('rounds content upward to supported duration buckets', () => {
    assert.deepEqual([3, 7, 13, 18, 40].map(quantizeStoryboardDuration), [5, 10, 15, 30, 30]);
  });

  it('matches duration models and uses H3 as short fallback', () => {
    const models = ['H3', 'seedance-2.0-fast-5s', 'seedance-2.0-fast-10s', 'seedance-2.5-30s'];
    assert.equal(chooseVideoModel(models, '', 8), 'seedance-2.0-fast-10s');
    assert.equal(chooseVideoModel(models, '', 14), 'H3');
    assert.equal(chooseVideoModel(models, '', 25), 'seedance-2.5-30s');
  });
});
