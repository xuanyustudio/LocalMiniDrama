// 放行闸门：一个镜头要生成首帧或视频，它用到的人物必须已有定妆照、场景必须已有场景图。
// 否则画出来的人和场景每镜都不一样，钱白花。规范见 PIPELINE-SPEC.md 第 C 阶段。
const { normalizeCharacterRefs } = require('./pipelineRules');

class PipelineGateError extends Error {
  constructor(message, blockers) {
    super(message);
    this.name = 'PipelineGateError';
    this.blockers = blockers;
  }
}

const media = (row) => !!(row && (row.local_path || row.image_url));

function loadDramaCast(db, dramaId) {
  return {
    characters: db.prepare('SELECT id, name, image_url, local_path FROM characters WHERE drama_id = ? AND deleted_at IS NULL').all(dramaId),
    scenes: new Map(db.prepare('SELECT id, location, time, image_url, local_path FROM scenes WHERE drama_id = ? AND deleted_at IS NULL')
      .all(dramaId).map((s) => [s.id, s])),
  };
}

/** 单个镜头能不能生成画面/视频。blockers 不为空就不放行；warnings 只提示。 */
function readiness(shot, cast) {
  const blockers = [];
  const warnings = [];
  const { ids } = normalizeCharacterRefs(shot.characters, cast.characters);
  const byId = new Map(cast.characters.map((c) => [c.id, c]));
  const noLook = ids.map((id) => byId.get(id)).filter((c) => c && !media(c)).map((c) => c.name);
  if (noLook.length) blockers.push(`人物「${noLook.join('、')}」还没有定妆照`);
  if (shot.scene_id) {
    const scene = cast.scenes.get(Number(shot.scene_id));
    if (!scene) warnings.push('关联的场景已被删除');
    else if (!media(scene)) blockers.push(`场景「${scene.location || '未命名'}${scene.time ? `·${scene.time}` : ''}」还没有场景图`);
  } else {
    warnings.push('没有关联场景，画面背景可能每镜不一样');
  }
  return { ok: blockers.length === 0, blockers, warnings };
}

function shotRow(db, storyboardId) {
  return db.prepare(`SELECT s.id, s.storyboard_number, s.characters, s.scene_id, e.drama_id, e.episode_number
    FROM storyboards s JOIN episodes e ON e.id = s.episode_id
    WHERE s.id = ? AND s.deleted_at IS NULL AND e.deleted_at IS NULL`).get(Number(storyboardId));
}

function shotReadiness(db, storyboardId) {
  const shot = shotRow(db, storyboardId);
  if (!shot) return null;
  return { storyboard_id: shot.id, ...readiness(shot, loadDramaCast(db, shot.drama_id)) };
}

/** 整集每个镜头的放行情况，供制作页按钮显示原因。 */
function episodeReadiness(db, episodeId) {
  const ep = db.prepare('SELECT id, drama_id FROM episodes WHERE id = ? AND deleted_at IS NULL').get(Number(episodeId));
  if (!ep) return { shots: {} };
  const cast = loadDramaCast(db, ep.drama_id);
  const shots = {};
  for (const shot of db.prepare('SELECT id, characters, scene_id FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL').all(ep.id)) {
    shots[shot.id] = readiness(shot, cast);
  }
  return { shots };
}

/**
 * 生成首帧/视频前调用。镜头不放行时抛出 PipelineGateError。
 * 人物定妆照、场景图本身的生成请求（带 character_id / 没有 storyboard_id）不受影响。
 */
function assertShotReady(db, body, what) {
  if (!body || body.storyboard_id == null || body.character_id != null) return;
  const shot = shotRow(db, body.storyboard_id);
  if (!shot) return;
  const r = readiness(shot, loadDramaCast(db, shot.drama_id));
  if (r.ok) return;
  throw new PipelineGateError(`第${shot.episode_number}集第${shot.storyboard_number}镜暂不能生成${what}：${r.blockers.join('；')}。请先补齐，再生成。`, r.blockers);
}

module.exports = { PipelineGateError, shotReadiness, episodeReadiness, assertShotReady, readiness };
