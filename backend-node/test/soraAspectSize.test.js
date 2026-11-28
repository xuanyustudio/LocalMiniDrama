const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const videoClient = require('../src/services/videoClient');
const aiConfigService = require('../src/services/aiConfigService');

const originalListConfigs = aiConfigService.listConfigs;
const originalFetch = global.fetch;

const noopLog = { info() {}, warn() {}, error() {}, debug() {} };

function makeSoraConfig(overrides = {}) {
  return {
    id: 1,
    service_type: 'video',
    is_active: true,
    is_default: true,
    provider: 'agnes',
    api_protocol: 'sora',
    base_url: 'https://gateway.example.com/v1',
    api_key: 'test-key',
    model: ['sora-2'],
    default_model: 'sora-2',
    ...overrides,
  };
}

function extractMultipartField(bodyBuffer, fieldName) {
  const text = Buffer.from(bodyBuffer).toString('latin1');
  const pattern = new RegExp('name="' + fieldName + '"\\r\\n\\r\\n([^\\r\\n]+)\\r\\n');
  const m = text.match(pattern);
  return m ? m[1] : null;
}

async function captureSoraSubmission(opts) {
  let captured = null;
  global.fetch = async (url, options) => {
    captured = { url: String(url), body: options.body, headers: options.headers };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'task-1', status: 'processing' }),
    };
  };
  const result = await videoClient.callVideoApi(null, noopLog, {
    prompt: '测试分镜画面',
    model: 'sora-2',
    duration: 8,
    video_gen_id: 1,
    ...opts,
  });
  return { result, captured };
}

describe('Sora 兼容协议按请求比例提交尺寸（issue #81）', () => {
  beforeEach(() => {
    aiConfigService.listConfigs = () => [makeSoraConfig()];
  });

  afterEach(() => {
    aiConfigService.listConfigs = originalListConfigs;
    global.fetch = originalFetch;
  });

  const expectedSizes = {
    '9:16': '720x1280',
    '3:4': '720x960',
    '1:1': '1024x1024',
    '16:9': '1280x720',
    '4:3': '960x720',
    '21:9': '1680x720',
  };

  for (const [ratio, expected] of Object.entries(expectedSizes)) {
    it(`提交 ${ratio} 时 multipart size 为 ${expected}`, async () => {
      const { result, captured } = await captureSoraSubmission({ aspect_ratio: ratio });
      assert.equal(result.error, undefined);
      assert.equal(result.task_id, 'task-1');
      assert.match(captured.url, /\/videos$/);
      assert.equal(extractMultipartField(captured.body, 'size'), expected);
    });
  }

  it('未指定比例时保持默认竖屏 720x1280', async () => {
    const { result, captured } = await captureSoraSubmission({ aspect_ratio: '' });
    assert.equal(result.task_id, 'task-1');
    assert.equal(extractMultipartField(captured.body, 'size'), '720x1280');
  });

  it('sizeMap 每一项的宽高比与键一致，防止再次漂移', () => {
    for (const [ratio, size] of Object.entries(expectedSizes)) {
      const [w, h] = size.split('x').map(Number);
      const [rw, rh] = ratio.split(':').map(Number);
      const diff = Math.abs(w / h - rw / rh);
      assert.ok(
        diff <= 0.01,
        `${ratio} -> ${size}: 宽高比 ${w}/${h}=${(w / h).toFixed(4)} 偏离 ${(rw / rh).toFixed(4)} 超过 0.01`
      );
    }
  });
});
