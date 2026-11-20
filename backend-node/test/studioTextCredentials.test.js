const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const https = require('node:https');
const aiClient = require('../src/services/aiClient');
const aiConfigs = require('../src/services/aiConfigService');
const { STUDIO_TEXT_KEY_REF, resolveStudioTextKey } = require('../src/services/studioTextCredentials');

const config = {
  id: 1, service_type: 'text', is_active: true, is_default: true, provider: 'openai',
  base_url: 'https://open.bigmodel.cn/api/paas/v4', endpoint: '/chat/completions',
  api_key: STUDIO_TEXT_KEY_REF, model: ['glm-4.7-flash'], default_model: 'glm-4.7-flash',
};
const logger = { info() {}, warn() {}, error() {} };

test('environment credential is restricted to the official host and free model', () => {
  const oldRead = fs.readFileSync;
  try {
    fs.readFileSync = () => 'STUDIO_TEXT_API_KEY=fake-test-secret\n';
    assert.equal(resolveStudioTextKey(config, 'glm-4.7-flash', config.base_url), 'fake-test-secret');
    fs.readFileSync = () => 'STUDIO_TEXT_API_KEY=replaced-test-secret\n';
    assert.equal(resolveStudioTextKey(config, 'glm-4.7-flash', config.base_url), 'replaced-test-secret');
    assert.throws(() => resolveStudioTextKey(config, 'glm-4.7-flash', 'https://open.bigmodel.cn.evil.test'), /官方 HTTPS/);
    assert.throws(() => resolveStudioTextKey(config, 'glm-4.7-flash', 'http://open.bigmodel.cn'), /官方 HTTPS/);
    assert.throws(() => resolveStudioTextKey(config, 'glm-4.7', config.base_url), /免费模型/);
    fs.readFileSync = () => '';
    assert.throws(() => resolveStudioTextKey(config, 'glm-4.7-flash', config.base_url), /backend-node\/\.env/);
    assert.equal(resolveStudioTextKey({ api_key: 'ollama' }, 'qwen', 'http://127.0.0.1:11434'), 'ollama');
  } finally {
    fs.readFileSync = oldRead;
  }
});

test('text generation resolves the key only for the outgoing request and disables thinking', async () => {
  const oldRead = fs.readFileSync;
  const oldRequest = https.request;
  const oldList = aiConfigs.listConfigs;
  const requests = [];
  try {
    fs.readFileSync = () => 'STUDIO_TEXT_API_KEY=fake-test-secret\n';
    aiConfigs.listConfigs = () => [config];
    https.request = (options, callback) => {
      const req = new EventEmitter();
      req.write = (data) => { requests.push({ headers: options.headers, body: JSON.parse(data) }); };
      req.end = () => {
        const response = new PassThrough();
        response.statusCode = 200;
        queueMicrotask(() => { callback(response); response.end('data: {"choices":[{"delta":{"content":"剧本"}}]}\n\ndata: [DONE]\n\n'); });
      };
      req.destroy = () => {};
      return req;
    };
    assert.equal(await aiClient.generateText(null, logger, 'text', '测试', null), '剧本');
    let streamed = '';
    assert.equal(await aiClient.streamGenerateText(null, logger, 'text', '测试', null, {}, (delta) => { streamed += delta; }), '剧本');
    assert.equal(streamed, '剧本');
    assert.equal(requests.length, 2);
    for (const r of requests) {
      assert.equal(r.headers.Authorization, 'Bearer fake-test-secret');
      assert.deepEqual(r.body.thinking, { type: 'disabled' });
    }
    assert.equal(config.api_key, STUDIO_TEXT_KEY_REF);
    https.request = (_options, callback) => {
      const req = new EventEmitter();
      req.write = () => {};
      req.end = () => {
        const response = new PassThrough();
        response.statusCode = 401;
        queueMicrotask(() => { callback(response); response.end('rejected fake-test-secret'); });
      };
      req.destroy = () => {};
      return req;
    };
    await assert.rejects(aiClient.generateText(null, logger, 'text', '测试', null), (error) => !error.message.includes('fake-test-secret'));
  } finally {
    https.request = oldRequest;
    aiConfigs.listConfigs = oldList;
    fs.readFileSync = oldRead;
  }
});

test('database and API configuration hold the reference rather than the secret', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  try {
    db.exec(`CREATE TABLE ai_service_configs (
      id INTEGER PRIMARY KEY, service_type TEXT, provider TEXT, api_protocol TEXT,
      name TEXT, base_url TEXT, api_key TEXT, model TEXT, default_model TEXT,
      endpoint TEXT, query_endpoint TEXT, priority INTEGER, is_default INTEGER,
      is_active INTEGER, settings TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT
    )`);
    const saved = aiConfigs.createConfig(db, logger, { ...config, name: '本地安全配置' });
    assert.equal(saved.api_key, STUDIO_TEXT_KEY_REF);
    assert.equal(db.prepare('SELECT api_key FROM ai_service_configs').get().api_key, STUDIO_TEXT_KEY_REF);
    assert.equal(aiConfigs.listConfigs(db, 'text')[0].api_key, STUDIO_TEXT_KEY_REF);
  } finally { db.close(); }
});

test('connection test uses the reference without exposing provider errors containing the key', async () => {
  const oldRead = fs.readFileSync;
  const oldFetch = global.fetch;
  try {
    fs.readFileSync = () => 'STUDIO_TEXT_API_KEY=fake-test-secret\n';
    let captured;
    global.fetch = async (url, options) => {
      captured = { url, headers: options.headers, body: JSON.parse(options.body), redirect: options.redirect };
      return { ok: true, json: async () => ({ choices: [] }) };
    };
    await aiConfigs.testConnection(config);
    assert.equal(captured.headers.Authorization, 'Bearer fake-test-secret');
    assert.deepEqual(captured.body.thinking, { type: 'disabled' });
    assert.equal(captured.redirect, 'error');
    global.fetch = async () => ({ ok: false, status: 401, text: async () => '{"error":{"message":"fake-test-secret"}}' });
    await assert.rejects(aiConfigs.testConnection(config), (error) => !error.message.includes('fake-test-secret'));
    await assert.rejects(aiConfigs.testConnection({ ...config, base_url: 'https://evil.test' }), /官方 HTTPS/);
  } finally {
    global.fetch = oldFetch;
    fs.readFileSync = oldRead;
  }
});
