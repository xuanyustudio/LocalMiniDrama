const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const logger = require('../src/logger');
const aiConfigService = require('../src/services/aiConfigService');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE ai_service_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_type TEXT,
      provider TEXT,
      api_protocol TEXT,
      name TEXT,
      base_url TEXT,
      api_key TEXT,
      model TEXT,
      default_model TEXT,
      endpoint TEXT,
      query_endpoint TEXT,
      priority INTEGER,
      is_default INTEGER,
      is_active INTEGER,
      settings TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
  `);
  return db;
}

const silentLog = { info() {}, warn() {}, error() {} };

describe('xAI key isolation', () => {
  it('redacts api_key and Bearer tokens from logger objects', () => {
    const redacted = logger.redactDeep({
      api_key: 'sk-super-secret-value',
      Authorization: 'Bearer sk-super-secret-value',
      nested: { XAI_API_KEY: 'xai-abcdefghijklmnop' },
      note: 'Authorization: Bearer sk-super-secret-value',
    });
    const json = JSON.stringify(redacted);
    assert.equal(json.includes('sk-super-secret-value'), false);
    assert.equal(redacted.api_key, '[redacted]');
    assert.equal(redacted.Authorization, '[redacted]');
    assert.equal(redacted.nested.XAI_API_KEY, '[redacted]');
    assert.match(redacted.note, /\[redacted\]/);
  });

  it('createConfig stores empty api_key for xAI and ignores submitted key', () => {
    const db = createDb();
    const row = aiConfigService.createConfig(db, silentLog, {
      service_type: 'video',
      name: 'xAI',
      provider: 'xai',
      api_protocol: 'xai',
      base_url: 'https://api.x.ai',
      api_key: 'sk-from-frontend-must-drop',
      model: ['grok-imagine-video-1.5'],
    });
    assert.equal(row.api_key, '');
    const raw = db.prepare('SELECT api_key FROM ai_service_configs WHERE id = ?').get(row.id);
    assert.equal(raw.api_key, '');
  });

  it('other providers still persist api_key', () => {
    const db = createDb();
    const row = aiConfigService.createConfig(db, silentLog, {
      service_type: 'video',
      name: 'Agnes',
      provider: 'agnes',
      api_protocol: 'agnes',
      base_url: 'https://example.com',
      api_key: 'agnes-key-keep',
      model: ['agnes-video-v2.0'],
    });
    assert.equal(row.api_key, 'agnes-key-keep');
  });

  it('testConnection for xAI requires env and does not use SQLite key', async () => {
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    await assert.rejects(
      () =>
        aiConfigService.testConnection({
          provider: 'xai',
          api_protocol: 'xai',
          base_url: 'https://api.x.ai',
          api_key: 'sk-from-form',
        }),
      /XAI_API_KEY is not set/
    );
    process.env.XAI_API_KEY = 'env-only';
    await aiConfigService.testConnection({
      provider: 'xai',
      api_protocol: 'xai',
      base_url: 'https://api.x.ai',
      api_key: 'sk-from-form',
    });
    if (prev == null) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = prev;
  });

  it('loads XAI_API_KEY from .env text without logging it', () => {
    const { parseXaiApiKeyFromEnvText, applyXaiApiKeyFromFile } = require('../src/config/loadXaiEnv');
    assert.equal(parseXaiApiKeyFromEnvText('XAI_API_KEY=xai-file-key-1\n'), 'xai-file-key-1');
    assert.equal(parseXaiApiKeyFromEnvText('XAI_API_KEY="quoted-key"\n'), 'quoted-key');
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'xai-env-'));
    const envPath = path.join(dir, '.env');
    fs.writeFileSync(envPath, 'XAI_API_KEY=from-file-only\n', 'utf8');
    const logs = [];
    applyXaiApiKeyFromFile(envPath, { info: (m, meta) => logs.push(JSON.stringify({ m, meta })) });
    assert.equal(process.env.XAI_API_KEY, 'from-file-only');
    assert.equal(logs.join('').includes('from-file-only'), false);
    fs.rmSync(dir, { recursive: true, force: true });
    if (prev == null) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = prev;
  });

  it('drama export package code does not read AI keys', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/services/dramaExportService.js'), 'utf8');
    assert.equal(/ai_service_configs/.test(src), false);
    assert.equal(/XAI_API_KEY/.test(src), false);
    assert.equal(/api_key/.test(src), false);
  });
});
