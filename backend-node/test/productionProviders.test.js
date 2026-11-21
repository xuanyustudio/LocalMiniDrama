const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const Database = require('better-sqlite3');
const sharp = require('sharp');
const configService = require('../src/services/aiConfigService');
const production = require('../src/services/productionProviders');
const { offerApproval, confirmApproval, approvalContext, requireApproval } = require('../src/services/productionApproval');
const videoClient = require('../src/services/videoClient');
const imageClient = require('../src/services/imageClient');
const ttsService = require('../src/services/ttsService');
const aiClient = require('../src/services/aiClient');

const log = { info() {}, warn() {}, error() {} };

function approved(scope, generate) {
  const receipt = confirmApproval(offerApproval(new Set([scope]), 1));
  return approvalContext({ method: 'POST', get: () => receipt }, null, generate);
}

test('approval comes from server confirmation and lasts only for its declared requests', async () => {
  const offer = offerApproval(new Set(['text']), 1);
  const authorize = token => approvalContext({ method: 'POST', get: () => token }, null, async () => {
    await new Promise(setImmediate);
    requireApproval('text');
  });
  await assert.rejects(() => authorize(offer), { code: 'PRODUCTION_APPROVAL_REQUIRED' });
  const receipt = confirmApproval(offer);
  assert.equal(confirmApproval(offer), null);
  await authorize(receipt);
  await assert.rejects(() => authorize(receipt), { code: 'PRODUCTION_APPROVAL_REQUIRED' });
});

function mockBailianKey(t) {
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) =>
    String(file).endsWith(path.sep + '.env') ? 'DASHSCOPE_API_KEY=bailian-test-key\n' : read(file, ...args));
  return type => {
    const p = production.BAILIAN_PROFILES[type];
    return { ...p, default_model: p.model, model: p.models || [p.model],
      api_key: production.BAILIAN_REF, is_active: true, is_default: true };
  };
}

test('activates only stages with keys, keeping only references in database and status', (t) => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(fs.readFileSync(path.join(__dirname, '../migrations/01_init.sql'), 'utf8'));
  db.exec("ALTER TABLE ai_service_configs ADD COLUMN api_protocol TEXT DEFAULT ''");
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) =>
    String(file).endsWith(path.sep + '.env') ? 'BYTEPLUS_ARK_API_KEY=local-test-secret\n' : read(file, ...args));
  assert.throws(() => production.activateProfiles(db, log, { text: true, tts: true }), /MINIMAX_API_KEY/);
  assert.equal(configService.listConfigs(db, 'text').length, 0);
  const status = production.activateProfiles(db, log, { text: true, image: true, video: true });
  assert.equal(status.byteplus_key, true);
  assert.equal(status.active.tts, false);
  assert.equal(status.active.storyboard_image, true);
  assert.deepEqual(status.video_duration_limits, { minSeconds: 4, maxSeconds: 15, defaultSeconds: 5 });
  assert.doesNotMatch(JSON.stringify(status), /local-test-secret/);
  assert.equal(configService.listConfigs(db).length, 4);
  assert.ok(configService.listConfigs(db).every(c => c.api_key === production.BYTEPLUS_REF));
  production.activateProfiles(db, log, { text: true, image: true, video: true });
  assert.equal(configService.listConfigs(db).length, 4);
});

