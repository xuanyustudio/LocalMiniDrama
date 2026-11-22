const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    writableEnded: false,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
    write() { return true; },
    end() { this.writableEnded = true; },
  };
}

function openDb() {
  const db = new Database(':memory:');
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/24_free_canvases.sql'), 'utf8');
  db.exec(sql);
  return db;
}

describe('free canvas routes', () => {
  it('creates a canvas, applies a script node, and keeps it when revision is stale', () => {
    const db = openDb();
    const routes = require('../src/routes/freeCanvas');
    const handlers = routes(db, console);

    const created = mockRes();
    handlers.create({ body: { title: '甲画布' } }, created);
    const canvas = created.body.data;
    assert.equal(canvas.title, '甲画布');

    const listed = mockRes();
    handlers.list({}, listed);
    assert.equal(listed.body.data.some((item) => item.id === canvas.id), true);

    const command = {
      name: 'apply_ops',
      revision: 1,
      ops: [{ op: 'create_node', temp_id: 's', type: 'script', data: { title: '甲' } }],
    };
    const applied = mockRes();
    handlers.command({ params: { id: String(canvas.id) }, body: command }, applied);
    assert.equal(applied.body.data.canvas.revision, 2);
    const script = applied.body.data.canvas.document.nodes.find((node) => node.type === 'script');
    assert.equal(script.data.title, '甲');
    assert.notEqual(script.id, 'script_1');

    const stale = mockRes();
    handlers.command({ params: { id: String(canvas.id) }, body: command }, stale);
    assert.equal(stale.statusCode, 400);
    assert.match(stale.body.error.message, /画布已被更新/);

    const current = mockRes();
    handlers.get({ params: { id: String(canvas.id) } }, current);
    assert.equal(current.body.data.revision, 2);
    assert.equal(current.body.data.document.nodes.length, 1);
    assert.equal(current.body.data.document.nodes[0].id, script.id);
    assert.equal(current.body.data.document.nodes[0].type, 'script');
    assert.equal(current.body.data.document.nodes[0].data.title, '甲');
  });
});
