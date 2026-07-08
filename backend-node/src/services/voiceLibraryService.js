const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const omnivoiceService = require('./omnivoiceService');
const elevenlabsService = require('./elevenlabsService');

const DEFAULT_DESIGN_SAMPLE_TEXT = 'Hello, this is a test of a newly designed voice for a character in the story.';

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

async function importFromElevenLabs(db, log, storageBase, req) {
  const voiceId = (req.voice_id || '').trim();
  if (!voiceId) throw new Error('voice_id 不能为空');
  if (!req.name || !req.name.trim()) throw new Error('name 不能为空');
  const { apiKey, baseUrl } = elevenlabsService.getElevenLabsConfig(db);
  const sampleText = elevenlabsService.ELEVENLABS_SAMPLE_TEXT;
  const audioBuffer = await elevenlabsService.fetchSampleAudio(apiKey, baseUrl, voiceId, sampleText);
  const dir = voiceLibraryDir(storageBase);
  const filename = `el_${voiceId}_${randomUUID().slice(0, 8)}.mp3`;
  fs.writeFileSync(path.join(dir, filename), audioBuffer);
  return insertVoice(db, log, {
    name: req.name,
    description: req.description,
    gender: req.gender,
    age_range: req.age_range,
    tags: req.tags,
    source: 'elevenlabs',
    source_ref: voiceId,
    ref_audio_path: `voice_library/${filename}`,
    ref_text: sampleText,
    language: req.language || 'en',
  });
}

async function previewDesign(db, log, storageBase, req) {
  const instruct = (req.instruct || '').trim();
  if (!instruct) throw new Error('instruct 不能为空');
  const sampleText = (req.sample_text || '').trim() || DEFAULT_DESIGN_SAMPLE_TEXT;
  const { baseUrl } = omnivoiceService.getOmnivoiceConfig(db);
  const audioBuffer = await omnivoiceService.synthesizeDesign(sampleText, instruct, baseUrl);
  const tmpDir = voiceLibraryTmpDir(storageBase);
  const filename = `design_preview_${randomUUID().slice(0, 12)}.wav`;
  fs.writeFileSync(path.join(tmpDir, filename), audioBuffer);
  return {
    temp_path: `voice_library/tmp/${filename}`,
    sample_url: `/static/voice_library/tmp/${filename}`,
    sample_text: sampleText,
    instruct,
  };
}

function saveDesign(db, log, storageBase, req) {
  const tempPath = req.temp_path || '';
  if (!tempPath.startsWith('voice_library/tmp/')) throw new Error('无效的 temp_path');
  const absTemp = path.join(storageBase, tempPath);
  if (!fs.existsSync(absTemp)) throw new Error('试听音频已过期，请重新生成');
  if (!req.name || !req.name.trim()) throw new Error('name 不能为空');
  if (!req.instruct || !req.instruct.trim()) throw new Error('instruct 不能为空');
  if (!req.sample_text || !req.sample_text.trim()) throw new Error('sample_text 不能为空');
  const dir = voiceLibraryDir(storageBase);
  const filename = `design_${randomUUID().slice(0, 8)}.wav`;
  fs.copyFileSync(absTemp, path.join(dir, filename));
  fs.unlinkSync(absTemp);
  return insertVoice(db, log, {
    name: req.name,
    description: req.description,
    gender: req.gender,
    age_range: req.age_range,
    tags: req.tags,
    source: 'design',
    source_ref: req.instruct,
    ref_audio_path: `voice_library/${filename}`,
    ref_text: req.sample_text,
    language: req.language || 'en',
  });
}

async function testSynthesize(db, log, storageBase, req) {
  const voice = getVoice(db, req.voice_id);
  if (!voice) throw new Error('语音不存在');
  const text = (req.text || '').trim();
  if (!text) throw new Error('text 不能为空');
  const { baseUrl } = omnivoiceService.getOmnivoiceConfig(db);
  const absRefAudio = path.join(storageBase, voice.ref_audio_path);
  const audioBuffer = await omnivoiceService.synthesizeCloning(text, absRefAudio, voice.ref_text, baseUrl);
  const tmpDir = voiceLibraryTmpDir(storageBase);
  const filename = `preview_${randomUUID().slice(0, 12)}.wav`;
  fs.writeFileSync(path.join(tmpDir, filename), audioBuffer);
  return { sample_url: `/static/voice_library/tmp/${filename}` };
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
  importFromElevenLabs,
  previewDesign,
  saveDesign,
  testSynthesize,
  DEFAULT_DESIGN_SAMPLE_TEXT,
};