test('official Seedance requests use documented fields and poll through the same endpoint', async (t) => {
  const profile = production.PROFILES.video;
  const config = { ...profile, is_active: true, is_default: true, model: [profile.model], api_key: production.BYTEPLUS_REF };
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) =>
    String(file).endsWith(path.sep + '.env') ? 'BYTEPLUS_ARK_API_KEY=local-test-secret\n' : read(file, ...args));
  t.mock.method(configService, 'listConfigs', () => [config]);
  const requests = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    requests.push({ url, options });
    const body = options.method === 'POST' ? { id: 'cgt-test', status: 'queued' } :
      { id: 'cgt-test', status: 'succeeded', content: { video_url: 'https://example.test/shot.mp4' } };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  assert.throws(() => production.resolveKey(config, 'https://example.test/v1'), /官方接口/);
  const source = 'https://example.test/image.png';
  const generate = () => videoClient.callVideoApi(null, log, {
    prompt: '纸条随风翻动', aspect_ratio: '9:16', duration: 6, resolution: '480p', first_frame_url: source,
  });
  await assert.rejects(generate, { code: 'PRODUCTION_APPROVAL_REQUIRED' });
  await assert.rejects(() => approved('image', generate), { code: 'PRODUCTION_APPROVAL_REQUIRED' });
  await assert.rejects(() => approved('video', () => videoClient.callVideoApi(null, log, {
    prompt: '纸条随风翻动', duration: 3, first_frame_url: source,
  })), /Seedance 2.0 Fast 每段支持 4–15 秒/);
  assert.equal(requests.length, 0);
  const submitted = await approved('video', generate);
  assert.equal(submitted.task_id, 'cgt-test');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.model, profile.model);
  assert.equal(body.ratio, '9:16');
  assert.equal(body.resolution, '720p');
  assert.equal(body.generate_audio, false);
  assert.equal(body.task_type, undefined);
  assert.equal(body.content[1].role, 'first_frame');
  assert.equal(body.content[1].image_url.url, source);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer local-test-secret');
  const result = await videoClient.pollVideoTask(null, log, 0, submitted.task_id, config, 1, 0);
  assert.equal(result.video_url, 'https://example.test/shot.mp4');
  assert.equal(requests[1].url, production.ARK + '/contents/generations/tasks/cgt-test');
  assert.equal(requests[1].options.redirect, 'error');
});

test('Seedream sends the shot reference and downloads a single-image result through the existing client', async (t) => {
  const p = production.PROFILES.image;
  const config = { ...p, is_active: true, is_default: true, model: [p.model], api_key: production.BYTEPLUS_REF };
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) =>
    String(file).endsWith(path.sep + '.env') ? 'BYTEPLUS_ARK_API_KEY=local-test-secret\n' : read(file, ...args));
  t.mock.method(configService, 'listConfigs', () => [config]);
  let body;
  t.mock.method(https, 'request', (address, onResponse) => {
    assert.equal(address.hostname, 'ark.ap-southeast.bytepluses.com');
    assert.equal(address.path, '/api/v3/images/generations');
    assert.equal(address.headers.Authorization, 'Bearer local-test-secret');
    const req = new EventEmitter();
    req.write = data => { body = JSON.parse(data); };
    req.end = () => {
      const response = new PassThrough();
      response.statusCode = 200;
      onResponse(response);
      response.end(JSON.stringify({ data: [{ url: 'https://example.test/frame.jpg' }] }));
    };
    return req;
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-seedream-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const reference = 'data:image/png;base64,iVBORw0KGgo=';
  fs.writeFileSync(path.join(root, 'frame.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  const answer = await approved('image', () => imageClient.callImageApi(null, log, {
    prompt: '一张电影分镜图', size: '1080x1920', reference_image_urls: ['http://127.0.0.1:5679/static/frame.png'],
    storage_local_path: root,
  }));
  assert.equal(answer.image_url, 'https://example.test/frame.jpg');
  assert.equal(body.model, p.model);
  assert.deepEqual(body.image, [reference]);
  assert.equal(body.sequential_image_generation, 'disabled');
  assert.throws(() => production.resolveReference('../outside.png', __dirname), /素材目录/);
});

