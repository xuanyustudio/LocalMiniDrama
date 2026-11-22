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

describe('free canvas upload', () => {
  it('writes a file onto an upload node and skips the write when node_id is missing', async () => {
    const db = openDb();
    const routes = require('../src/routes/freeCanvas');
    const handlers = routes(db, console);

    const created = mockRes();
    handlers.create({ body: { title: '上传画布' } }, created);
    const canvas = created.body.data;

    const applied = mockRes();
    handlers.command({
      params: { id: String(canvas.id) },
      body: {
        name: 'apply_ops',
        revision: 1,
        ops: [{ op: 'create_node', temp_id: 'u', type: 'upload' }],
      },
    }, applied);
    const savedCanvas = applied.body.data.canvas;
    assert.equal(savedCanvas.revision, 2);
    const nodeId = savedCanvas.document.nodes.find((node) => node.type === 'upload').id;

    const writes = [];
    const mkdirs = [];
    const writeFile = async (absPath, buffer) => {
      writes.push({ absPath, buffer });
    };
    const mkdir = async (dir, options) => {
      mkdirs.push({ dir, options });
    };
    const storageRoot = path.join('D:\\tmp', 'free-canvas-upload-test');
    const deps = { writeFile, mkdir, storageRoot };

    const uploaded = mockRes();
    await handlers.upload({
      params: { id: String(canvas.id) },
      node_id: nodeId,
      revision: 2,
      filename: 'a.png',
      buffer: Buffer.from('png'),
    }, uploaded, deps);

    assert.equal(writes.length, 1);
    const normalized = String(writes[0].absPath).replace(/\\/g, '/');
    assert.match(normalized, new RegExp(`/free-canvases/${canvas.id}/uploads/${nodeId}-a\\.png$`));
    assert.equal(mkdirs.length, 1);
    assert.deepEqual(mkdirs[0].options, { recursive: true });

    const node = uploaded.body.data.canvas.document.nodes.find((item) => item.id === nodeId);
    const relativePath = `free-canvases/${canvas.id}/uploads/${nodeId}-a.png`;
    assert.equal(node.data.local_path, relativePath);
    assert.equal(node.data.source_file_name, 'a.png');
    assert.equal(node.data.image_url, `/static/${relativePath}`);
    assert.equal(node.status, 'succeeded');
    assert.equal(uploaded.body.data.canvas.revision, 3);

    const denied = mockRes();
    await handlers.upload({
      params: { id: String(canvas.id) },
      revision: 3,
      filename: 'a.png',
      buffer: Buffer.from('png'),
    }, denied, deps);
    assert.equal(denied.statusCode, 400);
    assert.equal(writes.length, 1);
    assert.equal(mkdirs.length, 1);
  });
});
