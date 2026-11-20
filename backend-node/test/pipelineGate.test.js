const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const gate = require('../src/services/pipelineGate');
const stamps = require('../src/services/pipelineStamps');

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE episodes (id INTEGER PRIMARY KEY, drama_id INTEGER, episode_number INTEGER, script_content TEXT, deleted_at TEXT);
    CREATE TABLE characters (id INTEGER PRIMARY KEY, drama_id INTEGER, name TEXT, appearance TEXT, image_url TEXT, local_path TEXT, deleted_at TEXT);
    CREATE TABLE scenes (id INTEGER PRIMARY KEY, drama_id INTEGER, location TEXT, time TEXT, prompt TEXT, image_url TEXT, local_path TEXT, deleted_at TEXT);
    CREATE TABLE storyboards (id INTEGER PRIMARY KEY, episode_id INTEGER, storyboard_number INTEGER, characters TEXT, scene_id INTEGER,
      action TEXT, dialogue TEXT, duration INTEGER, location TEXT, time TEXT, image_url TEXT, local_path TEXT, video_url TEXT, deleted_at TEXT);
    CREATE TABLE image_generations (id INTEGER PRIMARY KEY, storyboard_id INTEGER, status TEXT, deleted_at TEXT);
    CREATE TABLE video_generations (id INTEGER PRIMARY KEY, storyboard_id INTEGER, status TEXT, deleted_at TEXT);
    INSERT INTO episodes VALUES (1, 1, 1, '剧本 v1', NULL);
    INSERT INTO characters VALUES (1, 1, '欧阳卓', '男，28岁', NULL, 'look1.png', NULL), (2, 1, '唐倩', '女，青年', NULL, NULL, NULL);
    INSERT INTO scenes VALUES (1, 1, '警车后座', '黎明前', '狭窄的警车后座', NULL, NULL, NULL);
    INSERT INTO storyboards (id, episode_id, storyboard_number, characters, scene_id, action, dialogue, duration) VALUES
      (1, 1, 1, '[1,2]', 1, '翻阅资料', '唐倩：十七人遇害。', 4),
      (2, 1, 2, '[1]', NULL, '望向窗外', NULL, 3);
  `);
  return db;
}

test('a shot cannot get a frame or video until its people have looks and its scene has an image', () => {
  const db = fixture();
  assert.throws(() => gate.assertShotReady(db, { storyboard_id: 1 }, '视频'),
    (err) => err instanceof gate.PipelineGateError && /第1集第1镜暂不能生成视频/.test(err.message)
      && /人物「唐倩」还没有定妆照/.test(err.message) && /场景「警车后座·黎明前」还没有场景图/.test(err.message));
  assert.doesNotThrow(() => gate.assertShotReady(db, { storyboard_id: 2 }, '视频'), 'a shot without a scene is only warned');
  assert.deepEqual(gate.episodeReadiness(db, 1).shots[2].warnings, ['没有关联场景，画面背景可能每镜不一样']);
  assert.doesNotThrow(() => gate.assertShotReady(db, { prompt: 'x' }, '首帧画面'), 'non-shot images are not gated');
  assert.doesNotThrow(() => gate.assertShotReady(db, { storyboard_id: 1, character_id: 2 }, '首帧画面'), 'look photos are not gated');

  db.exec("UPDATE characters SET local_path = 'look2.png' WHERE id = 2; UPDATE scenes SET local_path = 'car.png' WHERE id = 1;");
  assert.equal(gate.shotReadiness(db, 1).ok, true);
  assert.doesNotThrow(() => gate.assertShotReady(db, { storyboard_id: 1 }, '视频'));
});

test('changing anything upstream marks downstream outputs stale, all the way to video', () => {
  const db = fixture();
  db.exec("UPDATE characters SET local_path = 'look2.png' WHERE id = 2; UPDATE scenes SET local_path = 'car.png' WHERE id = 1;");
  db.exec("UPDATE storyboards SET local_path = 'f1.png', video_url = 'v1.mp4' WHERE id = 1;");
  assert.deepEqual(stamps.observe(db, 1), [], 'first sight records fingerprints, nothing is stale');

  db.exec("UPDATE characters SET appearance = '男，30岁，留胡子' WHERE id = 1;");
  assert.deepEqual(stamps.observe(db, 1).map((s) => [s.kind, s.label, s.reasons]), [['look', '欧阳卓', ['外貌改过']]]);

  db.exec("UPDATE characters SET local_path = 'look1b.png' WHERE id = 1;"); // 重新生成定妆照
  const afterNewLook = stamps.observe(db, 1);
  assert.deepEqual(afterNewLook.map((s) => [s.kind, s.label, s.reasons]), [['frame', '第1集第1镜', ['定妆照换过']]],
    'new look photo is fresh; the frame that used the old one is stale');

  db.exec("UPDATE storyboards SET local_path = 'f1b.png' WHERE id = 1;"); // 重新生成首帧
  assert.deepEqual(stamps.observe(db, 1).map((s) => [s.kind, s.reasons]), [['video', ['首帧换过']]]);

  db.exec("UPDATE storyboards SET dialogue = '唐倩：十七个民兵遇害。' WHERE id = 1;");
  assert.deepEqual(stamps.observe(db, 1).map((s) => s.reasons), [['首帧换过', '动作或台词改过']]);
  assert.equal(stamps.accept(db, 1, 'video'), 1);
  assert.deepEqual(stamps.observe(db, 1), []);

  db.exec("UPDATE episodes SET script_content = '剧本 v2' WHERE id = 1;");
  assert.deepEqual(stamps.observe(db, 1).map((s) => [s.kind, s.label]), [['storyboards', '第1集']]);

  db.exec("UPDATE storyboards SET video_url = NULL WHERE id = 1;");
  stamps.observe(db, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM pipeline_stamps WHERE kind = 'video'").get().n, 0, 'removed outputs drop their stamp');
});
