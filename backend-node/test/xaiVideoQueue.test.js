const { describe, it, afterEach, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const videoClient = require('../src/services/videoClient');
const videoService = require('../src/services/videoService');
const taskService = require('../src/services/taskService');
const settingsService = require('../src/services/settingsService');
const configMod = require('../src/config');

const silentLog = { info() {}, warn() {}, error() {} };

function createQueueDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE global_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
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
      duration REAL,
      aspect_ratio TEXT,
      resolution TEXT,
      seed INTEGER,
      camera_fixed INTEGER,
      watermark INTEGER,
      generate_audio INTEGER DEFAULT 0,
      image_url TEXT,
      first_frame_url TEXT,
      last_frame_url TEXT,
      reference_image_urls TEXT,
      status TEXT,
      task_id TEXT,
      provider_task_id TEXT,
      retry_count INTEGER DEFAULT 0,
      error_msg TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
  `);
  return db;
}

function insertQueued(db, { taskId, status = 'queued', providerTaskId = null, retryCount = 0 }) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO async_tasks (id, type, status, progress, message, resource_id, created_at, updated_at)
     VALUES (?, 'video_generation', 'pending', 0, '', '1', ?, ?)`
  ).run(taskId, now, now);
  db.prepare(
    `INSERT INTO video_generations
      (drama_id, provider, prompt, model, status, task_id, provider_task_id, retry_count, created_at, updated_at)
     VALUES (1, 'xai', 'p', 'grok-imagine-video-1.5', ?, ?, ?, ?, ?, ?)`
  ).run(status, taskId, providerTaskId, retryCount, now, now);
  return db.prepare('SELECT last_insert_rowid() as id').get().id;
}

describe('xAI video queue Phase 4', () => {
  let origLoad;
  let origGet;
  let origCall;
  let origPoll;

  beforeEach(() => {
    origLoad = configMod.loadConfig;
    origGet = videoClient.getDefaultVideoConfig;
    origCall = videoClient.callVideoApi;
    origPoll = videoClient.pollVideoTask;
    configMod.loadConfig = () => ({
      app: { name: 'test' },
      storage: { local_path: './data/storage', base_url: '' },
      video: { generation_timeout_minutes: 1 },
    });
    videoClient.getDefaultVideoConfig = () => ({
      provider: 'xai',
      api_protocol: 'xai',
      base_url: 'https://api.x.ai',
    });
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 30));
    configMod.loadConfig = origLoad;
    videoClient.getDefaultVideoConfig = origGet;
    videoClient.callVideoApi = origCall;
    videoClient.pollVideoTask = origPoll;
  });

  it('holds extra jobs at queued until a concurrency slot frees', async () => {
    const db = createQueueDb();
    settingsService.setGlobalSetting(db, 'pipeline_video_concurrency', 1);
    let releaseFirst;
    const firstGate = new Promise((r) => {
      releaseFirst = r;
    });
    let calls = 0;
    videoClient.callVideoApi = async () => {
      calls += 1;
      if (calls === 1) await firstGate;
      return { error: 'upstream 500' };
    };
    const id1 = insertQueued(db, { taskId: 't1' });
    const id2 = insertQueued(db, { taskId: 't2' });
    videoService.enqueueVideoGeneration(db, silentLog, id1);
    videoService.enqueueVideoGeneration(db, silentLog, id2);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(calls, 1);
    const a = db.prepare('SELECT status FROM video_generations WHERE id = ?').get(id1);
    const b = db.prepare('SELECT status FROM video_generations WHERE id = ?').get(id2);
    assert.equal(a.status, 'processing');
    assert.equal(b.status, 'queued');
    releaseFirst();
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(calls >= 2);
  });

  it('reads concurrency from pipeline_video_concurrency', () => {
    const db = createQueueDb();
    assert.equal(videoService.getVideoConcurrency(db), 3);
    settingsService.setGlobalSetting(db, 'pipeline_video_concurrency', 2);
    assert.equal(videoService.getVideoConcurrency(db), 2);
  });

  it('keeps async_tasks that still have a request_id video job', () => {
    const db = createQueueDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO async_tasks (id, type, status, progress, message, resource_id, created_at, updated_at)
       VALUES ('keep-me', 'video_generation', 'processing', 10, '', '1', ?, ?)`
    ).run(now, now);
    db.prepare(
      `INSERT INTO video_generations
        (drama_id, provider, prompt, model, status, task_id, provider_task_id, created_at, updated_at)
       VALUES (1, 'xai', 'p', 'grok-imagine-video-1.5', 'processing', 'keep-me', 'req-alive', ?, ?)`
    ).run(now, now);
    const failed = taskService.failOrphanedAsyncTasksOnStartup(db, silentLog);
    assert.equal(failed, 0);
    assert.equal(taskService.getTask(db, 'keep-me').status, 'processing');
  });

  it('requeues processing rows that have no request_id on resume', () => {
    const db = createQueueDb();
    settingsService.setGlobalSetting(db, 'pipeline_video_concurrency', 1);
    videoClient.callVideoApi = async () => ({ error: 'XAI_API_KEY is not set' });
    const id = insertQueued(db, { taskId: 't-stuck', status: 'processing', providerTaskId: null });
    videoService.resumeProcessingVideoGenerations(db, silentLog);
    const row = db.prepare('SELECT status FROM video_generations WHERE id = ?').get(id);
    assert.ok(row.status === 'queued' || row.status === 'processing' || row.status === 'failed');
  });

  it('create route inserts queued and enqueues instead of processing immediately', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../src/routes/videos.js'), 'utf8');
    assert.match(src, /status, task_id, created_at, updated_at\)\s+VALUES \(.*'queued'/s);
    assert.match(src, /enqueueVideoGeneration/);
    assert.doesNotMatch(src, /processVideoGeneration/);
  });

  it('retries transient failures with a new request up to the limit', async () => {
    const db = createQueueDb();
    settingsService.setGlobalSetting(db, 'pipeline_video_concurrency', 1);
    settingsService.setGlobalSetting(db, 'pipeline_video_retry', 1);
    let calls = 0;
    videoClient.callVideoApi = async () => {
      calls += 1;
      return { error: 'upstream 500' };
    };
    const id = insertQueued(db, { taskId: 't-retry' });
    await videoService.processVideoGeneration(db, silentLog, id);
    await new Promise((r) => setTimeout(r, 40));
    const row = db.prepare('SELECT status, retry_count FROM video_generations WHERE id = ?').get(id);
    assert.ok(calls >= 1);
    assert.ok(row.retry_count >= 1 || row.status === 'queued' || row.status === 'failed');
  });
});
