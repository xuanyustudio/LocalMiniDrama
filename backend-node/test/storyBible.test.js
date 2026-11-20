const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const aiClient = require('../src/services/aiClient');
const bibles = require('../src/services/storyBibleService');

const log = { info() {}, warn() {}, error() {} };

test('normalizes, saves, and renders a story bible for prompts', () => {
  const db = new Database(':memory:');
  assert.equal(bibles.bibleTextFor(db, 1), '', 'no bible means nothing is added to prompts');
  const saved = bibles.saveBible(db, 1, {
    logline: '  落魄镖师护送神秘箱子  ',
    characters: [{ name: '林宁', role: '主角', appearance: '青衫' }, { name: '林宁', role: '重复' }, { name: '' }],
    facts: '- 林宁是陆禾的师父\n\n2. 箱子不能打开',
    style_rules: ['每集结尾留反转'],
    unknown_field: 'dropped',
  });
  assert.equal(saved.bible.logline, '落魄镖师护送神秘箱子');
  assert.deepEqual(saved.bible.characters.map(c => c.name), ['林宁'], 'blank and duplicate names are dropped');
  assert.deepEqual(saved.bible.facts, ['林宁是陆禾的师父', '箱子不能打开']);
  assert.equal('unknown_field' in saved.bible, false);
  assert.deepEqual(bibles.getBible(db, 1).bible, saved.bible);
  const text = bibles.bibleTextFor(db, 1);
  assert.match(text, /林宁｜主角｜外貌:青衫/);
  assert.match(text, /不可改动的事实：\n- 林宁是陆禾的师父/);
});

test('free rule check flags overlong dialogue, missing scenes, and unknown characters', () => {
  const bible = bibles.normalizeBible({ characters: [{ name: '林宁' }, { name: '陆禾' }] });
  const long = '场次一｜外景｜渡口｜清晨\n林宁：' + '快走'.repeat(150) + '\n陆禾（低声）：箱子呢？\n张三：站住！\n旁白：夜色降临。';
  const result = bibles.checkScriptRules(long, 30, bible);
  const byId = Object.fromEntries(result.checks.map(c => [c.id, c]));
  assert.equal(byId.length.level, 'error');
  assert.equal(byId.scenes.level, 'ok');
  assert.equal(byId.characters.level, 'warn');
  assert.match(byId.characters.detail, /张三/);
  assert.doesNotMatch(byId.characters.detail, /旁白|陆禾/, 'narration and parenthetical cues are not treated as unknown speakers');
  assert.deepEqual(result.stats.speakers, ['林宁', '陆禾', '张三', '旁白']);

  const fine = bibles.checkScriptRules('## 场次一｜内景｜木屋｜夜\n画面：灯亮着。\n林宁：你来晚了。\n陆禾：路上有人跟着我。', 15, bible);
  assert.deepEqual(fine.checks.map(c => c.level), ['ok', 'ok', 'ok']);
  assert.equal(fine.stats.speakers.includes('画面'), false, 'stage directions are not speakers');

  const empty = bibles.checkScriptRules('林宁走进木屋，四下无人。', 60, bible);
  assert.equal(empty.checks.find(c => c.id === 'dialogue').level, 'error');
  assert.equal(empty.checks.find(c => c.id === 'scenes').level, 'warn');
});

test('AI bible draft merges with the existing bible and AI review is normalized', async (t) => {
  const db = new Database(':memory:');
  bibles.saveBible(db, 1, { characters: [{ name: '林宁', role: '主角' }] });
  const inputs = [];
  t.mock.method(aiClient, 'generateText', async (_db, _log, _type, input, _system, options) => {
    inputs.push({ input: JSON.parse(input), options });
    if (inputs.length === 1) {
      return '```json\n{"logline":"护送箱子","characters":[{"name":"林宁","role":"主角"},{"name":"陆禾","role":"徒弟"}],"facts":["箱子不能打开"]}\n```';
    }
    return JSON.stringify({ score: 140, verdict: '随便', items: [{ criterion: '开场钩子', score: 9, comment: '开场平', suggestion: '先给箱子特写' }, { criterion: '', score: 3 }], top_fixes: ['先给箱子特写', 'b', 'c', 'd'] });
  });
  const draft = await bibles.generateBible(db, log, 1, '林宁把箱子交给陆禾。');
  assert.deepEqual(inputs[0].input.已有档案.characters.map(c => c.name), ['林宁']);
  assert.equal(inputs[0].options.json_mode, true);
  assert.deepEqual(draft.characters.map(c => c.name), ['林宁', '陆禾']);
  assert.equal(bibles.getBible(db, 1).bible.characters.length, 1, 'a draft is not saved until the creator saves it');

  const review = await bibles.reviewScript(db, log, 1, '场次一｜外景｜渡口\n林宁：箱子给你。', 15);
  assert.match(inputs[1].input.故事档案, /林宁/);
  assert.equal(review.ai.score, 100);
  assert.equal(review.ai.verdict, '可以拍');
  assert.deepEqual(review.ai.items, [{ criterion: '开场钩子', score: 5, comment: '开场平', suggestion: '先给箱子特写' }]);
  assert.equal(review.ai.top_fixes.length, 3);
  assert.ok(review.checks.length, 'AI review also includes the free rule check');

  await assert.rejects(bibles.generateBible(db, log, 1, '字'.repeat(30001)), bibles.StoryBibleInputError);
  await assert.rejects(bibles.reviewScript(db, log, 1, '   ', 15), bibles.StoryBibleInputError);
});

