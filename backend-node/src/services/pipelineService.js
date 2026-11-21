// 流水线体检：按 PIPELINE-SPEC.md 的九个工位逐个检查一部剧，并提供免费的一键修复。
// 只读数据库和原稿、不调用任何模型；另外记录各产出的输入指纹（pipeline_stamps），用来提示过期。
const bibles = require('./storyBibleService');
const rules = require('./pipelineRules');
const stamps = require('./pipelineStamps');
const pipelineGate = require('./pipelineGate');

const STAGES = [
  ['source', '原著'], ['bible', '故事档案'], ['script', '剧本'], ['storyboard', '拍摄本'],
  ['look', '人物定妆'], ['scene', '场景'], ['image', '画面'], ['video', '视频/配音'], ['final', '成片'],
];

const ROLE_CODES = { 主角: 'main', 男主: 'main', 女主: 'main', 配角: 'supporting', 反派: 'supporting', 次要角色: 'minor' };

function hasMedia(row) {
  return Boolean(row && (row.local_path || row.image_url));
}

function parseIds(value) {
  try {
    const list = JSON.parse(value || '[]');
    return Array.isArray(list) ? list : [];
  } catch (_) { return []; }
}

/** 镜头里在画面中说话的人物 id（画外音、旁白、电话里的声音不算出场）。 */
function speakerIds(shot, characters) {
  return rules.normalizeCharacterRefs(rules.shotSpeakers(shot.dialogue).onscreen, characters).ids;
}

function episodeSeconds(ep, shots) {
  const total = shots.reduce((sum, s) => sum + (Number(s.duration) > 0 ? Number(s.duration) : 0), 0);
  if (total > 0) return total;
  const d = Number(ep.duration) || 0;
  // episodes.duration 以分钟计；早期版本误存过秒数，大于 10 的按秒处理
  return d > 10 ? d : d > 0 ? d * 60 : 60;
}

function load(db, dramaId) {
  const id = Number(dramaId);
  const episodes = db.prepare(`SELECT id, episode_number, title, description, script_content, duration, video_url, source_chapter
    FROM episodes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY episode_number, id`).all(id);
  const characters = db.prepare(`SELECT id, name, role, appearance, personality, image_url, local_path
    FROM characters WHERE drama_id = ? AND deleted_at IS NULL ORDER BY sort_order, id`).all(id);
  const scenes = db.prepare(`SELECT id, location, time, prompt, image_url, local_path
    FROM scenes WHERE drama_id = ? AND deleted_at IS NULL`).all(id);
  const shots = db.prepare(`SELECT s.id, s.episode_id, s.storyboard_number, s.location, s.time, s.scene_id, s.characters, s.duration,
      s.dialogue, s.image_url, s.local_path, s.video_url, s.audio_local_path
    FROM storyboards s JOIN episodes e ON e.id = s.episode_id
    WHERE e.drama_id = ? AND e.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY s.episode_id, s.storyboard_number, s.id`).all(id);
  const shotImages = new Set(db.prepare(`SELECT DISTINCT g.storyboard_id FROM image_generations g JOIN storyboards s ON s.id = g.storyboard_id
    JOIN episodes e ON e.id = s.episode_id WHERE e.drama_id = ? AND g.status IN ('completed','succeeded') AND g.deleted_at IS NULL
    AND (g.local_path IS NOT NULL OR g.image_url IS NOT NULL)`).all(id).map((r) => r.storyboard_id));
  const shotVideos = new Set(db.prepare(`SELECT DISTINCT g.storyboard_id FROM video_generations g JOIN storyboards s ON s.id = g.storyboard_id
    JOIN episodes e ON e.id = s.episode_id WHERE e.drama_id = ? AND g.status IN ('completed','succeeded') AND g.deleted_at IS NULL
    AND (g.local_path IS NOT NULL OR g.video_url IS NOT NULL)`).all(id).map((r) => r.storyboard_id));
  return { id, episodes, characters, scenes, shots, shotImages, shotVideos, bible: bibles.getBible(db, id).bible };
}

