function normalizeStorageRelPath(p) {
  let s = String(p || '').trim().replace(/^[/\\]+/, '').split('?')[0];
  s = s.replace(/\\/g, '/').replace(/\/+$/, '');
  return s;
}

function normImageUrlKey(u) {
  return String(u || '').trim().split('?')[0];
}

function parseSeedance2Asset(val) {
  if (val == null || val === '') return null;
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch (_) {
    return null;
  }
}

function normAssetStatus(raw) {
  return String(raw || '').trim().toLowerCase();
}

function markStaleOnCharacterMainImageDrift(db, log, prevRow, nextPatch) {
  if (!db || !prevRow || !prevRow.id) return;
  const nextLp = normalizeStorageRelPath(
    nextPatch.local_path !== undefined ? nextPatch.local_path : prevRow.local_path || ''
  );
  const nextImg = normImageUrlKey(
    nextPatch.image_url !== undefined ? nextPatch.image_url : prevRow.image_url || ''
  );
  const oldLp = normalizeStorageRelPath(prevRow.local_path || '');
  const oldImg = normImageUrlKey(prevRow.image_url || '');
  if (oldLp === nextLp && oldImg === nextImg) return;
  const asset = parseSeedance2Asset(prevRow.seedance2_asset);
  if (!asset) return;

  const status = normAssetStatus(asset.status);

  if (status === 'stale') {
    const certLp = normalizeStorageRelPath(asset.certified_local_path || '');
    const certImg = normImageUrlKey(asset.certified_image_url || '');
    const lpHit = !!(certLp && nextLp && certLp === nextLp);
    const imgHit = !!(certImg && nextImg && certImg === nextImg);
    if (lpHit || imgHit) {
      const now = new Date().toISOString();
      const merged = {
        ...asset,
        status: 'active',
        stale_reason: null,
        updated_at: now,
        restored_from_stale_at: now,
      };
      try {
        db.prepare('UPDATE characters SET seedance2_asset = ?, updated_at = ? WHERE id = ?').run(
          JSON.stringify(merged),
          now,
          Number(prevRow.id)
        );
      } catch (_) {}
      return;
    }
    return;
  }

  if (status !== 'active') return;
  const now = new Date().toISOString();
  const merged = {
    ...asset,
    status: 'stale',
    stale_reason: 'character_main_image_changed',
    updated_at: now,
  };
  db.prepare('UPDATE characters SET seedance2_asset = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(merged),
    now,
    Number(prevRow.id)
  );
  log?.info?.('[SD2认证] 角色主图已变更，状态标记为 stale', {
    character_id: prevRow.id,
  });
}

function parseSeedance2VoiceAsset(val) {
  return parseSeedance2Asset(val);
}

function markStaleOnCharacterVoiceDrift(db, log, prevRow, nextPatch) {
  if (!db || !prevRow || !prevRow.id) return;
  const nextVoice = normalizeStorageRelPath(
    nextPatch.seedance2_voice_local_path !== undefined
      ? nextPatch.seedance2_voice_local_path
      : prevRow.seedance2_voice_local_path || ''
  );
  const oldVoice = normalizeStorageRelPath(prevRow.seedance2_voice_local_path || '');
  if (oldVoice === nextVoice) return;

  const asset = parseSeedance2VoiceAsset(prevRow.seedance2_voice_asset);
  if (!asset) return;

  const status = normAssetStatus(asset.status);
  if (status === 'stale') {
    const certVoice = normalizeStorageRelPath(asset.certified_local_path || '');
    if (certVoice && nextVoice && certVoice === nextVoice) {
      const now = new Date().toISOString();
      const merged = {
        ...asset,
        status: 'active',
        stale_reason: null,
        updated_at: now,
        restored_from_stale_at: now,
      };
      try {
        db.prepare('UPDATE characters SET seedance2_voice_asset = ?, updated_at = ? WHERE id = ?').run(
          JSON.stringify(merged),
          now,
          Number(prevRow.id)
        );
      } catch (_) {}
      return;
    }
    return;
  }

  if (status !== 'active') return;
  const now = new Date().toISOString();
  const merged = {
    ...asset,
    status: 'stale',
    stale_reason: 'character_voice_changed',
    updated_at: now,
  };
  db.prepare('UPDATE characters SET seedance2_voice_asset = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(merged),
    now,
    Number(prevRow.id)
  );
  log?.info?.('[SD2认证] 角色语音参考已变更，状态标记为 stale', {
    character_id: prevRow.id,
  });
}

module.exports = {
  normalizeStorageRelPath,
  markStaleOnCharacterMainImageDrift,
  markStaleOnCharacterVoiceDrift,
  parseSeedance2Asset,
  parseSeedance2VoiceAsset,
};