test('Kling keeps its own subject reference payload', async t => {
  t.mock.method(configService, 'listConfigs', () => [{
    provider: 'kling', base_url: 'https://api.klingai.com', api_key: 'test',
    model: ['kling-image'], is_active: true, is_default: true,
  }]);
  let body;
  t.mock.method(https, 'request', (_address, onResponse) => {
    const req = new EventEmitter();
    req.write = data => { body = JSON.parse(data); };
    req.end = () => {
      const res = new PassThrough();
      res.statusCode = 200;
      onResponse(res);
      res.end(JSON.stringify({ data: { task_result: { images: [{ url: 'https://example.test/result.png' }] } } }));
    };
    return req;
  });
  const url = 'https://example.test/reference.png';
  const result = await imageClient.callImageApi(null, log, { prompt: '保留人物造型', reference_image_urls: [url] });
  assert.deepEqual(body.image_reference, [{ type: 'subject', url }]);
  assert.equal(result.image_url, 'https://example.test/result.png');
});

test('MiniMax uses the assigned voice and stores dialogue audio locally', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-voice-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const p = production.PROFILES.tts;
  const config = { ...p, default_model: p.model, api_key: production.MINIMAX_REF };
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) =>
    String(file).endsWith(path.sep + '.env') ? 'MINIMAX_API_KEY=local-test-secret\n' : read(file, ...args));
  const audio = Buffer.from([0xff, 0xfb, 0x90, 0x44]);
  const request = t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, p.base_url + p.endpoint);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer local-test-secret');
    const body = JSON.parse(options.body);
    assert.equal(body.model, p.model);
    assert.equal(body.voice_setting.voice_id, 'Chinese (Mandarin)_IntellectualGirl');
    assert.equal(body.text, '把信给我。\n现在就走。');
    return Response.json({ base_resp: { status_code: 0 }, data: { audio: audio.toString('hex') } });
  });
  const { local_path: localPath } = await approved('tts', () => ttsService.synthesize(null, log, {
    config, storage_base: root, storyboard_id: 42, tts_kind: 'dialogue',
    text: '陆禾（轻声）：把信给我。\n陆禾：现在就走。',
    speaker_voices: { 陆禾: 'Chinese (Mandarin)_IntellectualGirl' },
  }));
  const saved = path.join(root, localPath);
  assert.equal(request.mock.callCount(), 1);
  assert.match(localPath, /^audio\/tts_sb42_\w+\.mp3$/);
  assert.deepEqual(read(saved), audio);
});

test('Bailian activates all production stages and keeps the model key private', t => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(fs.readFileSync(path.join(__dirname, '../migrations/01_init.sql'), 'utf8'));
  db.exec("ALTER TABLE ai_service_configs ADD COLUMN api_protocol TEXT DEFAULT ''");
  const bailianConfig = mockBailianKey(t);
  const selection = { provider: 'bailian', text: true, image: true, video: true, tts: true };
  const status = production.activateProfiles(db, log, selection);
  assert.equal(status.bailian_key, true);
  assert.deepEqual(Object.values(status.bailian_active), [true, true, true, true, true]);
  assert.deepEqual(status.video_duration_limits, { minSeconds: 2, maxSeconds: 15, defaultSeconds: 10 });
  assert.ok(Object.values(status.active).every(active => !active));
  assert.doesNotMatch(JSON.stringify(status), /bailian-test-key/);
  assert.deepEqual(configService.listConfigs(db, 'text')[0].model, ['qwen3.7-plus', 'qwen3.7-flash']);
  assert.ok(configService.listConfigs(db).every(config => config.api_key === production.BAILIAN_REF));
  production.activateProfiles(db, log, selection);
  assert.equal(configService.listConfigs(db).length, 5);
  assert.throws(() => production.resolveKey(bailianConfig('video'), 'https://dashscope.aliyuncs.com/api/v1/tasks/test'), /官方接口/);
});

