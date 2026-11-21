function emptyDocument() {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
  };
}

function stringifyDocument(document) {
  if (typeof document === 'string') return document;
  return JSON.stringify(document);
}

function parseDocument(value) {
  if (value && typeof value === 'object') return value;
  return JSON.parse(value);
}

function mapCanvas(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    revision: row.revision,
    aspect_ratio: row.aspect_ratio,
    materialized_drama_id: row.materialized_drama_id == null || row.materialized_drama_id === ''
      ? null
      : row.materialized_drama_id,
    document: parseDocument(row.document),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function conflictResult(db, id) {
  const row = db.prepare('SELECT revision FROM free_canvases WHERE id = ?').get(id);
  return {
    ok: false,
    error: '画布已被更新',
    revision: row ? row.revision : null,
  };
}

function createCanvas(db, title) {
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO free_canvases (title, revision, aspect_ratio, document, created_at, updated_at)
     VALUES (?, 1, '9:16', ?, ?, ?)`
  ).run(title || '未命名画布', JSON.stringify(emptyDocument()), now, now);
  return getCanvas(db, info.lastInsertRowid);
}

function listCanvases(db) {
  const rows = db.prepare('SELECT * FROM free_canvases ORDER BY updated_at DESC').all();
  return rows.map(mapCanvas);
}

function getCanvas(db, id) {
  const row = db.prepare('SELECT * FROM free_canvases WHERE id = ?').get(id);
  return mapCanvas(row);
}

function saveDocument(db, id, revision, document) {
  const result = db.prepare(
    `UPDATE free_canvases
     SET document = ?, revision = revision + 1, updated_at = ?
     WHERE id = ? AND revision = ?`
  ).run(stringifyDocument(document), new Date().toISOString(), id, revision);
  if (result.changes === 0) return conflictResult(db, id);
  return { ok: true, canvas: getCanvas(db, id) };
}

function saveColumns(db, id, revision, columns) {
  const src = columns || {};
  const sets = ['revision = revision + 1', 'updated_at = ?'];
  const params = [new Date().toISOString()];
  if (Object.prototype.hasOwnProperty.call(src, 'title')) {
    sets.push('title = ?');
    params.push(src.title);
  }
  if (Object.prototype.hasOwnProperty.call(src, 'aspect_ratio')) {
    sets.push('aspect_ratio = ?');
    params.push(src.aspect_ratio);
  }
  if (Object.prototype.hasOwnProperty.call(src, 'materialized_drama_id')) {
    sets.push('materialized_drama_id = ?');
    params.push(src.materialized_drama_id);
  }
  if (Object.prototype.hasOwnProperty.call(src, 'document')) {
    sets.push('document = ?');
    params.push(stringifyDocument(src.document));
  }
  params.push(id, revision);
  const result = db.prepare(
    `UPDATE free_canvases SET ${sets.join(', ')} WHERE id = ? AND revision = ?`
  ).run(...params);
  if (result.changes === 0) return conflictResult(db, id);
  return { ok: true, canvas: getCanvas(db, id) };
}

module.exports = {
  emptyDocument,
  createCanvas,
  listCanvases,
  getCanvas,
  saveDocument,
  saveColumns,
};
