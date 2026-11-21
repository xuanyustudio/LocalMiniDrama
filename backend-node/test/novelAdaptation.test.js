const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const aiClient = require('../src/services/aiClient');
const { createNovelAdaptation } = require('../src/services/novelAdaptationService');

test('imports privately, resumes a full chapter, and appends a reviewed script without overwriting previous episodes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'localminidrama-adaptation-'));
  const db = new Database(':memory:');
  t.after(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  db.exec(`CREATE TABLE dramas (id INTEGER PRIMARY KEY, updated_at TEXT);
    INSERT INTO dramas (id) VALUES (1);
    CREATE TABLE episodes (id INTEGER PRIMARY KEY, drama_id INTEGER, episode_number INTEGER, title TEXT, script_content TEXT,
      description TEXT, duration INTEGER, source_chapter INTEGER, status TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
    INSERT INTO episodes (id, drama_id, episode_number, title, script_content) VALUES (1, 1, 1, '已有第1集', '不可覆盖');`);
  const cfg = { database: { path: path.join(root, 'data', 'studio.db') }, storage: { local_path: path.join(root, 'data', 'storage') } };
  const log = { warn() {} };
  let service = createNovelAdaptation(db, log, cfg);
  const body = '天一亮，林青就往山南赶。'.repeat(335) + '他到了桥边，把箱子交给陆禾。';
  const source = Buffer.from('声明：本书为网站存储文件，仅作为测试样本。\r\n第一章 渡口\r\n' + body + '\r\n第二章 夜归\r\n后半夜，陆禾带着箱子回到江边的木屋，一盏灯仍在窗前亮着。');
  assert.deepEqual(service.snapshot(1), { source: null, job: null });
  const uploaded = service.upload(1, '试稿.txt', source);
  assert.deepEqual(uploaded.source.chapters.map((chapter) => chapter.title), ['第一章 渡口', '第二章 夜归']);
  const privateProject = path.join(root, 'data', 'adaptation', '1');
  assert.equal(fs.existsSync(cfg.storage.local_path), false);
  const hashFolder = fs.readdirSync(privateProject).find((name) => name !== 'source.json');
  assert.deepEqual(fs.readFileSync(path.join(privateProject, hashFolder, 'original.txt')), source);

  t.mock.method(aiClient, 'getDefaultConfig', () => ({ id: 3, base_url: 'https://text.example.test/v1', default_model: 'test-model' }));
  const calls = [];
  let failSecond = true;
  t.mock.method(aiClient, 'generateText', async (_db, _log, _type, input) => {
    const request = JSON.parse(input);
    if (request.已确认改写稿) {
      assert.match(request.已确认改写稿, /编辑后保留/);
      return '## 场次一｜外景｜渡口｜清晨\n林宁把箱子交给陆禾。';
    }
    calls.push(request);
    if (failSecond && request.当前段 === 2) throw new Error('暂时失败');
    return `改写段${request.当前段}。`;
  });
  const options = { chapter: 1, rules: '保留渡口', character_rules: '林青 → 林宁' };
  // Simulate a project imported before the per-chapter index was available.
  db.prepare('DELETE FROM novel_adaptation_records WHERE drama_id = 1 AND key LIKE ?').run('chapter:%');
  const originalPath = path.join(privateProject, hashFolder, 'original.txt');
  const read = fs.readFileSync;
  let reads = 0;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (file === originalPath) reads += 1;
    return read(file, ...args);
  });
  const quoted = service.estimateTextWork(1, 'rewrite', options);
  assert.equal(quoted.sourceCharacters, body.length);
  assert.equal(calls.length, 0);
  assert.equal(service.rewrite(1, options).job.status, 'running');
  assert.throws(() => service.rewrite(1, options), /正在生成/);
  await new Promise(setImmediate);
  assert.equal(service.snapshot(1).job.status, 'failed');
  assert.equal(service.snapshot(1).job.done, 1);
  assert.equal(service.estimateTextWork(1, 'rewrite', options).calls.length, quoted.calls.length - 1);
  failSecond = false;
  service = createNovelAdaptation(db, log, cfg);
  assert.equal(service.rewrite(1, options).job.done, 1);
  await new Promise(setImmediate);
  const rewritten = service.snapshot(1).job;
  assert.equal(rewritten.status, 'completed');
  assert.match(rewritten.rewritten, /改写段1/);
  assert.equal(service.estimateTextWork(1, 'rewrite', options).calls.length, 0);
  assert.equal(calls.filter((request) => request.当前段 === 1).length, 1);
  const unique = new Map(calls.map((request) => [request.当前段, request.原文]));
  assert.equal([...unique.values()].join(''), body);
  assert.equal(calls.at(-1).人物规则, options.character_rules);
  assert.equal(reads, 1);

  service.script(1, { rewritten: rewritten.rewritten + '\n编辑后保留。', seconds: 60 });
  await new Promise(setImmediate);
  const generated = service.snapshot(1).job;
  assert.equal(generated.status, 'completed');
  const request = { script: generated.script + '\n陆禾回头。', title: '渡口', seconds: 60 };
  const appended = service.appendEpisode(1, request);
  assert.equal(appended.episode.episode_number, 2);
  assert.equal(service.appendEpisode(1, request).episode.id, appended.episode.id);
  assert.deepEqual(db.prepare('SELECT script_content FROM episodes ORDER BY episode_number').all().map((row) => row.script_content),
    ['不可覆盖', request.script]);
});

test('decodes legacy GBK TXT and keeps a selective chapter preview', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'localminidrama-gbk-'));
  const db = new Database(':memory:');
  t.after(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const service = createNovelAdaptation(db, {}, { database: { path: path.join(root, 'studio.db') }, storage: { local_path: path.join(root, 'storage') } });
  const gbk = Buffer.from('b5dad2bbd5c220d2aab0b80ac4e3bac3', 'hex');
  const source = service.upload(1, '弹痕.txt', gbk);
  assert.equal(source.source.name, '弹痕.txt');
  assert.equal(source.source.chapters.length, 1);
  assert.throws(() => service.upload(1, 'book.pdf', gbk), /TXT/);
  assert.throws(() => service.upload(1, 'book.txt', Buffer.from([0, 65])), /无法读取/);
});