/** 档案 → 人物表的同步计划：要新建的人物、外貌/性格要更新的人物。 */
function bibleSyncPlan(data) {
  const create = [];
  const update = [];
  for (const person of data.bible.characters) {
    const row = data.characters.find((c) => c.name === person.name)
      || data.characters.find((c) => rules.findBibleCharacter({ characters: [person] }, c.name));
    const appearance = rules.composeAppearance(person);
    if (!row) { create.push({ person, appearance }); continue; }
    const changes = {};
    if (appearance && appearance !== String(row.appearance || '').trim()) changes.appearance = appearance;
    if (person.personality && person.personality !== String(row.personality || '').trim()) changes.personality = person.personality;
    if (Object.keys(changes).length) update.push({ row, changes });
  }
  return { create, update };
}

function stageResult(key, issues, okDetail) {
  const level = issues.some((i) => i.level === 'missing') ? 'missing' : issues.some((i) => i.level === 'warn') ? 'warn' : 'ok';
  return { key, name: STAGES.find(([k]) => k === key)[1], status: level, detail: level === 'ok' ? okDetail : '', issues };
}

/** 把过期清单按类型整理成体检问题；同一集同一原因的镜头合并成一条。 */
function staleIssues(stale, kind) {
  const list = stale.filter((s) => s.kind === kind);
  if (!list.length) return [];
  const accept = { action: `accept-stale-${kind}`, label: STALE_ACCEPT_LABELS[kind] };
  if (kind === 'frame' || kind === 'video') {
    const groups = new Map();
    for (const s of list) {
      const key = `${s.episode}|${s.reasons.join('、')}`;
      if (!groups.has(key)) groups.set(key, { episode: s.episode, reasons: s.reasons.join('、'), shots: [] });
      groups.get(key).shots.push(s.shot);
    }
    const what = kind === 'frame' ? '首帧' : '视频';
    const issues = [...groups.values()].map((g) => ({ level: 'warn',
      text: `第${g.episode}集第 ${g.shots.slice(0, 8).join('、')}${g.shots.length > 8 ? ` 等 ${g.shots.length} ` : ' '}镜${what}已过期（${g.reasons}），需要重新生成。` }));
    issues[issues.length - 1].fix = accept;
    return issues;
  }
  const text = {
    look: (s) => `${s.label}的定妆照已过期（${s.reasons.join('、')}），照片还是按旧描述生成的。`,
    scene_image: (s) => `${s.label}的场景图已过期（${s.reasons.join('、')}）。`,
    storyboards: (s) => `${s.label}的剧本在拆分镜之后改过，分镜可能和剧本对不上，建议重新生成分镜。`,
  }[kind];
  const issues = list.map((s) => ({ level: 'warn', text: text(s) }));
  issues[issues.length - 1].fix = accept;
  return issues;
}

const STALE_ACCEPT_LABELS = {
  look: '不重做，确认当前照片', scene_image: '不重做，确认当前场景图', storyboards: '改动很小，确认当前分镜',
  frame: '不重做，确认当前首帧', video: '不重做，确认当前视频',
};

