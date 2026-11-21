function emptyDocument() {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
  };
}

function isDocumentObject(value) {
  return value != null && typeof value === 'object';
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

function loadCanvasRow(db, id) {
  return db.prepare('SELECT * FROM free_canvases WHERE id = ?').get(id);
}

function missingCanvasResult() {
  return { ok: false, error: '画布不存在', revision: null };
}

function staleCanvasResult(revision) {
  return { ok: false, error: '画布已被更新', revision };
}

function invalidDocumentResult(revision) {
  return { ok: false, error: '文档必须是对象', revision };
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
  return mapCanvas(loadCanvasRow(db, id));
}

function saveDocument(db, id, revision, document) {
  const row = loadCanvasRow(db, id);
  if (!row) return missingCanvasResult();
  if (!isDocumentObject(document)) return invalidDocumentResult(row.revision);
  if (row.revision !== revision) return staleCanvasResult(row.revision);

  const result = db.prepare(
    `UPDATE free_canvases
     SET document = ?, revision = revision + 1, updated_at = ?
     WHERE id = ? AND revision = ?`
  ).run(JSON.stringify(document), new Date().toISOString(), id, revision);
  if (result.changes === 0) {
    const current = loadCanvasRow(db, id);
    if (!current) return missingCanvasResult();
    return staleCanvasResult(current.revision);
  }
  return { ok: true, canvas: getCanvas(db, id) };
}

const WRITABLE_COLUMNS = ['title', 'aspect_ratio', 'materialized_drama_id', 'document'];

function saveColumns(db, id, revision, columns) {
  const row = loadCanvasRow(db, id);
  if (!row) return missingCanvasResult();

  const src = columns && typeof columns === 'object' ? columns : {};
  const hasDocument = Object.prototype.hasOwnProperty.call(src, 'document');
  if (hasDocument && !isDocumentObject(src.document)) return invalidDocumentResult(row.revision);

  const names = WRITABLE_COLUMNS.filter((name) => Object.prototype.hasOwnProperty.call(src, name));
  if (names.length === 0) return { ok: true, canvas: mapCanvas(row) };
  if (row.revision !== revision) return staleCanvasResult(row.revision);

  const sets = ['revision = revision + 1', 'updated_at = ?'];
  const params = [new Date().toISOString()];
  for (const name of names) {
    sets.push(`${name} = ?`);
    params.push(name === 'document' ? JSON.stringify(src.document) : src[name]);
  }
  params.push(id, revision);
  const result = db.prepare(
    `UPDATE free_canvases SET ${sets.join(', ')} WHERE id = ? AND revision = ?`
  ).run(...params);
  if (result.changes === 0) {
    const current = loadCanvasRow(db, id);
    if (!current) return missingCanvasResult();
    return staleCanvasResult(current.revision);
  }
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
