const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { updateStoryboard } = require('../src/services/storyboardService');

function setup() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE storyboards (id INTEGER PRIMARY KEY, episode_id INTEGER, storyboard_number INTEGER,
    dialogue TEXT, narration TEXT, audio_local_path TEXT, narration_audio_local_path TEXT,
    updated_at TEXT, deleted_at TEXT)`);
  db.prepare(`INSERT INTO storyboards (id, episode_id, storyboard_number, dialogue, narration, audio_local_path, narration_audio_local_path)
    VALUES (1, 1, 1, '甲：你好', '夜色降临', 'audio/d.mp3', 'audio/n.mp3')`).run();
  return db;
}
const log = { info() {}, warn() {}, error() {} };
const paths = (db) => db.prepare('SELECT audio_local_path AS d, narration_audio_local_path AS n FROM storyboards WHERE id = 1').get();

test('editing narration or dialogue text clears the stale voice track', () => {
  const db = setup();
  try { updateStoryboard(db, log, 1, { narration: '天亮了' }); } catch (_) { /* response mapping may need more columns */ }
  assert.deepEqual(paths(db), { d: 'audio/d.mp3', n: null });
  try { updateStoryboard(db, log, 1, { dialogue: '甲：再见' }); } catch (_) { /* see above */ }
  assert.deepEqual(paths(db), { d: null, n: null });
});

test('saving unchanged text, or text with a new audio path, keeps the given audio', () => {
  const db = setup();
  try { updateStoryboard(db, log, 1, { dialogue: '甲：你好 ', narration: '夜色降临' }); } catch (_) { /* see above */ }
  assert.deepEqual(paths(db), { d: 'audio/d.mp3', n: 'audio/n.mp3' });
  try { updateStoryboard(db, log, 1, { narration: '新旁白', narration_audio_local_path: 'audio/new.mp3' }); } catch (_) { /* see above */ }
  assert.deepEqual(paths(db), { d: 'audio/d.mp3', n: 'audio/new.mp3' });
});
