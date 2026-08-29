const { describe, it, afterEach, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const videoClient = require('../src/services/videoClient');
const videoService = require('../src/services/videoService');
const configMod = require('../src/config');
const storageLayout = require('../src/services/storageLayout');

const silentLog = { info() {}, warn() {}, error() {} };

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE async_tasks (
      id TEXT PRIMARY KEY,
      type TEXT,
      status TEXT,
      progress INTEGER DEFAULT 0,
      message TEXT,
      error TEXT,
      result TEXT,
      resource_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      completed_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE video_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER,
      storyboard_id INTEGER,
      provider TEXT,
      prompt TEXT,
      model TEXT,
      duration INTEGER,
      aspect_ratio TEXT,
      resolution TEXT,
      status TEXT,
      task_id TEXT,
      provider_task_id TEXT,
      error_msg TEXT,
      video_url TEXT,
      local_path TEXT,
      image_url TEXT,
      first_frame_url TEXT,
      last_frame_url TEXT,
      reference_image_urls TEXT,
      generate_audio INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      completed_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE storyboards (
      id INTEGER PRIMARY KEY,
      video_url TEXT,
      local_path TEXT,
      duration INTEGER,
      updated_at TEXT
    );
  `);
  return db;
}

function insertVideoGen(db, overrides = {}) {
  const now = new Date().toISOString();
  const row = {
    drama_id: 1,
    storyboard_id: 10,
    provider: 'xai',
    prompt: 'a lantern alley',
    model: 'grok-imagine-video-1.5',
    duration: 6,
    aspect_ratio: '9:16',
    resolution: '720p',
    status: 'processing',
    task_id: 'task-1',
    image_url: null,
    first_frame_url: null,
    last_frame_url: null,
    reference_image_urls: null,
    ...overrides,
  };
  db.prepare(
    `INSERT INTO async_tasks (id, type, status, progress, message, resource_id, created_at, updated_at)
     VALUES (?, 'video_generation', 'processing', 0, '', '1', ?, ?)`
  ).run(row.task_id, now, now);
  db.prepare(
    `INSERT INTO video_generations
      (drama_id, storyboard_id, provider, prompt, model, duration, aspect_ratio, resolution, status, task_id,
       image_url, first_frame_url, last_frame_url, reference_image_urls, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.drama_id,
    row.storyboard_id,
    row.provider,
    row.prompt,
    row.model,
    row.duration,
    row.aspect_ratio,
    row.resolution,
    row.status,
    row.task_id,
    row.image_url,
    row.first_frame_url,
    row.last_frame_url,
    row.reference_image_urls,
    now,
    now
  );
  return db.prepare('SELECT last_insert_rowid() as id').get().id;
}

const xaiConfig = {
  provider: 'xai',
  api_protocol: 'xai',
  base_url: 'https://api.x.ai',
  api_key: 'sk-test-not-real',
  endpoint: '/v1/videos/generations',
};

describe('xAI videoService Phase 2', () => {
  let tmpDir;
  let origLoadConfig;
  let origGetConfig;
  let origCall;
  let origPoll;
  let origSubdir;
  let origFetch;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xai-vg-'));
    origLoadConfig = configMod.loadConfig;
    origGetConfig = videoClient.getDefaultVideoConfig;
    origCall = videoClient.callVideoApi;
    origPoll = videoClient.pollVideoTask;
    origSubdir = storageLayout.getProjectStorageSubdir;
    origFetch = global.fetch;
    configMod.loadConfig = () => ({
      app: { name: 'test' },
      storage: { local_path: tmpDir, base_url: 'http://127.0.0.1' },
      video: { generation_timeout_minutes: 1 },
    });
    videoClient.getDefaultVideoConfig = () => xaiConfig;
    storageLayout.getProjectStorageSubdir = () => null;
  });

  afterEach(async () => {
    await new Promise((r) => setImmediate(r));
    configMod.loadConfig = origLoadConfig;
    videoClient.getDefaultVideoConfig = origGetConfig;
    videoClient.callVideoApi = origCall;
    videoClient.pollVideoTask = origPoll;
    storageLayout.getProjectStorageSubdir = origSubdir;
    global.fetch = origFetch;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it('keeps first_frame for xAI I2V even when the same frame is also listed as a ref', async () => {
    const db = createTestDb();
    const captured = [];
    videoClient.callVideoApi = async (_db, _log, opts) => {
      captured.push(opts);
      return { request_id: 'req-i2v-1', task_id: 'req-i2v-1', status: 'submitted' };
    };
    videoClient.pollVideoTask = async () => ({
      error: 'xAI video request expired',
    });
    const id = insertVideoGen(db, {
      first_frame_url: 'https://cdn.example.com/first.jpg',
      image_url: 'https://cdn.example.com/first.jpg',
      reference_image_urls: JSON.stringify(['https://cdn.example.com/first.jpg']),
    });
    await videoService.processVideoGeneration(db, silentLog, id);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].first_frame_url, 'https://cdn.example.com/first.jpg');
    assert.equal(captured[0].image_url, 'https://cdn.example.com/first.jpg');
    const row = db.prepare('SELECT provider_task_id FROM video_generations WHERE id = ?').get(id);
    assert.equal(row.provider_task_id, 'req-i2v-1');
  });

  it('R2V keeps reference_urls and does not invent an image', async () => {
    const db = createTestDb();
    const captured = [];
    videoClient.callVideoApi = async (_db, _log, opts) => {
      captured.push(opts);
      return { request_id: 'req-r2v-1', task_id: 'req-r2v-1' };
    };
    videoClient.pollVideoTask = async () => ({ error: 'xAI video request expired' });
    const id = insertVideoGen(db, {
      reference_image_urls: JSON.stringify([
        'https://cdn.example.com/a.jpg',
        'https://cdn.example.com/b.jpg',
      ]),
    });
    await videoService.processVideoGeneration(db, silentLog, id);
    assert.equal(captured[0].first_frame_url, null);
    assert.equal(captured[0].image_url, null);
    assert.deepEqual(captured[0].reference_urls, [
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
  });

  it('saves official request_id into provider_task_id even if task_id differs', async () => {
    const db = createTestDb();
    videoClient.callVideoApi = async () => ({
      request_id: 'official-request-id',
      task_id: 'legacy-task-id',
    });
    videoClient.pollVideoTask = async () => ({ error: 'xAI video request expired' });
    const id = insertVideoGen(db);
    await videoService.processVideoGeneration(db, silentLog, id);
    const row = db.prepare('SELECT provider_task_id, status, error_msg FROM video_generations WHERE id = ?').get(id);
    assert.equal(row.provider_task_id, 'official-request-id');
    assert.equal(row.status, 'failed');
    assert.match(String(row.error_msg), /expired/);
  });

  it('downloads on done and writes local_path', async () => {
    const db = createTestDb();
    videoClient.callVideoApi = async () => ({ request_id: 'req-done-1', task_id: 'req-done-1' });
    videoClient.pollVideoTask = async () => ({
      video_url: 'https://vidgen.x.ai/clip.mp4',
    });
    global.fetch = async (url) => {
      assert.match(String(url), /vidgen\.x\.ai/);
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from('fake-mp4'),
      };
    };
    const id = insertVideoGen(db);
    await videoService.processVideoGeneration(db, silentLog, id);
    const row = db.prepare('SELECT status, local_path, video_url, error_msg FROM video_generations WHERE id = ?').get(id);
    assert.equal(row.status, 'completed');
    assert.ok(row.local_path && row.local_path.includes('videos/'));
    assert.equal(row.video_url, 'https://vidgen.x.ai/clip.mp4');
    const abs = path.join(tmpDir, row.local_path);
    assert.equal(fs.existsSync(abs), true);
  });

  it('marks respect_moderation false as failure', async () => {
    const db = createTestDb();
    videoClient.callVideoApi = async () => ({ request_id: 'req-mod-1', task_id: 'req-mod-1' });
    videoClient.pollVideoTask = async () => ({
      error: 'xAI video blocked by moderation',
    });
    const id = insertVideoGen(db);
    await videoService.processVideoGeneration(db, silentLog, id);
    const row = db.prepare('SELECT status, error_msg, local_path FROM video_generations WHERE id = ?').get(id);
    assert.equal(row.status, 'failed');
    assert.match(String(row.error_msg), /moderation/);
    assert.equal(row.local_path, null);
  });

  it('fails xAI jobs when the temporary URL cannot be downloaded', async () => {
    const db = createTestDb();
    videoClient.callVideoApi = async () => ({ request_id: 'req-dl-fail', task_id: 'req-dl-fail' });
    videoClient.pollVideoTask = async () => ({
      video_url: 'https://vidgen.x.ai/gone.mp4',
    });
    global.fetch = async () => ({
      ok: false,
      status: 403,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const id = insertVideoGen(db);
    await videoService.processVideoGeneration(db, silentLog, id);
    const row = db.prepare('SELECT status, local_path, error_msg FROM video_generations WHERE id = ?').get(id);
    assert.equal(row.status, 'failed');
    assert.match(String(row.error_msg), /temporary|download/i);
    assert.equal(row.local_path, null);
  });

  it('forwards generate_audio to the adapter', async () => {
    const db = createTestDb();
    const captured = [];
    videoClient.callVideoApi = async (_db, _log, opts) => {
      captured.push(opts);
      return { request_id: 'req-audio-1', task_id: 'req-audio-1' };
    };
    videoClient.pollVideoTask = async () => ({ error: 'xAI video request expired' });
    const id = insertVideoGen(db);
    db.prepare('UPDATE video_generations SET generate_audio = 1 WHERE id = ?').run(id);
    await videoService.processVideoGeneration(db, silentLog, id);
    assert.equal(captured[0].generate_audio, 1);
  });

  it('keeps history: a second insert is a new video_generations row', () => {
    const db = createTestDb();
    insertVideoGen(db, { task_id: 'task-a' });
    insertVideoGen(db, { task_id: 'task-b' });
    const count = db.prepare('SELECT COUNT(*) as n FROM video_generations').get().n;
    assert.equal(count, 2);
  });

  it('resume-poll reuses xAI request_id and does not call callVideoApi', async () => {
    const db = createTestDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO async_tasks (id, type, status, progress, message, error, resource_id, created_at, updated_at, completed_at)
       VALUES ('task-uuid-xai', 'video_generation', 'failed', 0, '', 'expired', '1', ?, ?, ?)`
    ).run(now, now, now);
    db.prepare(
      `INSERT INTO video_generations
        (drama_id, storyboard_id, provider, prompt, model, status, task_id, provider_task_id, error_msg, created_at, updated_at)
       VALUES (1, 10, 'xai', 'p', 'grok-imagine-video-1.5', 'failed', 'task-uuid-xai', '6a91bd59-req', 'xAI video request expired', ?, ?)`
    ).run(now, now);
    let calledSubmit = false;
    let polledId = null;
    videoClient.callVideoApi = async () => {
      calledSubmit = true;
      return { request_id: 'should-not-submit' };
    };
    videoClient.pollVideoTask = async (_db, _log, _videoGenId, providerTaskId) => {
      polledId = providerTaskId;
      return { error: 'xAI video request expired' };
    };
    const result = videoService.resumeFailedVideoPoll(db, silentLog, 1);
    assert.equal(result.ok, true);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(calledSubmit, false);
    assert.equal(polledId, '6a91bd59-req');
  });
});