test('quotes the bible and review steps as text work that needs approval', (t) => {
  const db = new Database(':memory:');
  const qwen = { id: 3, base_url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', default_model: 'qwen3.7-plus', model: ['qwen3.7-plus'] };
  t.mock.method(aiClient, 'getConfigFromModelMap', () => null);
  t.mock.method(aiClient, 'getDefaultConfig', () => qwen);
  const { quoteProduction } = require('../src/services/productionCostService');
  const novel = { chapterText: (id, chapter) => { assert.deepEqual([id, Number(chapter)], [1, 2]); return '字'.repeat(5000); } };
  const scopes = new Set();
  const quote = quoteProduction(db, novel, [
    { kind: 'bible', id: 1, data: { chapter: 2 } },
    { kind: 'review', id: 1, data: { text_chars: 800 } },
  ], scopes);
  assert.deepEqual(quote.rows.map(r => r.label), ['整理故事档案', '剧本医生审阅']);
  assert.equal(quote.partial, false);
  assert.ok(quote.rows[0].maxUsd > quote.rows[1].maxUsd, 'a 5000-character chapter costs more than an 800-character script');
  assert.ok(scopes.has('text'), 'unpriced or priced text work requires a confirmed receipt');
});

test('parses screenplay block format without mistaking camera notes or colons in lines for speakers', () => {
  const script = [
    '**第1场 外景 屯口乡公路 黎明前**', '', '【画面】', '警车疾驰。', '特写：档案上写着——**已殁！**', '下方小字：死亡时间：2006年9月21日。', '',
    '**唐倩**', '（内心独白/轻声）', '这就是欧阳卓……', '', '**欧阳卓**', '（冷硬）', '记住：别打草惊蛇。', '第二句。', '',
    '**欧阳卓**', '还有一件事。', '', '**（本集完）**',
  ].join('\n');
  const { dialogue, scenes } = bibles.parseScript(script);
  assert.equal(scenes, 1);
  assert.deepEqual(dialogue.map(d => [d.speaker, d.text]), [
    ['唐倩', '这就是欧阳卓……'],
    ['欧阳卓', '记住：别打草惊蛇。第二句。'],
    ['欧阳卓', '还有一件事。'],
  ]);
});

test('imports the drama character library into a draft for free without overwriting what the creator wrote', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE characters (id INTEGER PRIMARY KEY, drama_id INTEGER, name TEXT, role TEXT, description TEXT,
    personality TEXT, appearance TEXT, sort_order INTEGER, deleted_at TEXT);
    INSERT INTO characters (drama_id, name, role, description, appearance) VALUES
      (1, '欧阳卓', 'main', '资深刑警', '短发，深色制服'),
      (1, '唐倩', 'supporting', '欧阳卓的搭档', '警服'),
      (2, '别的剧', 'main', '', '');`);
  const { draft, added, total } = bibles.importCharacters(db, 1, { characters: [{ name: '欧阳卓', role: '男主', appearance: '' }] });
  assert.equal(total, 2);
  assert.equal(added, 1);
  assert.deepEqual(draft.characters.map(c => [c.name, c.role, c.appearance]), [['欧阳卓', '男主', '短发，深色制服'], ['唐倩', '配角', '警服']]);
  assert.equal(bibles.getBible(db, 1).bible.characters.length, 0, 'the import is a draft until saved');
});
