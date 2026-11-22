const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const haiGateway = require('../src/utils/haiGateway');
const videoClient = require('../src/services/videoClient');

const DEFAULT_BASE = haiGateway.DEFAULT_HAI_API_BASE;

describe('haiGateway 配置解析', () => {
  const savedEnv = {};
  const KEYS = ['HAI_API_BASE', 'HAI_API_KEY'];
  beforeEach(() => {
    for (const k of KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it('resolveHaiBase：环境变量 > 配置 > 内置默认', () => {
    assert.equal(haiGateway.resolveHaiBase({ base_url: 'http://cfg.example/hai/api/v1' }), 'http://cfg.example/hai/api/v1');
    assert.equal(haiGateway.resolveHaiBase({}), DEFAULT_BASE);
    process.env.HAI_API_BASE = 'http://env.example/hai/api/v1/';
    assert.equal(haiGateway.resolveHaiBase({ base_url: 'http://cfg.example/hai/api/v1' }), 'http://env.example/hai/api/v1');
  });

  it('resolveHaiApiKey：环境变量优先（不落盘），配置兜底', () => {
    assert.equal(haiGateway.resolveHaiApiKey({ api_key: 'cfg-key' }), 'cfg-key');
    process.env.HAI_API_KEY = 'env-key';
    assert.equal(haiGateway.resolveHaiApiKey({ api_key: 'cfg-key' }), 'env-key');
    assert.equal(haiGateway.resolveHaiApiKey({}), 'env-key');
  });

  it('haiVideoConf：耗时预估参与超时下限（宁大勿小）', () => {
    const conf = haiGateway.haiVideoConf({ base_url: DEFAULT_BASE, api_key: 'k' }, 13);
    assert.ok(conf.timeoutSeconds >= conf.estimateSeconds);
    assert.equal(conf.modifier, 'VideoMinimaxH3I2v');
    assert.equal(conf.lightning, true);
    assert.equal(conf.watermark, false);
  });
});

describe('haiGateway 参数归一化', () => {
  it('normalizeHaiImageSize：宽高向下取整到 32 的倍数（720 → 704）', () => {
    assert.deepEqual(haiGateway.normalizeHaiImageSize('1280x720'), { width: 1280, height: 704 });
    assert.deepEqual(haiGateway.normalizeHaiImageSize('1024x1024'), { width: 1024, height: 1024 });
    assert.equal(haiGateway.normalizeHaiImageSize('2K'), null);
    assert.equal(haiGateway.normalizeHaiImageSize(''), null);
  });

  it('haiMegapixelCanvas：16:9 画布且为 32 的倍数', () => {
    const c = haiGateway.haiMegapixelCanvas(4);
    assert.equal(c.width % 32, 0);
    assert.equal(c.height % 32, 0);
    assert.ok(Math.abs(c.width / c.height - 16 / 9) < 0.02);
  });

  it('normalizeHaiVideoDuration：整数秒、下限 5、上限 15', () => {
    assert.equal(haiGateway.normalizeHaiVideoDuration(3.2), 5);
    assert.equal(haiGateway.normalizeHaiVideoDuration(5), 5);
    assert.equal(haiGateway.normalizeHaiVideoDuration(6.4), 7);
    assert.equal(haiGateway.normalizeHaiVideoDuration(30), 15);
    assert.equal(haiGateway.normalizeHaiVideoDuration(undefined), 5);
  });

  it('haiVideoAspect：16:9 横屏 / 9:16 竖屏 / HAI_ASPECT 覆盖 / 完整枚举映射', () => {
    const saved = process.env.HAI_ASPECT;
    delete process.env.HAI_ASPECT;
    assert.equal(haiGateway.haiVideoAspect('16:9'), 'LANDSCAPE_16_9');
    assert.equal(haiGateway.haiVideoAspect('9:16'), 'PORTRAIT_9_16');
    assert.equal(haiGateway.haiVideoAspect(''), 'LANDSCAPE_16_9');
    assert.equal(haiGateway.haiVideoAspect('1:1'), 'SQUARE');
    assert.equal(haiGateway.haiVideoAspect('2:3'), 'PORTRAIT_2_3');
    assert.equal(haiGateway.haiVideoAspect('3:4'), 'PORTRAIT_3_4');
    assert.equal(haiGateway.haiVideoAspect('3:2'), 'LANDSCAPE_3_2');
    assert.equal(haiGateway.haiVideoAspect('4:3'), 'LANDSCAPE_4_3');
    assert.equal(haiGateway.haiVideoAspect('21:9'), 'LANDSCAPE_16_9');
    process.env.HAI_ASPECT = 'LANDSCAPE_16_9';
    assert.equal(haiGateway.haiVideoAspect('9:16'), 'LANDSCAPE_16_9');
    if (saved === undefined) delete process.env.HAI_ASPECT;
    else process.env.HAI_ASPECT = saved;
  });

  it('haiVideoEstimateSeconds：随段长增长', () => {
    assert.ok(haiGateway.haiVideoEstimateSeconds(13) > haiGateway.haiVideoEstimateSeconds(5));
    assert.ok(haiGateway.haiVideoEstimateSeconds(5) > 100);
  });
});

describe('haiGateway 响应解析', () => {
  it('extractHaiImageUrl / extractHaiVideoUrl：按 media_type 取第一个 download_url', () => {
    const task = {
      status: 'completed',
      output: [
        { media_type: 'video', download_url: '/files/v.mp4' },
        { media_type: 'image', download_url: '/files/i.png' },
      ],
    };
    assert.equal(haiGateway.extractHaiImageUrl(task), '/files/i.png');
    assert.equal(haiGateway.extractHaiVideoUrl(task), '/files/v.mp4');
    assert.equal(haiGateway.extractHaiImageUrl({ status: 'completed', output: [] }), null);
    assert.equal(haiGateway.extractHaiVideoUrl(null), null);
  });

  it('extractHaiPollVideoUrl：相对路径拼网关源站，绝对地址原样返回', () => {
    const base = 'http://10.0.0.8:60788/mgpu-node3-prod/hai/api/v1';
    assert.equal(
      haiGateway.extractHaiPollVideoUrl({ status: 'completed', output: [{ media_type: 'video', download_url: '/out/a.mp4' }] }, base),
      'http://10.0.0.8:60788/out/a.mp4'
    );
    assert.equal(
      haiGateway.extractHaiPollVideoUrl({ status: 'completed', output: [{ media_type: 'video', download_url: 'http://cdn.example/x.mp4' }] }, base),
      'http://cdn.example/x.mp4'
    );
  });

  it('extractHaiPollStatus：小写化状态', () => {
    assert.equal(haiGateway.extractHaiPollStatus({ status: 'Completed' }), 'completed');
    assert.equal(haiGateway.extractHaiPollStatus({}), '');
  });
});

describe('haiGateway buildHaiVideoRequest：I2V / R2V 路由', () => {
  const conf = { megapixels: 1, lightning: true, watermark: false };
  const saved = {};
  beforeEach(() => {
    saved.modifier = process.env.HAI_VIDEO_MODIFIER;
    saved.modifier2 = process.env.HAI_MODIFIER;
    delete process.env.HAI_VIDEO_MODIFIER;
    delete process.env.HAI_MODIFIER;
  });
  afterEach(() => {
    if (saved.modifier !== undefined) process.env.HAI_VIDEO_MODIFIER = saved.modifier;
    if (saved.modifier2 !== undefined) process.env.HAI_MODIFIER = saved.modifier2;
  });

  it('有参考图 → R2V：首帧并入 ref_images[0]，prompt 带 <Picture> 编号', () => {
    const r = haiGateway.buildHaiVideoRequest({
      prompt: '人物走进房间', duration: 5, aspectRatio: '16:9',
      firstFrame: 'first.png', lastFrame: null, refImages: ['role.png', 'scene.png'], conf,
    });
    assert.equal(r.modifier, 'VideoMinimaxH3R2v');
    assert.deepEqual(r.modifications.ref_images, ['first.png', 'role.png', 'scene.png']);
    assert.ok(r.modifications.prompt.includes('<Picture 1>'));
    assert.ok(r.modifications.prompt.includes('<Picture 2>'));
    assert.equal(r.modifications.duration_seconds, 5);
    assert.equal(r.modifications.aspect_ratio, 'LANDSCAPE_16_9');
    assert.equal(r.modifications.megapixels, 1);
    // R2V 无 watermark / first_frame 字段
    assert.equal(r.modifications.watermark, undefined);
    assert.equal(r.modifications.first_frame, undefined);
  });

  it('仅首帧 → I2V（首帧精确控制）', () => {
    const r = haiGateway.buildHaiVideoRequest({
      prompt: '镜头推进', duration: 6, aspectRatio: '9:16',
      firstFrame: 'first.png', lastFrame: 'last.png', refImages: [], conf,
    });
    assert.equal(r.modifier, 'VideoMinimaxH3I2v');
    assert.equal(r.modifications.first_frame, 'first.png');
    assert.equal(r.modifications.last_frame, 'last.png');
    assert.equal(r.modifications.duration_seconds, 6);
    assert.equal(r.modifications.aspect_ratio, 'PORTRAIT_9_16');
    assert.equal(r.modifications.watermark, false);
  });

  it('无任何素材 → I2V 纯文生视频（first_frame 缺省）', () => {
    const r = haiGateway.buildHaiVideoRequest({
      prompt: '城市延时摄影', duration: 5, aspectRatio: '16:9',
      firstFrame: null, lastFrame: null, refImages: [], conf,
    });
    assert.equal(r.modifier, 'VideoMinimaxH3I2v');
    assert.equal(r.modifications.first_frame, undefined);
  });

  it('有音色参考 → 强制 R2V：ref_audios 注入且 prompt 带 <Audio 1> 口型同步指令（I2V 不支持音频）', () => {
    const r = haiGateway.buildHaiVideoRequest({
      prompt: '角色说「你好」', duration: 5, aspectRatio: '16:9',
      firstFrame: 'first.png', lastFrame: null, refImages: [], refAudios: ['voice.mp3'], conf,
    });
    assert.equal(r.modifier, 'VideoMinimaxH3R2v');
    assert.deepEqual(r.modifications.ref_audios, ['voice.mp3']);
    assert.deepEqual(r.modifications.ref_images, ['first.png']);
    assert.ok(r.modifications.prompt.includes('<Audio 1>'));
    assert.ok(r.modifications.prompt.includes('口型'));
  });

  it('仅音色无首帧 → R2V 纯音频驱动（ref_images 缺省不传空串）', () => {
    const r = haiGateway.buildHaiVideoRequest({
      prompt: '角色独白「台词」', duration: 5, aspectRatio: '16:9',
      firstFrame: null, lastFrame: null, refImages: [], refAudios: ['voice.wav'], conf,
    });
    assert.equal(r.modifier, 'VideoMinimaxH3R2v');
    assert.deepEqual(r.modifications.ref_images, []);
    assert.deepEqual(r.modifications.ref_audios, ['voice.wav']);
  });

  it('HAI_VIDEO_MODIFIER 强制指定时覆盖自动路由', () => {
    process.env.HAI_VIDEO_MODIFIER = 'VideoMinimaxH3R2v';
    const r = haiGateway.buildHaiVideoRequest({
      prompt: 'x', duration: 5, aspectRatio: '16:9',
      firstFrame: 'first.png', lastFrame: null, refImages: [], conf,
    });
    assert.equal(r.modifier, 'VideoMinimaxH3R2v');
    assert.deepEqual(r.modifications.ref_images, ['first.png']);
  });

  it('参考图超 9 张截断到 9 张（含首帧占位）', () => {
    const refs = Array.from({ length: 12 }, (_, i) => 'r' + i + '.png');
    const r = haiGateway.buildHaiVideoRequest({
      prompt: 'x', duration: 5, aspectRatio: '16:9',
      firstFrame: 'first.png', lastFrame: null, refImages: refs, conf,
    });
    assert.equal(r.modifications.ref_images.length, 9);
    assert.equal(r.modifications.ref_images[0], 'first.png');
  });
});

describe('videoClient HAI 协议接入', () => {
  it('resolveVideoProtocol：migu 厂商与 /hai/api base 均命中 hai 协议', () => {
    assert.equal(videoClient.resolveVideoProtocol({ provider: 'migu', api_protocol: 'hai', base_url: DEFAULT_BASE }), 'hai');
    assert.equal(videoClient.resolveVideoProtocol({ provider: '', base_url: 'http://36.138.206.92:60788/mgpu-node3-prod/hai/api/v1' }), 'hai');
    assert.equal(videoClient.resolveVideoProtocol({ provider: 'openai', base_url: 'https://api.openai.com/v1' }), 'openai');
  });

  it('isHaiVideoProvider：兼容 provider 名、配置对象两种入参', () => {
    assert.equal(videoClient.isHaiVideoProvider('migu'), true);
    assert.equal(videoClient.isHaiVideoProvider('hai'), true);
    assert.equal(videoClient.isHaiVideoProvider('openai'), false);
    assert.equal(videoClient.isHaiVideoProvider({ provider: 'migu' }), true);
    assert.equal(videoClient.isHaiVideoProvider({ provider: 'x', base_url: 'http://h/hai/api/v1' }), true);
    assert.equal(videoClient.isHaiVideoProvider(null), false);
  });

  it('buildQueryUrl：hai 协议轮询地址为 {base}/result/{taskId}，支持 HAI_API_BASE 覆盖', () => {
    const saved = process.env.HAI_API_BASE;
    delete process.env.HAI_API_BASE;
    const url = videoClient.buildQueryUrl({ provider: 'migu', api_protocol: 'hai', base_url: DEFAULT_BASE }, 'req-123');
    assert.equal(url, DEFAULT_BASE + '/result/req-123');
    process.env.HAI_API_BASE = 'http://env.example/hai/api/v1';
    const urlEnv = videoClient.buildQueryUrl({ provider: 'migu', api_protocol: 'hai', base_url: DEFAULT_BASE }, 'req-123');
    assert.equal(urlEnv, 'http://env.example/hai/api/v1/result/req-123');
    if (saved === undefined) delete process.env.HAI_API_BASE;
    else process.env.HAI_API_BASE = saved;
  });

  it('callVideoApi：无配置/缺 Key 时不走网络层，返回明确错误', async () => {
    const savedBase = process.env.HAI_API_BASE;
    const savedKey = process.env.HAI_API_KEY;
    delete process.env.HAI_API_BASE;
    delete process.env.HAI_API_KEY;
    const fakeLog = { info: () => {}, warn: () => {}, error: () => {} };
    const fakeDb = {
      prepare: () => ({ get: () => null, all: () => [] }),
    };
    try {
      let thrown = null;
      let out = null;
      try {
        out = await videoClient.callVideoApi(fakeDb, fakeLog, { prompt: 'x', video_gen_id: 1 });
      } catch (e) {
        thrown = e;
      }
      const msg = thrown ? String(thrown.message) : String((out && out.error) || '');
      assert.ok(
        msg.includes('未配置视频模型') || msg.includes('API Key'),
        '应返回「未配置视频模型」或「缺少 API Key」类错误，实际: ' + msg.slice(0, 120)
      );
    } finally {
      if (savedBase !== undefined) process.env.HAI_API_BASE = savedBase;
      if (savedKey !== undefined) process.env.HAI_API_KEY = savedKey;
    }
  });
});