function report(db, dramaId, adaptation) {
  let stale = [];
  try { stale = stamps.observe(db, dramaId); } catch (_) { stale = []; }
  const data = load(db, dramaId);
  const { episodes, characters, scenes, shots, shotImages, shotVideos, bible } = data;
  const epLabel = (ep) => `第${ep.episode_number}集`;
  const shotsOf = (ep) => shots.filter((s) => s.episode_id === ep.id);
  const out = [];

  // 0 原著
  let source = null;
  try { source = adaptation?.sourceOverview(data.id) || null; } catch (_) { source = null; }
  out.push(stageResult('source', source ? [] : [{ level: 'warn', text: '没有上传原著 TXT。直接写剧本也可以，但人物和事实就没有原文可对照。' }],
    source ? `${source.name}，${source.chapters.length} 章${source.removed_notes ? `；已自动过滤 ${source.removed_notes} 处作者附言/署名，不会送进 AI` : ''}` : ''));

  // 1 故事档案
  const bibleIssues = [];
  if (!bible.characters.length && !bible.logline) {
    bibleIssues.push({ level: 'missing', text: '故事档案是空的。先整理人物、地点和关键事实，后面每一步都以它为准。' });
  } else {
    const noLook = bible.characters.filter((c) => !c.appearance).map((c) => c.name);
    if (noLook.length) bibleIssues.push({ level: 'warn', text: `${noLook.slice(0, 8).join('、')} 没写固定外貌，定妆时只能靠 AI 猜。` });
    const noRole = bible.characters.filter((c) => !c.role).map((c) => c.name);
    if (noRole.length) bibleIssues.push({ level: 'warn', text: `${noRole.slice(0, 8).join('、')} 没写身份。` });
    const extra = characters.filter((c) => !rules.findBibleCharacter(bible, c.name)).map((c) => c.name);
    if (extra.length) {
      bibleIssues.push({ level: 'warn', text: `人物表里有、档案里没有：${extra.slice(0, 8).join('、')}。`, fix: { action: 'import-to-bible', label: '补进档案（免费）' } });
    }
  }
  out.push(stageResult('bible', bibleIssues, `${bible.characters.length} 个人物，${bible.places.length} 个地点，${bible.facts.length} 条事实`));

  // 2 剧本
  const scriptIssues = [];
  if (!episodes.length) scriptIssues.push({ level: 'missing', text: '还没有剧集。' });
  const noChapter = [];
  for (const ep of episodes) {
    if (!String(ep.script_content || '').trim()) { scriptIssues.push({ level: 'missing', text: `${epLabel(ep)}没有剧本。` }); continue; }
    if (source && !ep.source_chapter) noChapter.push(ep);
    const check = bibles.checkScriptRules(ep.script_content, episodeSeconds(ep, shotsOf(ep)), bible);
    for (const c of check.checks.filter((x) => x.level !== 'ok')) {
      scriptIssues.push({ level: 'warn', text: `${epLabel(ep)}：${c.title}。${c.detail}` });
    }
  }
  if (noChapter.length) {
    const guessable = noChapter.filter((ep) => rules.guessSourceChapter(ep, source.chapters));
    scriptIssues.push({ level: 'warn', text: `${noChapter.map(epLabel).join('、')} 没记录来自原著哪一章，提取角色、提取场景、生成分镜时读不到原著原文。`,
      ...(guessable.length ? { fix: { action: 'backfill-chapters', label: '按标题自动补上' } } : {}) });
  }
  const byChapter = new Map();
  for (const ep of episodes) {
    const ch = ep.source_chapter || (source && rules.guessSourceChapter(ep, source.chapters));
    if (ch) byChapter.set(ch, [...(byChapter.get(ch) || []), ep]);
  }
  for (const [ch, list] of byChapter) {
    if (list.length > 1) scriptIssues.push({ level: 'warn', text: `${list.map(epLabel).join('、')} 都改编自第 ${ch} 章，请确认是不是重复。` });
  }
  out.push(stageResult('script', scriptIssues, `${episodes.length} 集剧本格式和台词量都合格`));

  // 3 拍摄本
  const sbIssues = [];
  const charIds = new Set(characters.map((c) => c.id));
  const sceneIds = new Set(scenes.map((s) => s.id));
  let messy = 0;
  let matchable = 0;
  for (const ep of episodes) {
    const list = shotsOf(ep);
    if (!list.length) { if (String(ep.script_content || '').trim()) sbIssues.push({ level: 'missing', text: `${epLabel(ep)}还没有拍摄本（分镜）。` }); continue; }
    const noScene = list.filter((s) => !s.scene_id || !sceneIds.has(Number(s.scene_id)));
    if (noScene.length) {
      const can = noScene.filter((s) => rules.matchScene(s.location, s.time, scenes) != null).length;
      matchable += can;
      const places = [...new Set(noScene.map((s) => s.location).filter(Boolean))].slice(0, 4).join('、');
      sbIssues.push({ level: 'warn', text: `${epLabel(ep)}有 ${noScene.length} 个镜头没关联场景${places ? `（${places}）` : ''}${can < noScene.length ? `，其中 ${noScene.length - can} 个找不到对应场景，需要新建场景或手动选择` : ''}。` });
    }
    messy += list.filter((s) => !rules.isCanonicalCharacterJson(s.characters)).length;
    const ghost = list.filter((s) => parseIds(s.characters).some((x) => {
      const n = Number(typeof x === 'object' && x ? x.id : x);
      return Number.isFinite(n) && n > 0 && !charIds.has(n);
    }));
    if (ghost.length) sbIssues.push({ level: 'warn', text: `${epLabel(ep)}有 ${ghost.length} 个镜头引用了已删除的人物。`, fix: { action: 'normalize-characters', label: '清理' } });
    const unmarked = list.filter((s) => !parseIds(s.characters).length && speakerIds(s, characters).length);
    if (unmarked.length) sbIssues.push({ level: 'warn', text: `${epLabel(ep)}有 ${unmarked.length} 个镜头有人说话但没标出场人物，出图时人物长相会随机。`, fix: { action: 'fill-speakers', label: '按台词补人物' } });
    const wordy = list.filter((s) => rules.spokenLength(s.dialogue) > Number(s.duration || 0) * 4);
    if (wordy.length) sbIssues.push({ level: 'warn', text: `${epLabel(ep)}有 ${wordy.length} 个镜头台词超过“时长×4 字”，配音会被截或语速过快：第 ${wordy.slice(0, 6).map((s) => s.storyboard_number).join('、')} 镜。` });
  }
  if (matchable) sbIssues.push({ level: 'warn', text: `${matchable} 个镜头可以按地点自动关联到已有场景。`, fix: { action: 'match-scenes', label: '自动关联' } });
  if (messy) sbIssues.push({ level: 'warn', text: `${messy} 个镜头的人物字段混用了名字和编号。`, fix: { action: 'normalize-characters', label: '统一成编号' } });
  sbIssues.push(...staleIssues(stale, 'storyboards'));
  out.push(stageResult('storyboard', sbIssues, `${shots.length} 个镜头，都关联了场景和人物`));

  // 4 人物定妆
  const lookIssues = [];
  const used = new Set();
  for (const s of shots) for (const x of parseIds(s.characters)) used.add(Number(typeof x === 'object' && x ? x.id : x));
  const styled = characters.filter((c) => rules.hasStyleWords(c.appearance)).map((c) => c.name);
  if (styled.length) lookIssues.push({ level: 'warn', text: `${styled.join('、')} 的外貌里写了画风词（如“超写实”“毛孔清晰”）。画风应只放在项目设置里，否则换画风时会冲突。`, fix: { action: 'strip-style', label: '去掉画风词' } });
  const plan = bibleSyncPlan(data);
  if (plan.create.length || plan.update.length) {
    const names = [...plan.create.map((x) => x.person.name), ...plan.update.map((x) => x.row.name)];
    lookIssues.push({ level: 'warn', text: `人物表和故事档案不一致：${names.slice(0, 8).join('、')}。以档案为准同步后，相关定妆照需要重新生成。`, fix: { action: 'sync-bible', label: '按档案同步' } });
  }
  const noLook = characters.filter((c) => !String(c.appearance || '').trim()).map((c) => c.name);
  if (noLook.length) lookIssues.push({ level: 'warn', text: `${noLook.join('、')} 没有外貌描述。` });
  const noPhoto = characters.filter((c) => used.has(c.id) && !hasMedia(c)).map((c) => c.name);
  if (noPhoto.length) lookIssues.push({ level: 'missing', text: `镜头里用到但还没有定妆照：${noPhoto.join('、')}。` });
  if (!characters.length) lookIssues.push({ level: 'missing', text: '人物表是空的。' });
  lookIssues.push(...staleIssues(stale, 'look'));
  out.push(stageResult('look', lookIssues, `${characters.length} 个人物都有外貌和定妆照`));

  // 5 场景
  const sceneIssues = [];
  const usedScenes = new Set(shots.map((s) => Number(s.scene_id)).filter((n) => n > 0));
  const noSceneImg = scenes.filter((s) => usedScenes.has(s.id) && !hasMedia(s)).map((s) => `${s.location}（${s.time || '未写时间'}）`);
  if (noSceneImg.length) sceneIssues.push({ level: 'missing', text: `镜头里用到但还没有场景图：${noSceneImg.join('、')}。` });
  const styledScenes = scenes.filter((s) => rules.hasStyleWords(s.prompt)).length;
  if (styledScenes) sceneIssues.push({ level: 'warn', text: `${styledScenes} 个场景描述里写了画风词。`, fix: { action: 'strip-style', label: '去掉画风词' } });
  if (!scenes.length) sceneIssues.push({ level: 'missing', text: '还没有场景。' });
  sceneIssues.push(...staleIssues(stale, 'scene_image'));
  out.push(stageResult('scene', sceneIssues, `${scenes.length} 个场景都有图`));

  // 6 画面 / 7 视频 / 8 成片
  const imageIssues = [];
  const videoIssues = [];
  const finalIssues = [];
  for (const ep of episodes) {
    const list = shotsOf(ep);
    if (!list.length) continue;
    const noImg = list.filter((s) => !hasMedia(s) && !shotImages.has(s.id));
    if (noImg.length) imageIssues.push({ level: 'missing', text: `${epLabel(ep)}还有 ${noImg.length}/${list.length} 个镜头没有画面。` });
    const gate = pipelineGate.episodeReadiness(db, ep.id).shots;
    const blocked = list.filter((s) => gate[s.id] && !gate[s.id].ok);
    if (blocked.length) {
      imageIssues.push({ level: 'missing', text: `${epLabel(ep)}第 ${blocked.slice(0, 8).map((s) => s.storyboard_number).join('、')}${blocked.length > 8 ? ` 等 ${blocked.length} ` : ' '}镜暂不能生成画面和视频：${[...new Set(blocked.flatMap((s) => gate[s.id].blockers))].slice(0, 3).join('；')}。` });
    }
    const noVid = list.filter((s) => !s.video_url && !shotVideos.has(s.id));
    if (noVid.length) videoIssues.push({ level: 'missing', text: `${epLabel(ep)}还有 ${noVid.length}/${list.length} 个镜头没有视频。` });
    const noVoice = list.filter((s) => String(s.dialogue || '').trim() && !s.audio_local_path);
    if (noVoice.length) videoIssues.push({ level: 'warn', text: `${epLabel(ep)}有 ${noVoice.length} 个有台词的镜头没有配音。` });
    if (!ep.video_url) finalIssues.push({ level: noVid.length ? 'missing' : 'warn', text: noVid.length ? `${epLabel(ep)}镜头视频还没齐，暂时不能合成。` : `${epLabel(ep)}镜头都齐了，可以合成整集。` });
  }
  imageIssues.push(...staleIssues(stale, 'frame'));
  videoIssues.push(...staleIssues(stale, 'video'));
  out.push(stageResult('image', imageIssues, '所有镜头都有画面'));
  out.push(stageResult('video', videoIssues, '所有镜头都有视频和配音'));
  out.push(stageResult('final', finalIssues, episodes.length ? '每集都已合成' : ''));

  const next = out.find((s) => s.status !== 'ok');
  return {
    stages: out,
    episodes: episodes.map((ep) => ({ id: ep.id, number: ep.episode_number, title: ep.title, source_chapter: ep.source_chapter,
      source_title: source?.chapters.find((c) => c.index === ep.source_chapter)?.title || null, shots: shotsOf(ep).length })),
    next: next ? { key: next.key, name: next.name, text: next.issues[0]?.text || '' } : null,
  };
}

