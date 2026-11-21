// 输入指纹：每个产出（定妆照、场景图、分镜、首帧、视频）记住“我是用哪一版上游做出来的”。
// 上游一改，指纹对不上，体检面板就把这一项标成过期。规范见 PIPELINE-SPEC.md 第 C 阶段。
//
// 不需要改动各处生成代码：每次观察时，如果产出是新的（或第一次见到），就按当前上游记下指纹；
// 如果产出没变而上游变了，就是过期。制作页每次刷新项目数据都会观察一次。
const crypto = require('crypto');
const { normalizeCharacterRefs } = require('./pipelineRules');

const KINDS = ['look', 'scene_image', 'storyboards', 'frame', 'video'];

function hash(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 12);
}

function ensureTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS pipeline_stamps (
    kind TEXT NOT NULL, target_id INTEGER NOT NULL, drama_id INTEGER NOT NULL,
    output_sig TEXT NOT NULL, input TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY (kind, target_id)
  )`);
}

const media = (row) => (row && (row.local_path || row.image_url)) || '';

/** 读出当前项目的全部产出与它们的上游，算出每个产出的“产出签名”和“输入指纹（分项）”。 */
function currentItems(db, dramaId) {
  const id = Number(dramaId);
  const characters = db.prepare('SELECT id, name, appearance, image_url, local_path FROM characters WHERE drama_id = ? AND deleted_at IS NULL').all(id);
  const scenes = db.prepare('SELECT id, location, time, prompt, image_url, local_path FROM scenes WHERE drama_id = ? AND deleted_at IS NULL').all(id);
  const episodes = db.prepare('SELECT id, episode_number, script_content FROM episodes WHERE drama_id = ? AND deleted_at IS NULL').all(id);
  const shots = db.prepare(`SELECT s.* FROM storyboards s JOIN episodes e ON e.id = s.episode_id
    WHERE e.drama_id = ? AND e.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY s.episode_id, s.storyboard_number`).all(id);
  const latest = (table) => {
    const map = new Map();
    for (const r of db.prepare(`SELECT g.storyboard_id, g.id FROM ${table} g JOIN storyboards s ON s.id = g.storyboard_id
      JOIN episodes e ON e.id = s.episode_id WHERE e.drama_id = ? AND g.status = 'completed' AND g.deleted_at IS NULL
      ORDER BY g.id`).all(id)) map.set(r.storyboard_id, r.id);
    return map;
  };
  const frameGen = latest('image_generations');
  const videoGen = latest('video_generations');
  const charById = new Map(characters.map((c) => [c.id, c]));
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const epById = new Map(episodes.map((e) => [e.id, e]));

  const items = [];
  for (const c of characters) {
    if (!media(c)) continue;
    items.push({ kind: 'look', target: c.id, output: media(c), input: { appearance: hash(c.appearance || '') }, label: c.name });
  }
  for (const s of scenes) {
    if (!media(s)) continue;
    items.push({ kind: 'scene_image', target: s.id, output: media(s), input: { scene: hash([s.location, s.time, s.prompt]) },
      label: `${s.location || '未命名场景'}${s.time ? `（${s.time}）` : ''}` });
  }
  const shotsByEp = new Map();
  for (const sh of shots) {
    if (!shotsByEp.has(sh.episode_id)) shotsByEp.set(sh.episode_id, []);
    shotsByEp.get(sh.episode_id).push(sh);
  }
  for (const [epId, list] of shotsByEp) {
    const ep = epById.get(epId);
    if (!ep) continue;
    items.push({ kind: 'storyboards', target: epId, output: hash(list.map((s) => s.id)), input: { script: hash(ep.script_content || '') },
      label: `第${ep.episode_number}集`, episode: ep.episode_number });
  }
  for (const sh of shots) {
    const ep = epById.get(sh.episode_id);
    const where = { label: `第${ep?.episode_number ?? '?'}集第${sh.storyboard_number}镜`, episode: ep?.episode_number, shot: sh.storyboard_number };
    const frameOutput = media(sh) || (frameGen.has(sh.id) ? `gen:${frameGen.get(sh.id)}` : '');
    if (frameOutput) {
      const ids = normalizeCharacterRefs(sh.characters, characters).ids.slice().sort((a, b) => a - b);
      items.push({ kind: 'frame', target: sh.id, output: frameOutput, ...where, input: {
        shot: hash([sh.shot_type, sh.angle, sh.movement, sh.action, sh.description, sh.image_prompt, sh.layout_description, sh.location, sh.time]),
        looks: hash(ids.map((cid) => [cid, media(charById.get(cid))])),
        scene: hash([sh.scene_id, media(sceneById.get(sh.scene_id))]),
      } });
    }
    const videoOutput = sh.video_url || (videoGen.has(sh.id) ? `gen:${videoGen.get(sh.id)}` : '');
    if (videoOutput) {
      items.push({ kind: 'video', target: sh.id, output: videoOutput, ...where, input: {
        frame: hash(frameOutput),
        motion: hash([sh.action, sh.movement, sh.video_prompt, sh.dialogue, sh.duration]),
      } });
    }
  }
  return items;
}

const REASONS = {
  appearance: '外貌改过', scene: '场景描述改过', script: '剧本改过',
  shot: '画面描述改过', looks: '定妆照换过', frame: '首帧换过', motion: '动作或台词改过',
};

/**
 * 观察一次：新产出记下指纹，旧产出比对指纹。返回过期清单
 * [{ kind, target, label, episode?, shot?, reasons: ['外貌改过', ...] }]。
 */
function observe(db, dramaId) {
  ensureTable(db);
  const items = currentItems(db, dramaId);
  const now = new Date().toISOString();
  const stamps = new Map(db.prepare('SELECT kind, target_id, output_sig, input FROM pipeline_stamps WHERE drama_id = ?')
    .all(Number(dramaId)).map((r) => [`${r.kind}:${r.target_id}`, r]));
  const upsert = db.prepare(`INSERT INTO pipeline_stamps (kind, target_id, drama_id, output_sig, input, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (kind, target_id) DO UPDATE SET drama_id = excluded.drama_id, output_sig = excluded.output_sig, input = excluded.input, updated_at = excluded.updated_at`);
  const stale = [];
  const seen = new Set();
  db.transaction(() => {
    for (const item of items) {
      const key = `${item.kind}:${item.target}`;
      seen.add(key);
      const stamp = stamps.get(key);
      if (!stamp || stamp.output_sig !== item.output) {
        upsert.run(item.kind, item.target, Number(dramaId), item.output, JSON.stringify(item.input), now);
        continue;
      }
      let before = {};
      try { before = JSON.parse(stamp.input); } catch (_) { /* 损坏按全新处理 */ }
      const changed = Object.keys(item.input).filter((k) => before[k] !== item.input[k]);
      if (changed.length) {
        const { input, output, ...rest } = item;
        stale.push({ ...rest, reasons: changed.map((k) => REASONS[k] || k) });
      }
    }
    // 产出删掉了，指纹也一并清掉，下次重新生成时重新记录
    for (const key of stamps.keys()) {
      if (seen.has(key)) continue;
      const [kind, target] = key.split(':');
      db.prepare('DELETE FROM pipeline_stamps WHERE kind = ? AND target_id = ?').run(kind, Number(target));
    }
  })();
  return stale;
}

/** “不重做，按当前版本确认”：把某一类过期项的指纹更新为当前上游。返回确认了几项。 */
function accept(db, dramaId, kind) {
  if (!KINDS.includes(kind)) throw new Error(`unknown stamp kind ${kind}`);
  const stale = new Set(observe(db, dramaId).filter((s) => s.kind === kind).map((s) => s.target));
  if (!stale.size) return 0;
  const now = new Date().toISOString();
  const update = db.prepare('UPDATE pipeline_stamps SET input = ?, updated_at = ? WHERE kind = ? AND target_id = ?');
  db.transaction(() => {
    for (const item of currentItems(db, dramaId)) {
      if (item.kind === kind && stale.has(item.target)) update.run(JSON.stringify(item.input), now, kind, item.target);
    }
  })();
  return stale.size;
}

module.exports = { observe, accept, KINDS };
