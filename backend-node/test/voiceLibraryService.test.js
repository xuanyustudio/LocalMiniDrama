const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const voiceLibraryService = require('../src/services/voiceLibraryService');

const log = { info() {}, warn() {}, error() {} };

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE voice_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      description TEXT,
      gender TEXT,
      age_range TEXT,
      tags TEXT,
      source TEXT NOT NULL DEFAULT 'upload',
      source_ref TEXT,
      ref_audio_path TEXT NOT NULL DEFAULT '',
      ref_text TEXT NOT NULL DEFAULT '',
      sample_url TEXT,
      language TEXT DEFAULT 'en',
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER NOT NULL,
      name TEXT,
      voice_id INTEGER,
      deleted_at TEXT
    );
  `);
  return db;
}

function insertVoiceRow(db, overrides = {}) {
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO voice_library (name, gender, source, ref_audio_path, ref_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    overrides.name || 'Test Voice',
    overrides.gender || 'female',
    overrides.source || 'elevenlabs',
    overrides.ref_audio_path || 'voice_library/x.mp3',
    overrides.ref_text || 'sample',
    now, now
  );
  return info.lastInsertRowid;
}

test('listVoices filters by gender', () => {
  const db = createDb();
  insertVoiceRow(db, { name: 'A', gender: 'female' });
  insertVoiceRow(db, { name: 'B', gender: 'male' });
  const females = voiceLibraryService.listVoices(db, { gender: 'female' });
  assert.equal(females.length, 1);
  assert.equal(females[0].name, 'A');
});

test('deleteVoice blocks when in use unless forced, and clears the dangling reference when forced', () => {
  const db = createDb();
  const voiceId = insertVoiceRow(db, { name: 'Used' });
  db.prepare('INSERT INTO characters (drama_id, name, voice_id) VALUES (1, ?, ?)').run('Hero', voiceId);

  const blocked = voiceLibraryService.deleteVoice(db, log, voiceId, false);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'in_use');
  assert.equal(blocked.usageCount, 1);
  assert.notEqual(voiceLibraryService.getVoice(db, voiceId), null);

  const forced = voiceLibraryService.deleteVoice(db, log, voiceId, true);
  assert.equal(forced.ok, true);
  assert.equal(voiceLibraryService.getVoice(db, voiceId), null);
  const char = db.prepare('SELECT voice_id FROM characters WHERE name = ?').get('Hero');
  assert.equal(char.voice_id, null);
});

test('deleteVoice succeeds directly when unused', () => {
  const db = createDb();
  const voiceId = insertVoiceRow(db, { name: 'Unused' });
  const result = voiceLibraryService.deleteVoice(db, log, voiceId, false);
  assert.equal(result.ok, true);
  assert.equal(voiceLibraryService.getVoice(db, voiceId), null);
});