test('Bailian Qwen uses the regional endpoint, structured output and the local credential', async t => {
  const config = mockBailianKey(t)('text');
  t.mock.method(configService, 'listConfigs', () => [config]);
  t.mock.method(https, 'request', (address, onResponse) => {
    assert.equal(address.hostname, 'dashscope-intl.aliyuncs.com');
    assert.equal(address.path, '/compatible-mode/v1/chat/completions');
    assert.equal(address.headers.Authorization, 'Bearer bailian-test-key');
    const req = new EventEmitter();
    req.destroy = () => {};
    req.write = raw => {
      const body = JSON.parse(raw);
      assert.equal(body.model, 'qwen3.7-plus');
      assert.equal(body.enable_thinking, false);
      assert.deepEqual(body.response_format, { type: 'json_object' });
    };
    req.end = () => {
      const res = new PassThrough();
      res.statusCode = 200;
      onResponse(res);
      res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: '{"shots":[]}' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
    };
    return req;
  });
  assert.equal(await approved('text', () => aiClient.generateText(null, log, 'text', '返回 JSON', '', { json_mode: true })), '{"shots":[]}');
});

test('Bailian sends local first frames, requests silent 720p and fetches video results', async t => {
  const bailianConfig = mockBailianKey(t);
  const image = bailianConfig('image');
  const video = bailianConfig('video');
  t.mock.method(configService, 'listConfigs', (_db, type) => type === 'video' ? [video] : [image]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-bailian-test-'));
  const filename = path.join(tmp, 'frame.png');
  const png = await sharp({ create: { width: 240, height: 240, channels: 3, background: '#445566' } }).png().toBuffer();
  fs.writeFileSync(filename, png);
  t.after(() => { fs.unlinkSync(filename); fs.rmdirSync(tmp); });
  const frame = `data:image/png;base64,${png.toString('base64')}`;
  const requests = t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer bailian-test-key');
    assert.equal(options.redirect, 'error');
    if (url === image.base_url + image.endpoint) {
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'wan2.7-image');
      assert.deepEqual(body.input.messages[0].content[0], { image: frame });
      const [w, h] = body.parameters.size.split('*').map(Number);
      assert.ok(w < h);
      return Response.json({ output: { choices: [{ message: { content: [{ image: 'https://example.test/frame.png' }] } }] } });
    }
    if (url === video.base_url + video.endpoint) {
      assert.equal(options.headers['X-DashScope-Async'], 'enable');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'wan2.6-i2v-flash');
      assert.equal(body.input.img_url, frame);
      assert.deepEqual(body.parameters, {
        resolution: '720P', duration: 8, audio: false, shot_type: 'single', prompt_extend: true, watermark: false,
      });
      return Response.json({ output: { task_id: 'wan-1', task_status: 'PENDING' } });
    }
    assert.equal(url, video.base_url + '/api/v1/tasks/wan-1');
    return Response.json({ output: { task_id: 'wan-1', task_status: 'SUCCEEDED', video_url: 'https://example.test/shot.mp4' } });
  });
  const source = 'http://127.0.0.1:5679/static/frame.png';
  assert.equal((await approved('image', () => imageClient.callImageApi(null, log, {
    prompt: '保留角色造型', size: '1080x1920', reference_image_urls: [source], storage_local_path: tmp,
  }))).image_url, 'https://example.test/frame.png');
  const result = await approved('video', () => videoClient.callVideoApi(null, log, {
    duration: 8, first_frame_url: source, storage_local_path: tmp, prompt: '向右转身',
  }));
  assert.equal(result.task_id, 'wan-1');
  assert.equal((await videoClient.pollVideoTask(null, log, 0, result.task_id, video, 1, 0)).video_url, 'https://example.test/shot.mp4');
  assert.equal(requests.mock.callCount(), 3);
});

