const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Database = require('better-sqlite3');
const videoService = require('../src/services/videoService');

const silentLog = { info() {}, warn() {}, error() {} };

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE ai_service_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_type TEXT NOT NULL,
      provider TEXT DEFAULT '',
      api_protocol TEXT DEFAULT '',
      name TEXT DEFAULT '',
      base_url TEXT DEFAULT '',
      api_key TEXT,
      model TEXT,
      default_model TEXT,
      endpoint TEXT,
      query_endpoint TEXT,
      priority INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      settings TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE video_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER,
      storyboard_id INTEGER,
      provider TEXT,
      prompt TEXT,
      model TEXT,
      duration REAL,
      aspect_ratio TEXT,
      resolution TEXT,
      seed INTEGER,
      camera_fixed INTEGER,
      watermark INTEGER,
      image_url TEXT,
      first_frame_url TEXT,
      last_frame_url TEXT,
      reference_image_urls TEXT,
      video_url TEXT,
      local_path TEXT,
      status TEXT,
      task_id TEXT,
      provider_task_id TEXT,
      scene_id INTEGER,
      completed_at TEXT,
      error_msg TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
  `);
  return db;
}

function insertDashScopeConfig(db, baseUrl, model) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO ai_service_configs
        (service_type, provider, api_protocol, name, base_url, api_key, model, default_model, endpoint, priority, is_default, is_active, created_at, updated_at)
       VALUES ('video', 'dashscope', '', 'DashScope 测试', ?, 'test-key', ?, NULL, '/api/v1/services/aigc/image2video/video-synthesis', 0, 1, 1, ?, ?)`
    )
    .run(baseUrl, JSON.stringify([model]), now, now);
  return info.lastInsertRowid;
}

function insertTraditionalVideoRow(db, model, referenceUrls) {
  const now = new Date().toISOString();
  // 传统模式前端契约（FilmCreate.vue 生成分镜视频）：
  // first_frame_url/image_url = 分镜主图（相对路径），reference_image_urls = [主图绝对 URL(, 尾帧)]
  const info = db
    .prepare(
      `INSERT INTO video_generations
        (provider, prompt, model, aspect_ratio, image_url, first_frame_url, last_frame_url, reference_image_urls, status, created_at, updated_at)
       VALUES ('dashscope', '他推开门，镜头缓慢推进', ?, '16:9', '/static/sb-main.png', '/static/sb-main.png', '/static/sb-last.png', ?, 'pending', ?, ?)`
    )
    .run(model, JSON.stringify(referenceUrls), now, now);
  return info.lastInsertRowid;
}

function startFakeDashScope() {
  const submissions = [];
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      submissions.push({ path: req.url, headers: req.headers, body: data ? JSON.parse(data) : null });
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'InvalidApiKey', message: 'dashscope fake unauthorized' }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, submissions, baseUrl: 'http://127.0.0.1:' + server.address().port }));
  });
}

describe('DashScope 传统模式首帧不被参考图列表吞掉 (#77)', () => {
  let fake;

  before(async () => {
    fake = await startFakeDashScope();
  });

  after(() => {
    fake.server.close();
  });

  it('wan2.2-kf2v-flash：参考图列表非空时仍把首帧/尾帧提交给 DashScope', async () => {
    const db = createTestDb();
    const configId = insertDashScopeConfig(db, fake.baseUrl, 'wan2.2-kf2v-flash');
    assert.ok(configId);
    const rowId = insertTraditionalVideoRow(db, 'wan2.2-kf2v-flash', [fake.baseUrl + '/static/sb-main.png']);

    await videoService.processVideoGeneration(db, silentLog, Number(rowId));

    const kfSubmissions = fake.submissions.filter((s) => s.path === '/api/v1/services/aigc/image2video/video-synthesis');
    assert.equal(kfSubmissions.length, 1, '应向 DashScope image2video 端点提交一次（旧代码在本地校验即失败，不会发请求）');
    const body = kfSubmissions[0].body;
    assert.equal(body.model, 'wan2.2-kf2v-flash');
    // 图床 base_url 取自 configs/config.yaml（toPublicUrl），这里断言分镜图确实进入了首/尾帧字段
    assert.ok(String(body.input.first_frame_url).endsWith('/static/sb-main.png'), 'first_frame_url=' + body.input.first_frame_url);
    assert.ok(String(body.input.last_frame_url).endsWith('/static/sb-last.png'), 'last_frame_url=' + body.input.last_frame_url);

    const row = db.prepare('SELECT status, error_msg FROM video_generations WHERE id = ?').get(Number(rowId));
    assert.equal(row.status, 'failed');
    assert.ok(
      String(row.error_msg || '').includes('dashscope fake unauthorized'),
      '失败应来自厂商响应而不是本地首帧校验，实际: ' + row.error_msg
    );
  });

  it('wan2.6-i2v-flash：参考图列表非空时 img_url 同样保留', async () => {
    const db = createTestDb();
    insertDashScopeConfig(db, fake.baseUrl, 'wan2.6-i2v-flash');
    const rowId = insertTraditionalVideoRow(db, 'wan2.6-i2v-flash', [fake.baseUrl + '/static/sb-main.png']);

    await videoService.processVideoGeneration(db, silentLog, Number(rowId));

    const i2vSubmissions = fake.submissions.filter((s) => s.path === '/api/v1/services/aigc/video-generation/video-synthesis');
    assert.equal(i2vSubmissions.length, 1);
    const body = i2vSubmissions[0].body;
    assert.equal(body.model, 'wan2.6-i2v-flash');
    assert.ok(String(body.input.img_url).endsWith('/static/sb-main.png'), 'img_url=' + body.input.img_url);
  });
});
