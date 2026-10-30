/**
 * 本地图片/媒体按「工程目录」分层：projects/{id}_{日期}_{固化剧名}/…
 * - 公共素材、无 drama_id 的生成物 → library/{category}/…
 * - storage_folder_label 写入 dramas.metadata，避免用户改剧名后新文件落到另一目录导致分裂
 */

const PROJECTS = 'projects';
const LIBRARY = 'library';

function sanitizeFolderLabel(title) {
  let s = String(title || 'untitled').trim().slice(0, 20);
  s = s.replace(/[\\/:*?"<>|#\x00-\x1f]/g, '_').replace(/\s+/g, '_');
  return s || 'untitled';
}

function parseMetadata(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (_) {
    return {};
  }
}

/**
 * 缺省时把 storage_folder_label 写入 dramas.metadata（只写一次）
 * @returns {object} 更新后的 drama 行字段（含 metadata 字符串）
 */
function ensureDramaStorageFolderLabel(db, dramaRow) {
  if (!dramaRow || !dramaRow.id) return dramaRow;
  const meta = parseMetadata(dramaRow.metadata);
  if (meta.storage_folder_label && String(meta.storage_folder_label).trim()) {
    return dramaRow;
  }
  const label = sanitizeFolderLabel(dramaRow.title);
  meta.storage_folder_label = label;
  const metaStr = JSON.stringify(meta);
  try {
    db.prepare('UPDATE dramas SET metadata = ?, updated_at = ? WHERE id = ?').run(
      metaStr,
      new Date().toISOString(),
      dramaRow.id
    );
  } catch (_) {}
  return { ...dramaRow, metadata: metaStr };
}

function datePrefixFromCreatedAt(iso) {
  if (!iso) return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const d = String(iso).slice(0, 10).replace(/-/g, '');
  return d || new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * 由剧集行构造稳定相对目录（不含 category）
 */
function buildProjectRelativeDir(dramaRow) {
  const id = String(Number(dramaRow.id) || 0).padStart(4, '0');
  const datePart = datePrefixFromCreatedAt(dramaRow.created_at);
  const meta = parseMetadata(dramaRow.metadata);
  const labelSrc = meta.storage_folder_label || dramaRow.title;
  const label = sanitizeFolderLabel(labelSrc);
  return `${PROJECTS}/${id}_${datePart}_${label}`;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number|null|undefined} dramaId
 * @returns {string} 相对 storage 根的前缀：projects/… 或 library
 */
function getProjectStorageSubdir(db, dramaId) {
  const id = Number(dramaId);
  if (!id || id <= 0) return LIBRARY;
  let row = db.prepare(
    'SELECT id, title, created_at, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL'
  ).get(id);
  if (!row) return LIBRARY;
  row = ensureDramaStorageFolderLabel(db, row);
  return buildProjectRelativeDir(row);
}

module.exports = {
  PROJECTS,
  LIBRARY,
  sanitizeFolderLabel,
  parseMetadata,
  ensureDramaStorageFolderLabel,
  buildProjectRelativeDir,
  getProjectStorageSubdir,
};
