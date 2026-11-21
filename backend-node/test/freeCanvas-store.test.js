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
    assert.equal(stale.error, '画布已被更新');
    assert.equal(stale.revision, 2);
    assert.equal(getCanvas(db, created.id).document.nodes[0].id, 'script_1');
  });

  it('rejects a stale saveColumns without changing title or document', () => {
    const { createCanvas, getCanvas, saveDocument, saveColumns } = require('../src/services/freeCanvas/store');
    const db = openDb();
    const created = createCanvas(db, '原标题');
    const document = { nodes: [{ id: 'script_1' }], edges: [] };
    const saved = saveDocument(db, created.id, 1, document);
    assert.equal(saved.ok, true);

    const stale = saveColumns(db, created.id, 1, {
      title: '被改掉',
      document: { nodes: [], edges: [] },
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.error, '画布已被更新');
    assert.equal(stale.revision, 2);

    const current = getCanvas(db, created.id);
    assert.equal(current.revision, 2);
    assert.equal(current.title, '原标题');
    assert.deepEqual(current.document, document);
  });

  it('updates aspect ratio without changing title or document', () => {
    const { createCanvas, saveDocument, saveColumns } = require('../src/services/freeCanvas/store');
    const db = openDb();
    const created = createCanvas(db, '原标题');
    const document = { nodes: [{ id: 'script_1' }], edges: [] };
    const saved = saveDocument(db, created.id, 1, document);
    assert.equal(saved.ok, true);

    const updated = saveColumns(db, created.id, saved.canvas.revision, { aspect_ratio: '16:9' });
    assert.equal(updated.ok, true);
    assert.equal(updated.canvas.revision, 3);
    assert.equal(updated.canvas.aspect_ratio, '16:9');
    assert.equal(updated.canvas.title, '原标题');
    assert.deepEqual(updated.canvas.document, document);
  });

  it('rejects a string document without writing or breaking reads', () => {
    const { createCanvas, getCanvas, listCanvases, saveDocument, saveColumns } = require('../src/services/freeCanvas/store');
    const db = openDb();
    const created = createCanvas(db, '未命名画布');

    const rejected = saveDocument(db, created.id, 1, 'not-json');
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error, '文档必须是对象');
    assert.equal(rejected.revision, 1);
    assert.equal(getCanvas(db, created.id).revision, 1);
    assert.deepEqual(getCanvas(db, created.id).document.nodes, []);

    const rejectedColumns = saveColumns(db, created.id, 1, { title: '不应写入', document: 'not-json' });
    assert.equal(rejectedColumns.ok, false);
    assert.equal(rejectedColumns.error, '文档必须是对象');
    assert.equal(rejectedColumns.revision, 1);

    const current = getCanvas(db, created.id);
    assert.equal(current.revision, 1);
    assert.equal(current.title, '未命名画布');
    assert.deepEqual(current.document.nodes, []);
    assert.equal(listCanvases(db).length, 1);
  });

  it('returns 画布不存在 when the canvas id is missing', () => {
    const { saveDocument, saveColumns } = require('../src/services/freeCanvas/store');
    const db = openDb();

    const missingDocument = saveDocument(db, 999, 1, { nodes: [], edges: [] });
    assert.equal(missingDocument.ok, false);
    assert.equal(missingDocument.error, '画布不存在');
    assert.equal(missingDocument.revision, null);

    const missingColumns = saveColumns(db, 999, 1, { title: '不存在' });
    assert.equal(missingColumns.ok, false);
    assert.equal(missingColumns.error, '画布不存在');
    assert.equal(missingColumns.revision, null);
  });

  it('does not bump revision when saveColumns has no writable fields', () => {
    const { createCanvas, saveColumns } = require('../src/services/freeCanvas/store');
    const db = openDb();
    const created = createCanvas(db, '保持');

    const saved = saveColumns(db, created.id, 1, {});
    assert.equal(saved.ok, true);
    assert.equal(saved.canvas.revision, 1);
    assert.equal(saved.canvas.title, '保持');
    assert.deepEqual(saved.canvas.document.nodes, []);

    const unknown = saveColumns(db, created.id, 1, { unknown: 'x' });
    assert.equal(unknown.ok, true);
    assert.equal(unknown.canvas.revision, 1);
    assert.equal(unknown.canvas.title, '保持');
  });
});
