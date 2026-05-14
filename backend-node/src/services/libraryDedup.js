const crypto = require('crypto');

const KNOWN_TABLES = new Set([
  'character_libraries',
  'scene_libraries',
  'prop_libraries',
]);

const columnCache = new WeakMap();

function assertKnownTable(table) {
  if (!KNOWN_TABLES.has(table)) {
    throw new Error(`Unknown library table: ${table}`);
  }
}

function hasColumn(db, table, column) {
  assertKnownTable(table);
  let tableCache = columnCache.get(db);
  if (!tableCache) {
    tableCache = new Map();
    columnCache.set(db, tableCache);
  }
  const key = `${table}.${column}`;
  if (tableCache.has(key)) return tableCache.get(key);
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const found = columns.some((row) => row.name === column);
  tableCache.set(key, found);
  return found;
}

function normalizeSourceId(id) {
  if (id == null) return '';
  return String(id).trim();
}

function normalizePathRef(value) {
  let s = String(value || '').trim();
  if (!s) return '';
  s = s.replace(/\\/g, '/');
  s = s.replace(/^\/?static\//i, '');
  s = s.replace(/^\/+/, '');
  return s;
}

function refKey(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.startsWith('data:')) {
    return `data:${crypto.createHash('sha256').update(s).digest('hex')}`;
  }
  if (/^https?:\/\//i.test(s)) return `url:${s}`;
  const pathRef = normalizePathRef(s);
  return pathRef ? `path:${pathRef}` : '';
}

function identityKeys(row) {
  const keys = new Set();
  const sourceId = normalizeSourceId(row.source_id);
  if (sourceId && row.source_type) keys.add(`source:${row.source_type}:${sourceId}`);
  const imageKey = refKey(row.image_url);
  const pathKey = refKey(row.local_path);
  if (imageKey) keys.add(imageKey);
  if (pathKey) keys.add(pathKey);
  return keys;
}

function findExistingLibraryItem(db, table, { dramaId, sourceType, sourceId, imageUrl, localPath }) {
  assertKnownTable(table);
  const scopeSql = dramaId == null ? 'drama_id IS NULL' : 'drama_id = ?';
  const params = dramaId == null ? [sourceType] : [sourceType, Number(dramaId)];
  const rows = db.prepare(
    `SELECT * FROM ${table} WHERE deleted_at IS NULL AND source_type = ? AND ${scopeSql} ORDER BY id ASC`
  ).all(...params);

  const wanted = identityKeys({
    source_type: sourceType,
    source_id: normalizeSourceId(sourceId),
    image_url: imageUrl,
    local_path: localPath,
  });
  if (wanted.size === 0) return null;

  return rows.find((row) => {
    const existing = identityKeys(row);
    for (const key of wanted) {
      if (existing.has(key)) return true;
    }
    return false;
  }) || null;
}

function insertLibraryItem(db, table, fields) {
  assertKnownTable(table);
  const entries = Object.entries(fields)
    .filter(([name, value]) => value !== undefined && (name !== 'source_id' || hasColumn(db, table, 'source_id')));
  const names = entries.map(([name]) => name);
  const placeholders = names.map(() => '?').join(', ');
  const values = entries.map(([, value]) => value);
  return db.prepare(
    `INSERT INTO ${table} (${names.join(', ')}) VALUES (${placeholders})`
  ).run(...values);
}

function updateLibraryItem(db, table, id, fields) {
  assertKnownTable(table);
  const entries = Object.entries(fields)
    .filter(([name, value]) => value !== undefined && (name !== 'source_id' || hasColumn(db, table, 'source_id')));
  if (entries.length === 0) return;
  const assignments = entries.map(([name]) => `${name} = ?`);
  const values = entries.map(([, value]) => value);
  values.push(Number(id));
  db.prepare(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?`).run(...values);
}

function parseSourceIds(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeSourceId).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function appendSourceIdFilters(query, sql, params) {
  if (query.source_id) {
    sql += ' AND source_id = ?';
    params.push(normalizeSourceId(query.source_id));
  }
  const sourceIds = parseSourceIds(query.source_ids);
  if (sourceIds.length > 0) {
    sql += ` AND source_id IN (${sourceIds.map(() => '?').join(', ')})`;
    params.push(...sourceIds);
  }
  return sql;
}

module.exports = {
  appendSourceIdFilters,
  findExistingLibraryItem,
  insertLibraryItem,
  updateLibraryItem,
  normalizeSourceId,
};