test('queued Bailian video retains the explicit first frame when the request includes references', async t => {
  const config = mockBailianKey(t)('video');
  t.mock.method(configService, 'listConfigs', () => [config]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-video-queue-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const filename = path.join(tmp, '分镜首帧.png');
  const png = await sharp({ create: { width: 240, height: 320, channels: 4, background: '#44668888' } }).png().toBuffer();
  fs.writeFileSync(filename, png);
  t.mock.method(require('../src/config'), 'loadConfig', () => ({ storage: { local_path: tmp } }));
  t.mock.method(videoClient, 'pollVideoTask', async () => ({ error: 'fixture stopped after submission' }));
  const request = t.mock.method(global, 'fetch', async () => Response.json({ output: { task_id: 'wan-queued' } }));

  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(fs.readFileSync(path.join(__dirname, '../migrations/01_init.sql'), 'utf8'));
  db.exec('ALTER TABLE video_generations ADD COLUMN provider_task_id TEXT');
  const source = 'http://127.0.0.1:5679/static/' + encodeURIComponent(path.basename(filename));
  db.prepare(`INSERT INTO video_generations (id, duration, status, image_url, first_frame_url, reference_image_urls)
    VALUES (1, 3, 'processing', ?, ?, ?)`).run(source, source, JSON.stringify([source]));
  const { processVideoGeneration } = require('../src/services/videoService');
  await approved('video', () => processVideoGeneration(db, log, 1));

  const record = db.prepare('SELECT provider_task_id, error_msg FROM video_generations WHERE id = 1').get();
  assert.equal(record.provider_task_id, 'wan-queued', record.error_msg);
  assert.equal(request.mock.callCount(), 1);
  const [url, options] = request.mock.calls[0].arguments;
  assert.equal(url, config.base_url + config.endpoint);
  const submitted = JSON.parse(options.body);
  assert.equal(submitted.parameters.duration, 3);
  assert.match(submitted.input.img_url, /^data:image\/jpeg;base64,/);
  const frame = await sharp(Buffer.from(submitted.input.img_url.split(',')[1], 'base64')).metadata();
  assert.deepEqual([frame.width, frame.height, frame.hasAlpha], [240, 320, false]);
  assert.deepEqual(fs.readFileSync(filename), png);
});

test('CosyVoice uses the role voice and saves the returned audio locally', async t => {
  const config = mockBailianKey(t)('tts');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-bailian-voice-test-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const sent = [];
  const audio = Uint8Array.from([0xff, 0xfb, 0x90, 0x44]);
  class FakeSocket extends EventTarget {
    static CLOSING = 2;
    readyState = 1;
    constructor(url, options) {
      super();
      assert.equal(url, config.base_url + config.endpoint);
      assert.equal(options.headers.Authorization, 'Bearer bailian-test-key');
      queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }
    send(raw) {
      const data = JSON.parse(raw);
      sent.push(data);
      const emit = (payload) => this.dispatchEvent(new MessageEvent('message', { data: payload }));
      const event = name => JSON.stringify({ header: { task_id: data.header.task_id, event: name } });
      if (data.header.action === 'run-task') queueMicrotask(() => emit(event('task-started')));
      if (data.header.action === 'finish-task') queueMicrotask(() => {
        emit(audio.buffer);
        emit(event('task-finished'));
      });
    }
    close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
  }
  const originalSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  Object.defineProperty(globalThis, 'WebSocket', { value: FakeSocket, writable: true, configurable: true });
  t.after(() => Object.defineProperty(globalThis, 'WebSocket', originalSocket));
  const voice = await approved('tts', () => ttsService.synthesize(null, log, {
    config, storage_base: tmp, storyboard_id: 6, tts_kind: 'dialogue',
    text: '- 陆禾（低声）：快上船。', speaker_voices: { 陆禾: 'Chinese (Mandarin)_IntellectualGirl' },
  }));
  assert.deepEqual(sent.map(data => data.header.action), ['run-task', 'continue-task', 'finish-task']);
  assert.equal(new Set(sent.map(data => data.header.task_id)).size, 1);
  assert.equal(sent[0].payload.model, 'cosyvoice-v3-flash');
  assert.equal(sent[0].payload.parameters.voice, 'longanhuan_v3');
  assert.equal(sent[1].payload.input.text, '快上船。');
  assert.deepEqual(fs.readFileSync(path.join(tmp, voice.local_path)), Buffer.from(audio));
});
