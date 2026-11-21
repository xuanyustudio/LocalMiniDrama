const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const aiClient = require('../src/services/aiClient');
const book = require('../src/services/bookBibleService');
const bibles = require('../src/services/storyBibleService');

const log = { info() {}, warn() {}, error() {} };
const chapters = [
  { index: 1, title: '第一章 要案', characters: 15000 },
  { index: 2, title: '第二章 老兵', characters: 12000 },
  { index: 3, title: '第三章 超长', characters: 60000 },
  { index: 4, title: '第四章 新兵', characters: 9000 },
];
const adaptation = {
  snapshot: () => ({ source: { name: '测试.txt', chapters } }),
  chapterText: (_id, n) => `第${n}章正文`,
};

async function waitFor(db, status) {
  for (let i = 0; i < 200; i++) {
    const { job } = book.status(db, 1);
    if (job && job.status === status) return job;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`job never reached ${status}: ${JSON.stringify(book.status(db, 1).job)}`);
}

test('chapters are cut into ordered batches; over-long chapters are skipped', () => {
  const { batches, skipped } = book.planBatches(chapters, 1, 4, 24000);
  assert.deepEqual(batches.map((b) => b.chapters), [[1], [2, 4]]);
  assert.deepEqual(skipped, [3]);
  assert.deepEqual(book.planBatches(chapters, 2, 2).batches.map((b) => b.chapters), [[2]]);
});

test('merging keeps people and facts the model forgot, matching by alias', () => {
  const prev = { characters: [{ name: '欧阳卓', role: '刑警' }, { name: '战侠歌', aliases: '小歌' }], facts: ['第1章：十七人遇害'] };
  const next = { logline: '新兵成长', characters: [{ name: '小歌', aliases: '战侠歌', role: '主角' }], facts: ['第4章：入伍'] };
  const merged = book.mergeDraft(prev, next);
  assert.deepEqual(merged.characters.map((c) => [c.name, c.role]), [['小歌', '主角'], ['欧阳卓', '刑警']]);
  assert.deepEqual(merged.facts, ['第4章：入伍', '第1章：十七人遇害']);
  assert.equal(merged.logline, '新兵成长');
});

test('the whole book is read batch by batch, can fail midway and resume from the breakpoint', async (t) => {
  const db = new Database(':memory:');
  bibles.saveBible(db, 1, { characters: [{ name: '旧人物' }] });
  const inputs = [];
  let failNext = 0;
  t.mock.method(aiClient, 'generateText', async (_db, _log, _type, input) => {
    const data = JSON.parse(input);
    inputs.push(data);
    if (failNext > 0) { failNext -= 1; throw new Error('网络错误'); }
    const names = (data.已有档案?.characters || []).map((c) => c.name);
    return JSON.stringify({ characters: [...names.map((name) => ({ name })), { name: `人物${inputs.length}` }] });
  });

  assert.equal(book.estimate(db, adaptation, 1, {}).length, 2, 'quote counts one call per batch');
  book.start(db, log, adaptation, 1, { fresh: true });
  assert.throws(() => book.start(db, log, adaptation, 1, {}), book.BookBibleError, 'one run at a time');
  const done = await waitFor(db, 'done');
  assert.equal(done.done, 2);
  assert.equal(inputs[0].已有档案, null, 'fresh start ignores the saved bible');
  assert.match(inputs[1].原文, /【第 2 章 第二章 老兵】[\s\S]*【第 4 章 第四章 新兵】/);
  assert.deepEqual(done.draft.characters.map((c) => c.name), ['人物1', '人物2']);
  assert.deepEqual(bibles.getBible(db, 1).bible.characters.map((c) => c.name), ['旧人物'], 'draft is not saved automatically');

  // 第二批连续失败两次（含一次自动重试）→ 任务失败但保留第一批成果
  inputs.length = 0;
  t.mock.method(aiClient, 'generateText', async (_db, _log, _type, input) => {
    inputs.push(JSON.parse(input));
    if (inputs.length >= 2 && failNext-- > 0) throw new Error('网络错误');
    return JSON.stringify({ characters: [{ name: `人物${inputs.length}` }] });
  });
  failNext = 2;
  book.start(db, log, adaptation, 1, {});
  const failed = await waitFor(db, 'failed');
  assert.equal(failed.done, 1);
  assert.match(failed.error, /可以接着整理/);
  assert.equal(inputs[0].已有档案.characters[0].name, '旧人物', 'without fresh the saved bible is the starting point');
  assert.equal(book.estimate(db, adaptation, 1, { resume: true }).length, 1, 'resume only quotes the remaining batch');

  book.start(db, log, adaptation, 1, { resume: true });
  const resumed = await waitFor(db, 'done');
  assert.equal(resumed.done, 2);
  assert.ok(resumed.draft.characters.some((c) => c.name === '人物1'), 'first batch result survives the resume');
});

test('invalid ranges and missing source are rejected with a readable message', () => {
  const db = new Database(':memory:');
  assert.throws(() => book.start(db, log, adaptation, 1, { from: 3, to: 2 }), /章节范围无效/);
  assert.throws(() => book.start(db, log, { snapshot: () => ({ source: null }) }, 1, {}), /请先在“小说改编”里上传原著/);
});
