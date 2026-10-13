const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const characterLibraryService = require('../src/services/characterLibraryService');
const sceneLibraryService = require('../src/services/sceneLibraryService');
const propLibraryService = require('../src/services/propLibraryService');

const log = {
  info() {},
  warn() {},
  error() {},
};

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE dramas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      deleted_at TEXT
    );

    CREATE TABLE characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      description TEXT,
      appearance TEXT,
      image_url TEXT,
      local_path TEXT,
      deleted_at TEXT
    );

    CREATE TABLE scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER NOT NULL,
      location TEXT,
      time TEXT,
      prompt TEXT,
      image_url TEXT,
      local_path TEXT,
      deleted_at TEXT
    );

    CREATE TABLE props (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      type TEXT,
      description TEXT,
      prompt TEXT,
      image_url TEXT,
      local_path TEXT,
      deleted_at TEXT
    );

    CREATE TABLE character_libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      category TEXT,
      image_url TEXT,
      local_path TEXT,
      description TEXT,
      tags TEXT,
      source_type TEXT,
      source_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE scene_libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER,
      location TEXT NOT NULL DEFAULT '',
      time TEXT,
      prompt TEXT,
      description TEXT,
      image_url TEXT,
      local_path TEXT,
      category TEXT,
      tags TEXT,
      source_type TEXT,
      source_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE prop_libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      description TEXT,
      prompt TEXT,
      image_url TEXT,
      local_path TEXT,
      category TEXT,
      tags TEXT,
      source_type TEXT,
      source_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
  `);
  db.prepare('INSERT INTO dramas (id, title) VALUES (1, ?)').run('Test drama');
  return db;
}

function countRows(db, table, where) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get().count;
}

test('adding the same character to drama and material libraries is idempotent', () => {
  const db = createDb();
  db.prepare(
    'INSERT INTO characters (id, drama_id, name, description, image_url, local_path) VALUES (1, 1, ?, ?, ?, ?)'
  ).run('Hero', 'original', '/static/projects/hero.png', 'projects/hero.png');

  const firstDrama = characterLibraryService.addCharacterToLibrary(db, log, 1);
  db.prepare('UPDATE characters SET name = ?, description = ? WHERE id = 1').run('Hero updated', 'updated');
  const secondDrama = characterLibraryService.addCharacterToLibrary(db, log, 1);
  const firstMaterial = characterLibraryService.addCharacterToMaterialLibrary(db, log, 1);
  const secondMaterial = characterLibraryService.addCharacterToMaterialLibrary(db, log, 1);

  assert.equal(firstDrama.item.id, secondDrama.item.id);
  assert.equal(firstMaterial.item.id, secondMaterial.item.id);
  assert.equal(countRows(db, 'character_libraries', 'drama_id = 1 AND deleted_at IS NULL'), 1);
  assert.equal(countRows(db, 'character_libraries', 'drama_id IS NULL AND deleted_at IS NULL'), 1);
  assert.equal(secondDrama.item.name, 'Hero updated');
  assert.equal(
    db.prepare('SELECT source_id FROM character_libraries WHERE id = ?').get(secondDrama.item.id).source_id,
    '1'
  );
});

test('adding the same scene to drama and material libraries is idempotent', () => {
  const db = createDb();
  db.prepare(
    'INSERT INTO scenes (id, drama_id, location, time, prompt, image_url, local_path) VALUES (1, 1, ?, ?, ?, ?, ?)'
  ).run('Village', 'day', 'quiet street', '/static/projects/village.png', 'projects/village.png');

  const firstDrama = sceneLibraryService.addSceneToLibrary(db, log, 1);
  db.prepare('UPDATE scenes SET location = ?, prompt = ? WHERE id = 1').run('Village updated', 'busy street');
  const secondDrama = sceneLibraryService.addSceneToLibrary(db, log, 1);
  const firstMaterial = sceneLibraryService.addSceneToMaterialLibrary(db, log, 1);
  const secondMaterial = sceneLibraryService.addSceneToMaterialLibrary(db, log, 1);

  assert.equal(firstDrama.item.id, secondDrama.item.id);
  assert.equal(firstMaterial.item.id, secondMaterial.item.id);
  assert.equal(countRows(db, 'scene_libraries', 'drama_id = 1 AND deleted_at IS NULL'), 1);
  assert.equal(countRows(db, 'scene_libraries', 'drama_id IS NULL AND deleted_at IS NULL'), 1);
  assert.equal(secondDrama.item.location, 'Village updated');
  assert.equal(
    db.prepare('SELECT source_id FROM scene_libraries WHERE id = ?').get(secondDrama.item.id).source_id,
    '1'
  );
});

test('adding the same prop to drama and material libraries is idempotent', () => {
  const db = createDb();
  db.prepare(
    'INSERT INTO props (id, drama_id, name, description, prompt, image_url, local_path) VALUES (1, 1, ?, ?, ?, ?, ?)'
  ).run('Sword', 'old blade', 'silver sword', '/static/projects/sword.png', 'projects/sword.png');

  const firstDrama = propLibraryService.addPropToLibrary(db, log, 1);
  db.prepare('UPDATE props SET name = ?, description = ? WHERE id = 1').run('Sword updated', 'polished blade');
  const secondDrama = propLibraryService.addPropToLibrary(db, log, 1);
  const firstMaterial = propLibraryService.addPropToMaterialLibrary(db, log, 1);
  const secondMaterial = propLibraryService.addPropToMaterialLibrary(db, log, 1);

  assert.equal(firstDrama.item.id, secondDrama.item.id);
  assert.equal(firstMaterial.item.id, secondMaterial.item.id);
  assert.equal(countRows(db, 'prop_libraries', 'drama_id = 1 AND deleted_at IS NULL'), 1);
  assert.equal(countRows(db, 'prop_libraries', 'drama_id IS NULL AND deleted_at IS NULL'), 1);
  assert.equal(secondDrama.item.name, 'Sword updated');
  assert.equal(
    db.prepare('SELECT source_id FROM prop_libraries WHERE id = ?').get(secondDrama.item.id).source_id,
    '1'
  );
});
