const fs = require('fs');
const path = require('path');

function rowToVoice(r) {
  let tags = [];
  try { tags = r.tags ? JSON.parse(r.tags) : []; } catch (_) { tags = []; }
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    gender: r.gender,
    age_range: r.age_range,
    tags,
    source: r.source,
    source_ref: r.source_ref,
    ref_audio_path: r.ref_audio_path,
    ref_text: r.ref_text,
    sample_url: r.sample_url || (r.ref_audio_path ? '/static/' + r.ref_audio_path : ''),
    language: r.language,
    is_active: !!r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function listVoices(db, filters = {}) {
  let sql = 'SELECT * FROM voice_library WHERE deleted_at IS NULL';
  const params = [];
  if (filters.gender) { sql += ' AND gender = ?'; params.push(filters.gender); }
  if (filters.source) { sql += ' AND source = ?'; params.push(filters.source); }
  if (filters.tag) { sql += ' AND tags LIKE ?'; params.push('%"' + filters.tag + '"%'); }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToVoice);
}

function getVoice(db, id) {
  const row = db.prepare('SELECT * FROM voice_library WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  return row ? rowToVoice(row) : null;
}

function countCharacterUsage(db, voiceId) {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM characters WHERE voice_id = ? AND deleted_at IS NULL').get(Number(voiceId));
  return row ? row.cnt : 0;
}

function deleteVoice(db, log, id, force) {
  const row = db.prepare('SELECT id FROM voice_library WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  if (!row) return { ok: false, error: 'not_found' };
  const usageCount = countCharacterUsage(db, id);
  if (usageCount > 0 && !force) {
    return { ok: false, error: 'in_use', usageCount };
  }
  const now = new Date().toISOString();
  if (force && usageCount > 0) {
    db.prepare('UPDATE characters SET voice_id = NULL WHERE voice_id = ? AND deleted_at IS NULL').run(Number(id));
  }
  db.prepare('UPDATE voice_library SET deleted_at = ? WHERE id = ?').run(now, Number(id));
  log.info('Voice library item deleted', { id, usageCount, force: !!force });
  return { ok: true };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function voiceLibraryDir(storageBase) {
  const dir = path.join(storageBase, 'voice_library');
  ensureDir(dir);
  return dir;
}

function voiceLibraryTmpDir(storageBase) {
  const dir = path.join(storageBase, 'voice_library', 'tmp');
  ensureDir(dir);
  return dir;
}

function insertVoice(db, log, fields) {
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO voice_library (name, description, gender, age_range, tags, source, source_ref, ref_audio_path, ref_text, sample_url, language, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    fields.name || '',
    fields.description || null,
    fields.gender || null,
    fields.age_range || null,
    fields.tags ? JSON.stringify(fields.tags) : null,
    fields.source,
    fields.source_ref || null,
    fields.ref_audio_path,
    fields.ref_text,
    '/static/' + fields.ref_audio_path,
    fields.language || 'en',
    now,
    now
  );
  log.info('Voice library item created', { id: info.lastInsertRowid, source: fields.source });
  return getVoice(db, info.lastInsertRowid);
}

module.exports = {
  rowToVoice,
  listVoices,
  getVoice,
  countCharacterUsage,
  deleteVoice,
  ensureDir,
  voiceLibraryDir,
  voiceLibraryTmpDir,
  insertVoice,
};