// ---------- 免费修复 ----------

const FIXES = {
  'backfill-chapters'(db, data, adaptation) {
    const source = adaptation?.sourceOverview(data.id);
    if (!source) return { changed: 0, message: '没有原著，无法对应章节。' };
    const set = db.prepare('UPDATE episodes SET source_chapter = ? WHERE id = ? AND source_chapter IS NULL');
    let changed = 0;
    for (const ep of data.episodes.filter((e) => !e.source_chapter)) {
      const ch = rules.guessSourceChapter(ep, source.chapters);
      if (ch) changed += set.run(ch, ep.id).changes;
    }
    return { changed, message: `已为 ${changed} 集补上来源章节。` };
  },
  'normalize-characters'(db, data) {
    const set = db.prepare('UPDATE storyboards SET characters = ? WHERE id = ?');
    let changed = 0;
    for (const s of data.shots) {
      const next = JSON.stringify(rules.normalizeCharacterRefs(s.characters, data.characters).ids);
      if (next !== (s.characters || '[]') && !(next === '[]' && !s.characters)) changed += set.run(next, s.id).changes;
    }
    return { changed, message: `已统一 ${changed} 个镜头的人物字段。` };
  },
  'fill-speakers'(db, data) {
    const set = db.prepare('UPDATE storyboards SET characters = ? WHERE id = ?');
    let changed = 0;
    for (const s of data.shots.filter((x) => !parseIds(x.characters).length)) {
      const ids = speakerIds(s, data.characters);
      if (ids.length) changed += set.run(JSON.stringify(ids), s.id).changes;
    }
    return { changed, message: `已按台词为 ${changed} 个镜头补上出场人物（画外音不算出场）。` };
  },
  'match-scenes'(db, data) {
    const ids = new Set(data.scenes.map((s) => s.id));
    const set = db.prepare('UPDATE storyboards SET scene_id = ? WHERE id = ?');
    let changed = 0;
    for (const s of data.shots.filter((x) => !x.scene_id || !ids.has(Number(x.scene_id)))) {
      const match = rules.matchScene(s.location, s.time, data.scenes);
      if (match != null) changed += set.run(match, s.id).changes;
    }
    return { changed, message: `已为 ${changed} 个镜头关联场景。` };
  },
  'strip-style'(db, data) {
    const setChar = db.prepare('UPDATE characters SET appearance = ?, updated_at = ? WHERE id = ?');
    const setScene = db.prepare('UPDATE scenes SET prompt = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();
    let changed = 0;
    for (const c of data.characters) if (rules.hasStyleWords(c.appearance)) changed += setChar.run(rules.stripStyleWords(c.appearance), now, c.id).changes;
    for (const s of data.scenes) if (rules.hasStyleWords(s.prompt)) changed += setScene.run(rules.stripStyleWords(s.prompt), now, s.id).changes;
    return { changed, message: `已从 ${changed} 条人物/场景描述里去掉画风词。` };
  },
  'sync-bible'(db, data) {
    const plan = bibleSyncPlan(data);
    const now = new Date().toISOString();
    const insert = db.prepare(`INSERT INTO characters (drama_id, name, role, description, personality, appearance, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`);
    for (const { person, appearance } of plan.create) {
      const role = Object.entries(ROLE_CODES).find(([label]) => String(person.role).includes(label))?.[1] || 'minor';
      insert.run(data.id, person.name, role, [person.role, person.goal].filter(Boolean).join('；') || null,
        person.personality || null, appearance || null, now, now);
    }
    const redo = [];
    for (const { row, changes } of plan.update) {
      const keys = Object.keys(changes);
      db.prepare(`UPDATE characters SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => changes[k]), now, row.id);
      if (changes.appearance && hasMedia(row)) redo.push(row.name);
    }
    const changed = plan.create.length + plan.update.length;
    return { changed, message: `新建 ${plan.create.length} 个人物，更新 ${plan.update.length} 个人物。${redo.length ? `${redo.join('、')} 的外貌变了，定妆照需要重新生成。` : ''}` };
  },
  'import-to-bible'(db, data) {
    const { draft, added } = bibles.importCharacters(db, data.id);
    bibles.saveBible(db, data.id, draft);
    return { changed: added, message: `已把 ${added} 个人物补进故事档案。` };
  },
};

for (const kind of stamps.KINDS) {
  FIXES[`accept-stale-${kind}`] = (db, data) => {
    const changed = stamps.accept(db, data.id, kind);
    return { changed, message: changed ? `已确认 ${changed} 项按当前版本使用，不再提示过期。` : '没有需要确认的项。' };
  };
}

function applyFix(db, dramaId, action, adaptation) {
  const fix = FIXES[action];
  if (!fix) throw new bibles.StoryBibleInputError('不支持的修复操作。');
  // 先按改动前的上游记下指纹，修复改了外貌/场景描述后，对应的照片才会正确显示为过期
  try { stamps.observe(db, dramaId); } catch (_) { /* 指纹只是提示 */ }
  const data = load(db, dramaId);
  const result = db.transaction(() => fix(db, data, adaptation))();
  return { ...result, report: report(db, dramaId, adaptation) };
}

module.exports = { report, applyFix, bibleSyncPlan, FIX_ACTIONS: Object.keys(FIXES) };
