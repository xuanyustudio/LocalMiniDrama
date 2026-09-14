const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const assetService = require('../src/services/assetService');

const log = { info() {}, warn() {}, error() {} };

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drama_id INTEGER,
      name TEXT,
      description TEXT,
      type TEXT,
      category TEXT,
      url TEXT,
      local_path TEXT,
      thumbnail_url TEXT,
      file_size INTEGER,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      duration REAL,
      image_gen_id INTEGER,
      video_gen_id INTEGER,
      is_favorite INTEGER,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
  `);
  return db;
}

test('asset list supports keyword search and exposes uploaded file metadata', () => {
  const db = createDb();
  assetService.create(db, log, {
    name: 'Sunset poster.png',
    type: 'image',
    category: 'poster',
    local_path: 'uploads/sunset.png',
    file_size: 123456,
    mime_type: 'image/png',
    width: 1080,
    height: 1920,
  });
  assetService.create(db, log, {
    name: 'City clip',
    type: 'video',
    category: 'b-roll',
    local_path: 'videos/city.mp4',
  });

  const result = assetService.list(db, { keyword: 'sunset', page: 1, page_size: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, 'Sunset poster.png');
  assert.equal(result.items[0].file_size, 123456);
  assert.equal(result.items[0].mime_type, 'image/png');
  assert.equal(result.items[0].width, 1080);
  assert.equal(result.items[0].height, 1920);
});

test('asset keyword search composes with media type filtering', () => {
  const db = createDb();
  assetService.create(db, log, { name: 'Hero reference', type: 'image', category: 'character' });
  assetService.create(db, log, { name: 'Hero motion', type: 'video', category: 'character' });

  const result = assetService.list(db, { keyword: 'hero', type: 'video', page: 1, page_size: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].type, 'video');
  assert.equal(result.items[0].name, 'Hero motion');
});
