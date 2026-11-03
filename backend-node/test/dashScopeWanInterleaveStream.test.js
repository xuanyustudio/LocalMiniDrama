const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { supportsDashScopeWanInterleaveStream } = require('../src/services/imageClient');

describe('#40 supportsDashScopeWanInterleaveStream：通义万象 Wan 系列是否支持「无参考图流式 + enable_interleave」组合', () => {
  // wan2.6 是唯一明确支持该组合的型号
  it('wan2.6 系列：支持', () => {
    assert.equal(supportsDashScopeWanInterleaveStream('wan2.6-image'), true);
    assert.equal(supportsDashScopeWanInterleaveStream('wan2.6'), true);
    assert.equal(supportsDashScopeWanInterleaveStream('WAN2.6-IMAGE'), true);
  });

  // wan2.7 是 issue 报告者复现的失败型号
  it('wan2.7+ 系列：不支持（会触发 400）', () => {
    assert.equal(supportsDashScopeWanInterleaveStream('wan2.7-image'), false);
    assert.equal(supportsDashScopeWanInterleaveStream('wan2.8-image'), false);
    assert.equal(supportsDashScopeWanInterleaveStream('wan3.0-image'), false);
  });

  // 未来型号（占位）：保守起见也返回 false，避免踩同样的坑
  it('未知型号：不支持（保守策略）', () => {
    assert.equal(supportsDashScopeWanInterleaveStream('qwen-image-max'), false);
    assert.equal(supportsDashScopeWanInterleaveStream('unknown-model'), false);
    assert.equal(supportsDashScopeWanInterleaveStream(''), false);
    assert.equal(supportsDashScopeWanInterleaveStream(null), false);
    assert.equal(supportsDashScopeWanInterleaveStream(undefined), false);
  });

  // 验证 4 种核心场景下「stream」应取的逻辑：
  // stream = interleave = !hasRefs && supportsInterleaveStream
  it('4 种核心场景：参数矩阵正确', () => {
    const cases = [
      // [model, hasRefs, expectedStream, expectedInterleave]
      ['wan2.6-image', false, true, true],   // 老路径：流式 + interleave
      ['wan2.6-image', true, false, false],   // 多参考图：本就走非流式
      ['wan2.7-image', false, false, false],  // 修复：wan2.7 不再走流式（不再 400）
      ['wan2.7-image', true, false, false],   // 多参考图：本来就非流式
    ];
    for (const [model, hasRefs, expStream, expInterleave] of cases) {
      const supports = supportsDashScopeWanInterleaveStream(model);
      const stream = !hasRefs && supports;
      const interleave = !hasRefs && supports;
      assert.equal(stream, expStream, `${model} hasRefs=${hasRefs}: stream`);
      assert.equal(interleave, expInterleave, `${model} hasRefs=${hasRefs}: interleave`);
    }
  });
});
