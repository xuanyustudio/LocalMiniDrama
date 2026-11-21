const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { quoteProduction } = require('../src/services/productionCostService');
const { activateProfiles } = require('../src/services/productionProviders');
const ai = require('../src/services/aiClient');

const log = { info() {}, warn() {}, error() {} };

function studio(t) {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(fs.readFileSync(path.join(__dirname, '../migrations/01_init.sql'), 'utf8'));
  db.exec(`ALTER TABLE ai_service_configs ADD COLUMN api_protocol TEXT DEFAULT '';
    ALTER TABLE storyboards ADD COLUMN polished_prompt TEXT;
    ALTER TABLE storyboards ADD COLUMN narration TEXT;
    INSERT INTO dramas (id, title) VALUES (1, '测试');
    INSERT INTO episodes (id, drama_id, episode_number, title, script_content) VALUES (1, 1, 1, '试听', '青禾走进书房。');
    INSERT INTO storyboards (id, episode_id, storyboard_number, duration, dialogue, narration, polished_prompt)
    VALUES (1, 1, 1, 8, '青禾：你好。', '回家。', 'A polished first-frame prompt.');`);
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) =>
    String(file).endsWith(path.sep + '.env') ? 'DASHSCOPE_API_KEY=fixture-only\n' : read(file, ...args));
  activateProfiles(db, log, { provider: 'bailian', text: true, image: true, video: true, tts: true });
  t.mock.method(global, 'fetch', () => assert.fail('A quote must not call a model'));
  return db;
}

test('quotes a mixed trial and voice using saved shot duration and spoken characters', t => {
  const db = studio(t);
  const quote = quoteProduction(db, {}, [
    { kind: 'storyboard_image', data: { storyboard_id: 1 } },
    { kind: 'video', data: { storyboard_id: 1, duration: 5 } },
  ]);
  assert.equal(quote.maxUsd, 0.23);
  assert.deepEqual(quote.rows.map(row => row.model), ['wan2.7-image', 'wan2.6-i2v-flash']);
  assert.equal(quote.partial, false);
  const voice = quoteProduction(db, {}, [{ kind: 'tts', data: { storyboard_ids: [1] } }]);
  assert.match(voice.rows[0].basis, /5 个计费字符/);
  assert.equal(voice.maxUsd, 5 * 0.000013);
  db.prepare('UPDATE storyboards SET polished_prompt = NULL, description = ? WHERE id = 1').run('走进书房');
  const image = quoteProduction(db, {}, [{ kind: 'storyboard_image', data: { storyboard_id: 1 } }]);
  assert.deepEqual(image.rows.map(row => row.label), ['分镜图片', '优化分镜生图提示词']);
  assert.ok(image.maxUsd > 0.03);
});

test('quotes all stages of a storyboard and handles unknown and local providers distinctly', t => {
  const db = studio(t);
  const quote = quoteProduction(db, {}, [{ kind: 'characters', id: 1 }, { kind: 'boards', id: 1 }]);
  assert.equal(quote.rows.length, 4);
  assert.ok(quote.maxUsd > quote.minUsd && quote.minUsd > 0);
  assert.ok(quote.rows.every(row => row.model === 'qwen3.7-plus'));
  const cloud = ai.getDefaultConfig(db, 'text');
  const mappedText = t.mock.method(ai, 'getConfigFromModelMap', () => ({ config: cloud, modelOverride: 'qwen2.5:3b' }));
  const previousOverride = quoteProduction(db, {}, [{ kind: 'boards', id: 1 }]);
  assert.equal(previousOverride.rows[0].model, 'qwen3.7-plus');
  assert.equal(previousOverride.partial, false);
  mappedText.mock.mockImplementation(() => undefined);
  const defaultText = t.mock.method(ai, 'getDefaultConfig', () => ({ model: ['test-custom'], default_model: 'test-custom', base_url: 'https://custom.example.test/v1' }));
  const unknown = quoteProduction(db, {}, [{ kind: 'boards', id: 1 }, { kind: 'storyboard_image', data: { count: 2 } }]);
  assert.equal(unknown.partial, true);
  assert.equal(unknown.rows[0].maxUsd, null);
  assert.equal(unknown.maxUsd, 0.06);
  defaultText.mock.mockImplementation(() => ({ model: ['ollama'], default_model: 'ollama', base_url: 'http://127.0.0.1:11434/v1' }));
  const local = quoteProduction(db, {}, [{ kind: 'boards', id: 1 }]);
  assert.equal(local.partial, false);
  assert.equal(local.maxUsd, 0);
});
