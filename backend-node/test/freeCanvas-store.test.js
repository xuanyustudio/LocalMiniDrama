const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function openDb() {
  const db = new Database(':memory:');
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/24_free_canvases.sql'), 'utf8');
  db.exec(sql);
  return db;
}

describe('free canvas store', () => {
  it('creates a blank canvas and rejects a stale revision', () => {
    const { createCanvas, getCanvas, saveDocument } = require('../src/services/freeCanvas/store');
    const db = openDb();
    const created = createCanvas(db, '未命名画布');
    assert.equal(created.revision, 1);
    assert.equal(created.aspect_ratio, '9:16');
    assert.deepEqual(created.document.nodes, []);

    const saved = saveDocument(db, created.id, 1, { nodes: [{ id: 'script_1' }], edges: [] });
    assert.equal(saved.ok, true);
    assert.equal(saved.canvas.revision, 2);

    const stale = saveDocument(db, created.id, 1, { nodes: [], edges: [] });
    assert.equal(stale.ok, false);
    assert.equal(stale.revision, 2);
    assert.equal(getCanvas(db, created.id).document.nodes[0].id, 'script_1');
  });
});
