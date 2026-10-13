const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const imageClient = require('../src/services/imageClient');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE image_proxy_cache (
    cache_key TEXT PRIMARY KEY,
    proxy_url TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  return db;
}

describe('image_proxy_cache', () => {
  it('getProxyCache returns null when entry expired by expire_hours', () => {
    const db = makeDb();
    const old = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    db.prepare(
      'INSERT INTO image_proxy_cache (cache_key, proxy_url, created_at) VALUES (?, ?, ?)'
    ).run('scenes/test.jpg', 'https://example.com/a.jpg', old);

    assert.equal(imageClient.getProxyCache(db, 'scenes/test.jpg'), null);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM image_proxy_cache').get().c, 0);
  });

  it('getProxyCache returns url when entry still fresh', () => {
    const db = makeDb();
    imageClient.setProxyCache(db, 'scenes/fresh.jpg', 'https://example.com/fresh.jpg');
    assert.equal(imageClient.getProxyCache(db, 'scenes/fresh.jpg'), 'https://example.com/fresh.jpg');
  });

  it('deleteProxyCache removes row', () => {
    const db = makeDb();
    imageClient.setProxyCache(db, 'k1', 'https://example.com/x.jpg');
    imageClient.deleteProxyCache(db, 'k1');
    assert.equal(imageClient.getProxyCache(db, 'k1'), null);
  });
});
