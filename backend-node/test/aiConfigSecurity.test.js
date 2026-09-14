const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const aiConfigService = require('../src/services/aiConfigService');

const log = { info() {}, warn() {}, error() {} };

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
      priority INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      settings TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
  `);
  db.prepare(`
    INSERT INTO ai_service_configs
      (service_type, provider, name, base_url, api_key, model, priority, is_default, is_active, settings, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 10, 1, 1, ?, ?, ?)
  `).run(
    'video',
    'model_ark',
    'secure config',
    'https://example.com',
    'sk-live-secret',
    JSON.stringify(['model-a']),
    JSON.stringify({ access_key_id: 'AK123', secret_access_key: 'SK456', kling_secret_key: 'KSK789', kling_secret_key_base64: true, project_name: 'demo' }),
    new Date().toISOString(),
    new Date().toISOString()
  );
  return db;
}

test('public AI config never exposes API keys or secret settings', () => {
  const db = createDb();
  const config = aiConfigService.getConfig(db, 1);
  const publicConfig = aiConfigService.toPublicConfig(config);

  assert.equal(publicConfig.api_key, '');
  assert.equal(publicConfig.has_api_key, true);
  assert.equal(publicConfig.secret_status.secret_access_key, true);
  assert.equal(publicConfig.secret_status.kling_secret_key, true);
  assert.equal(publicConfig.settings.includes('secret_access_key'), false);
  assert.equal(publicConfig.settings.includes('SK456'), false);
  assert.equal(publicConfig.settings.includes('project_name'), true);
  assert.equal(JSON.parse(publicConfig.settings).kling_secret_key_base64, true);
});

test('blank secret fields on update preserve the stored credentials', () => {
  const db = createDb();
  aiConfigService.updateConfig(db, log, 1, {
    api_key: '',
    settings: JSON.stringify({
      access_key_id: 'AK123',
      secret_access_key: '',
      kling_secret_key: '',
      project_name: 'updated',
    }),
  });

  const saved = aiConfigService.getConfig(db, 1);
  const settings = JSON.parse(saved.settings);
  assert.equal(saved.api_key, 'sk-live-secret');
  assert.equal(settings.secret_access_key, 'SK456');
  assert.equal(settings.kling_secret_key, 'KSK789');
  assert.equal(settings.project_name, 'updated');
});
