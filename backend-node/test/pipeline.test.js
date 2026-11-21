const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const rules = require('../src/services/pipelineRules');
const pipeline = require('../src/services/pipelineService');
const bibles = require('../src/services/storyBibleService');

test('novel cleaning drops author notes and bylines but keeps story parentheses', () => {
  const raw = [
    '第四卷 第五十一章 世界的脊梁  作者：',
    '战侠歌点了点头。',
    '（妖少：本书开始强推，谢谢大家的支持！一天三更。）',
    '“虽然拿这些玩具是幼稚了点，（妖少：玩WARGAME的兄弟们千万不要骂我）但是和他们过过招！”',
    '他低声道（声音很轻）：“走。”',
  ].join('\n');
  const { text, removed } = rules.cleanNovelText(raw);
  assert.equal(removed, 3);
  assert.doesNotMatch(text, /妖少|作者/);
  assert.match(text, /战侠歌点了点头/);
  assert.match(text, /幼稚了点，但是和他们过过招/);
  assert.match(text, /（声音很轻）/);
});

test('style words are stripped from looks without losing the person', () => {
  const look = '男性，28岁，古铜色皮肤质感真实，毛孔清晰可见。身着深色制服，超写实摄影风格下展现出压迫感。超高清镜头下，其表情复杂，8K超清细节';
  const out = rules.stripStyleWords(look);
  assert.equal(out, '男性，28岁，古铜色皮肤。身着深色制服，展现出压迫感。其表情复杂');
  assert.equal(rules.hasStyleWords(look), true);
  assert.equal(rules.hasStyleWords(out), false);
  assert.equal(rules.composeAppearance({ appearance: '男，30岁，短发', costume: '刑警时期：深色夹克' }), '男，30岁，短发；服装：刑警时期：深色夹克');
});

