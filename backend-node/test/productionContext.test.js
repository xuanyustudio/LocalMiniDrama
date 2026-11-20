const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const context = require('../src/services/productionContext');
const bibles = require('../src/services/storyBibleService');

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE episodes (id INTEGER PRIMARY KEY, drama_id INTEGER, source_chapter INTEGER, deleted_at TEXT);
    CREATE TABLE scenes (id INTEGER PRIMARY KEY, drama_id INTEGER, episode_id INTEGER, location TEXT, time TEXT, deleted_at TEXT);
    INSERT INTO episodes (id, drama_id, source_chapter) VALUES (1, 1, 2), (2, 1, NULL);
    INSERT INTO scenes (drama_id, episode_id, location, time) VALUES (1, 9, '警车后座', '黎明前'), (1, 1, '本集旧场景', '夜');
  `);
  bibles.saveBible(db, 1, {
    characters: [{ name: '欧阳卓', aliases: '老欧', role: '刑警', appearance: '男，30岁，短发' }],
    places: ['屯口乡公路'],
  });
  return db;
}

const reader = {
  chapterText: (id, n) => { assert.equal(id, 1); return n === 2 ? '欧阳卓推开车门。'.repeat(2000) : ''; },
  snapshot: () => ({ source: { chapters: [{ index: 1, title: '第一章 要案' }, { index: 2, title: '第二章 老兵' }] } }),
};

test('character, scene and storyboard prompts carry the bible and the episode source chapter', () => {
  const db = fixture();
  context.registerSourceReader(reader);
  try {
    const chars = context.contextFor(db, 1, 'characters');
    assert.equal(chars.bible, true);
    assert.equal(chars.chapter, 2);
    assert.match(chars.text, /故事档案[\s\S]*欧阳卓｜又称:老欧/);
    assert.match(chars.text, /第 2 章 第二章 老兵（节选前 8000 字）/);
    assert.match(chars.text, /正式姓名/);

    const scenes = context.contextFor(db, 1, 'scenes');
    assert.match(scenes.text, /主要地点[\s\S]*屯口乡公路/);
    assert.match(scenes.text, /已有场景[\s\S]*警车后座｜黎明前/);
    assert.doesNotMatch(scenes.text, /本集旧场景/, "this episode's own scenes are replaced, not reused");
    assert.match(scenes.text, /节选前 4000 字/);

    const boards = context.contextFor(db, 1, 'boards');
    assert.match(boards.text, /对应到人物列表里的编号/);

    const noChapter = context.contextFor(db, 2, 'characters');
    assert.equal(noChapter.chapter, null, 'without a source chapter only the bible is sent');
    assert.match(noChapter.text, /故事档案/);
    assert.ok(context.contextLength(db, 1, 'characters') > 8000, 'quotes include the extra input');
  } finally {
    context.registerSourceReader(null);
  }
  assert.doesNotMatch(context.contextFor(db, 1, 'characters').text, /本集对应原著|推开车门/, 'no reader, no source text');
});

test('no bible and no source means the prompt is unchanged', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE episodes (id INTEGER PRIMARY KEY, drama_id INTEGER, deleted_at TEXT); INSERT INTO episodes VALUES (1, 1, NULL);');
  assert.deepEqual(context.contextFor(db, 1, 'boards'), { text: '', bible: false, chapter: null });
  assert.equal(context.contextLength(db, 1, 'boards'), 0);
});