test('storyboard character refs become drama character ids; scenes match by place and time', () => {
  const chars = [{ id: 1, name: '欧阳卓' }, { id: 2, name: '唐倩' }];
  assert.deepEqual(rules.normalizeCharacterRefs('[2,{"id":1,"name":"欧阳卓"},"唐倩","路人",9]', chars), { ids: [2, 1], unknown: ['路人', '#9'] });
  assert.equal(rules.isCanonicalCharacterJson('[1,2]'), true);
  assert.equal(rules.isCanonicalCharacterJson('[2,{"id":1}]'), false);
  const scenes = [{ id: 1, location: '屯口乡公路', time: '黎明前' }, { id: 2, location: '警车后座', time: '黎明前' }];
  assert.equal(rules.matchScene('开往屯口乡的公路', '黎明前', scenes), 1);
  assert.equal(rules.matchScene('屯口乡公路', '正午', scenes), null, 'different time of day is a different scene');
  assert.equal(rules.matchScene('行驶中的警车内', '黎明前', scenes), null, 'unclear matches are left to the creator');
  assert.deepEqual(rules.shotSpeakers('唐倩［画外］：十七人遇害。\n欧阳卓：有近照吗？\n唐倩：有。'), { onscreen: ['欧阳卓', '唐倩'], offscreen: ['唐倩'] });
  assert.equal(rules.spokenLength('唐倩："这是他们的女儿，赵盼。"'), 9);
  assert.equal(rules.guessSourceChapter({ title: '第1集 要案', description: '根据原著第一章整理' }, [{ index: 1, title: '第一章 要案' }]), 1);
  assert.equal(rules.guessSourceChapter({ title: '第3集 老兵', description: '' }, [{ index: 1, title: '第一章 要案' }, { index: 2, title: '第二章 老兵' }]), 2);
});

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE dramas (id INTEGER PRIMARY KEY, deleted_at TEXT);
    CREATE TABLE episodes (id INTEGER PRIMARY KEY, drama_id INTEGER, episode_number INTEGER, title TEXT, description TEXT,
      script_content TEXT, duration INTEGER, video_url TEXT, source_chapter INTEGER, deleted_at TEXT);
    CREATE TABLE characters (id INTEGER PRIMARY KEY, drama_id INTEGER, name TEXT, role TEXT, description TEXT, personality TEXT,
      appearance TEXT, image_url TEXT, local_path TEXT, sort_order INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE scenes (id INTEGER PRIMARY KEY, drama_id INTEGER, location TEXT, time TEXT, prompt TEXT, image_url TEXT, local_path TEXT,
      updated_at TEXT, deleted_at TEXT);
    CREATE TABLE storyboards (id INTEGER PRIMARY KEY, episode_id INTEGER, storyboard_number INTEGER, location TEXT, time TEXT, scene_id INTEGER,
      characters TEXT, duration INTEGER, dialogue TEXT, image_url TEXT, local_path TEXT, video_url TEXT, audio_local_path TEXT, deleted_at TEXT);
    CREATE TABLE image_generations (id INTEGER PRIMARY KEY, storyboard_id INTEGER, status TEXT, local_path TEXT, image_url TEXT, deleted_at TEXT);
    CREATE TABLE video_generations (id INTEGER PRIMARY KEY, storyboard_id INTEGER, status TEXT, local_path TEXT, video_url TEXT, deleted_at TEXT);
    INSERT INTO dramas (id) VALUES (1);
    INSERT INTO episodes (id, drama_id, episode_number, title, description, script_content, duration)
      VALUES (1, 1, 1, '第1集 要案', '小说改编 · 第 1 章', '## 场次一｜外景｜公路｜黎明前\n**欧阳卓**\n走。', 1);
    INSERT INTO characters (id, drama_id, name, role, appearance, local_path) VALUES
      (1, 1, '欧阳卓', 'main', '男性，28岁，毛孔清晰可见，短发', 'a.png'),
      (2, 1, '唐倩', 'supporting', '女性，青年', NULL);
    INSERT INTO scenes (id, drama_id, location, time, prompt, local_path) VALUES (1, 1, '屯口乡公路', '黎明前', '乡村公路，超写实', 's.png');
    INSERT INTO storyboards (id, episode_id, storyboard_number, location, time, scene_id, characters, duration, dialogue) VALUES
      (1, 1, 1, '开往屯口乡的公路', '黎明前', NULL, NULL, 5, '欧阳卓：走。'),
      (2, 1, 2, '屯口乡公路', '黎明前', 1, '[2,{"id":1,"name":"欧阳卓"}]', 3, '唐倩：县里就传了这张，十一年前拍的，没有别的照片了。');
  `);
  return db;
}

const adaptation = { sourceOverview: () => ({ name: '弹痕.txt', chapters: [{ index: 1, title: '第一章 要案' }], removed_notes: 2 }) };

test('pipeline report lights each stage and the free fixes clear what they can', () => {
  const db = fixture();
  bibles.saveBible(db, 1, { characters: [{ name: '欧阳卓', role: '主角，刑警', appearance: '男性，28岁，短发', costume: '深色夹克' }] });
  const before = pipeline.report(db, 1, adaptation);
  const stage = (r, key) => r.stages.find((s) => s.key === key);
  assert.equal(stage(before, 'source').status, 'ok');
  assert.match(stage(before, 'source').detail, /过滤 2 处/);
  const fixes = before.stages.flatMap((s) => s.issues).map((i) => i.fix?.action).filter(Boolean);
  for (const action of ['import-to-bible', 'backfill-chapters', 'match-scenes', 'normalize-characters', 'fill-speakers', 'strip-style', 'sync-bible']) {
    assert.ok(fixes.includes(action), `offers ${action}`);
  }
  assert.ok(stage(before, 'storyboard').issues.some((i) => /台词超过/.test(i.text) && /第 2 镜/.test(i.text)));
  assert.ok(stage(before, 'look').issues.some((i) => i.level === 'missing' && /唐倩/.test(i.text)), 'used character without a look photo');

  for (const action of ['backfill-chapters', 'normalize-characters', 'fill-speakers', 'match-scenes', 'strip-style', 'sync-bible', 'import-to-bible']) {
    pipeline.applyFix(db, 1, action, adaptation);
  }
  assert.equal(db.prepare('SELECT source_chapter FROM episodes WHERE id = 1').get().source_chapter, 1);
  assert.deepEqual(db.prepare('SELECT scene_id, characters FROM storyboards ORDER BY id').all(),
    [{ scene_id: 1, characters: '[1]' }, { scene_id: 1, characters: '[2,1]' }]);
  assert.equal(db.prepare('SELECT appearance FROM characters WHERE id = 1').get().appearance, '男性，28岁，短发；服装：深色夹克', 'the bible wins');
  assert.equal(db.prepare('SELECT prompt FROM scenes WHERE id = 1').get().prompt, '乡村公路');
  assert.deepEqual(bibles.getBible(db, 1).bible.characters.map((c) => c.name), ['欧阳卓', '唐倩']);
  const after = pipeline.report(db, 1, adaptation);
  // 外貌和场景描述被修复改过，已有的定妆照和场景图就过期了
  assert.ok(stage(after, 'look').issues.some((i) => /欧阳卓的定妆照已过期（外貌改过）/.test(i.text) && i.fix?.action === 'accept-stale-look'));
  assert.ok(stage(after, 'scene').issues.some((i) => /屯口乡公路（黎明前）的场景图已过期/.test(i.text)));
  pipeline.applyFix(db, 1, 'accept-stale-look', adaptation);
  pipeline.applyFix(db, 1, 'accept-stale-scene_image', adaptation);
  const settled = pipeline.report(db, 1, adaptation);
  assert.equal(settled.stages.flatMap((s) => s.issues).filter((i) => i.fix).length, 0, 'no free fix left to offer');
  assert.throws(() => pipeline.applyFix(db, 1, 'drop-tables', adaptation), bibles.StoryBibleInputError);
});
