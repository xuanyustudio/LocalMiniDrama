const ai = require('./aiClient');
const images = require('./imageClient');
const videos = require('./videoClient');
const tts = require('./ttsService');
const { ARK, BAILIAN_PROFILES, PROFILES, isManaged } = require('./productionProviders');

// Undiscounted USD list prices for the integrated international endpoints.
// Alibaba Cloud: /help/en/model-studio/model-pricing and /wan2-6-i2v-flash
// BytePlus: /docs/en/modelark/model-pricing.md. MiniMax: /subscribe/token-plan
const bailianHost = new URL(BAILIAN_PROFILES.video.base_url).hostname;
const arkHost = new URL(ARK).hostname;
const textPricing = {
  'qwen3.7-plus': [[256000, 0.4, 1.6], [1000000, 1.2, 4.8]],
  'qwen3.7-flash': [[32000, 0.03, 0.13], [256000, 0.1, 0.4], [1000000, 0.2, 0.8]],
  [PROFILES.text.model]: [[256000, 0.5, 2.5]],
  'dola-seed-2-1-turbo': [[256000, 0.5, 2.5]],
};

const textTasks = {
  rewrite: ['小说改写', 'novel_import'],
  script: ['生成剧本', 'novel_import'],
  novel_import: ['导入并生成剧本初稿', 'novel_import', 520, 450],
  story: ['生成故事与剧本', 'story_generation', 6000, 1000],
  agent: ['助手对话', null, 2000, 2500],
  characters: ['提取角色', 'role_extraction', 6000, 1200],
  scenes: ['提取场景', 'scene_extraction', 3000, 1100],
  scene_translation: ['场景描述翻译', 'scene_extraction', 400, 700],
  props: ['提取道具', 'prop_extraction', 2000, 900],
  boards: ['生成分镜', 'storyboard_extraction', 16384, 6500],
  frame_prompt: ['编写分镜画面提示词', null, 3200, 4000],
  image_polish: ['优化分镜生图提示词', 'image_polish', 500, 3500],
  polish: ['润色分镜提示词', 'image_polish', 2400, 4800],
  layout: ['重写分镜构图', null, 300, 3300],
  anchors: ['提取人物外观特征', 'identity_anchors', 1500, 1500],
  prop_prompt: ['编写道具提示词', 'prop_image_polish', 800, 1700],
  character_prompt: ['编写人物提示词', 'role_image_polish', 4000, 1700],
  scene_prompt: ['编写场景提示词', null, 4000, 1700],
  bible: ['整理故事档案', 'novel_import', 3000, 700],
  review: ['剧本医生审阅', null, 2000, 1500],
};

function host(config) {
  try { return new URL(config?.base_url).hostname; }
  catch { return ''; }
}

function modelId(config, preferred) {
  return preferred || config?.default_model || (Array.isArray(config?.model) ? config.model[0] : config?.model) || '';
}

function entry(label, model, basis, minUsd, maxUsd = minUsd, note = '') {
  return { label, model, basis, minUsd: minUsd ?? null, maxUsd: maxUsd ?? null, note };
}

function withoutPrice(label, model, basis, config) {
  if (['localhost', '127.0.0.1', '[::1]'].includes(host(config))) return entry(label, model, basis, 0, 0, '本机模型');
  return entry(label, model, basis, null, null, config ? '此模型没有已核实的单价，请查看服务商账单。' : '请先配置相应的模型。');
}

function quoteText(db, novel, item) {
  const { kind, id, data = {} } = item;
  const [label, scene, outputTokens, promptOverhead] = textTasks[kind];
  const mapped = scene ? ai.getConfigFromModelMap(db, scene) : null;
  const config = mapped?.config || (data.model ? ai.getConfigForModel(db, 'text', data.model) : ai.getDefaultConfig(db, 'text'));
  const model = config ? ai.getModelFromConfig(config, mapped?.modelOverride || data.model) : '';
  const hostname = host(config);
  let calls;
  let sourceCharacters;
  if (kind === 'rewrite' || kind === 'script') {
    ({ calls, sourceCharacters } = novel.estimateTextWork(Number(id), kind, data));
  } else if (kind === 'bible' || kind === 'review') {
    const bibleLength = require('./storyBibleService').bibleTextFor(db, Number(id)).length;
    const source = kind === 'bible' && !(Number(data.text_chars) > 0) && data.chapter
      ? novel.chapterText(Number(id), data.chapter).length : Number(data.text_chars) || 0;
    calls = [{ characters: source + bibleLength + promptOverhead, outputTokens }];
  } else if (kind === 'novel_import') {
    const count = Math.min(500, Math.max(1, Math.trunc(Number(data.max_chapters) || 20)));
    calls = Array.from({ length: count }, () => ({ characters: Math.min(3000, Number(data.text_chars) || 3000) + promptOverhead, outputTokens }));
  } else {
    const scriptLength = (!['boards', 'characters', 'scenes', 'props'].includes(kind) || !id) ? 0 :
      db.prepare('SELECT length(script_content) AS chars FROM episodes WHERE id = ? AND deleted_at IS NULL').get(Number(id))?.chars || 0;
    // 提取角色/场景、生成分镜会附带故事档案和本集原著，报价要算进去
    const contextLength = ['boards', 'characters', 'scenes'].includes(kind) && id
      ? require('./productionContext').contextLength(db, Number(id), kind) : 0;
    const size = (Number(data.text_chars) || scriptLength) + contextLength;
    calls = [{ characters: size + promptOverhead, outputTokens }];
    if (kind === 'polish') calls.push({ characters: 1800, outputTokens: 300 });
  }
  const countLabel = item.contingentCount ? `暂按 ${item.contingentCount} 次估算` :
    kind === 'novel_import' ? `最多 ${calls.length} 章` : `${calls.length} 次文字生成`;
  const basis = `${sourceCharacters ? `本章 ${sourceCharacters} 字，` : ''}${countLabel}`;
  if (!calls.length) return entry(label, model, basis, 0, 0, '已完成的改写可从本机记录恢复');
  const tiers = (hostname === bailianHost && model.startsWith('qwen3.7-') || hostname === arkHost && model.startsWith('dola-seed-'))
    && Object.hasOwn(textPricing, model) ? textPricing[model] : null;
  if (!tiers) return withoutPrice(label, model, basis, config);
  let min = 0;
  let max = 0;
  for (const call of calls) {
    const inputLow = Math.ceil(call.characters * 0.55);
    const inputHigh = Math.ceil(call.characters * 1.25);
    const tier = tiers.find(([limit]) => inputHigh <= limit);
    if (!tier) return withoutPrice(label, model, basis, config);
    const [, input, output] = tier;
    min += (inputLow * input + call.outputTokens * 0.25 * output) / 1000000;
    max += (inputHigh * input + call.outputTokens * output) / 1000000;
  }
  return item.contingentCount
    ? entry(label, model, basis, 0, max * item.contingentCount, '随提取到的资产数量变化')
    : entry(label, model, basis, min, max, '按输入与预计输出用量估算');
}

function quoteImage(db, item) {
  const { kind, data = {} } = item;
  const storyboard = kind === 'storyboard_image';
  const label = storyboard ? '分镜图片' : '参考素材图';
  const count = Math.min(1000, Math.max(1, Math.trunc(Number(data.count) || 1)));
  const basis = `${count} 张图片`;
  const config = images.getDefaultImageConfig(db, data.model, null, storyboard ? 'storyboard_image' : 'image');
  const model = config ? images.getModelFromConfig(config, data.model) : '';
  if (host(config) === bailianHost && model === 'wan2.7-image') return entry(label, model, basis, count * 0.03);
  if (host(config) === arkHost && model === PROFILES.image.model) {
    const extra = Math.max(0, (Number(data.reference_count) || 0) - 1) * 0.003;
    const possibleExtra = storyboard ? Math.max(extra, 0.024) : extra;
    return entry(label, model, basis, count * (0.045 + extra), count * (0.09 + possibleExtra), '按输出尺寸和参考图数量估算');
  }
  return withoutPrice(label, model, basis, config);
}

function quoteVideo(db, item) {
  const { data = {} } = item;
  const config = videos.getDefaultVideoConfig(db, data.model);
  const model = config ? videos.getModelFromConfig(config, data.model) : '';
  const row = data.storyboard_id && db.prepare('SELECT duration FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(data.storyboard_id));
  const seconds = Math.round(Number(row?.duration) || Number(data.duration) || (host(config) === bailianHost ? 10 : 5));
  const basis = `${seconds} 秒视频`;
  if (host(config) === bailianHost && model === BAILIAN_PROFILES.video.model) {
    return entry('镜头视频', model, `${basis}，720p 无声`, seconds * 0.025);
  }
  if (host(config) === arkHost && model === PROFILES.video.model) {
    return entry('镜头视频', model, `${basis}，720p 无声`, seconds * 0.12, seconds * 0.12, '按官方无视频输入示例估算');
  }
  return withoutPrice('镜头视频', model, basis, config);
}

function quoteVoice(db, item) {
  const { data = {} } = item;
  const config = tts.getTtsConfig(db);
  const model = modelId(config);
  const cosy = config?.provider === 'cosyvoice' && model === BAILIAN_PROFILES.tts.model;
  const minimax = config?.provider === 'minimax_intl' && model === PROFILES.tts.model;
  const narration = data.tts_kind === 'narration';
  const ids = Array.isArray(data.storyboard_ids) ? data.storyboard_ids : [data.storyboard_id];
  const lookup = db.prepare('SELECT dialogue, narration FROM storyboards WHERE id = ? AND deleted_at IS NULL');
  let speakerVoices = data.speaker_voices;
  if (!speakerVoices && config?.settings) {
    try { speakerVoices = JSON.parse(config.settings).speaker_voices; } catch { /* Defaults to one voice. */ }
  }
  const texts = data.text?.trim() ? [data.text] : ids.map(id => {
    const row = lookup.get(Number(id));
    return narration ? row?.narration : row?.dialogue;
  }).filter(Boolean);
  const lines = (cosy || minimax) && !narration
    ? texts.flatMap(text => tts.splitDialogue(text, data.voice_id || 'default', speakerVoices || {}).map(part => part.text)) : texts;
  const chars = lines.reduce((sum, line) => sum + Array.from(line).length + (cosy ? (line.match(/\p{Script=Han}/gu)?.length || 0) : 0), 0);
  const basis = `${texts.length} 段，约 ${chars} 个${cosy ? '计费' : ''}字符`;
  if (cosy || minimax) return entry('语音配音', model, basis, chars * (cosy ? 0.000013 : 0.00006));
  return withoutPrice('语音配音', model, basis, config);
}

function quoteImages(db, novel, item) {
  const { kind, id, quad, data = {} } = item;
  const rows = [quoteImage(db, item)];
  if (kind === 'character_image' || Array.isArray(data.character_ids)) {
    const lookup = db.prepare('SELECT polished_prompt FROM characters WHERE id = ? AND deleted_at IS NULL');
    for (const characterId of data.character_ids || [id]) {
      const row = lookup.get(Number(characterId));
      if (row && !row.polished_prompt?.trim()) rows.push(quoteText(db, novel, { kind: 'character_prompt' }));
    }
  } else if (kind === 'scene_image') {
    const field = quad ? 'polished_prompt' : 'polished_prompt_single';
    const row = db.prepare(`SELECT ${field} AS prompt FROM scenes WHERE id = ? AND deleted_at IS NULL`).get(Number(id));
    if (row && !row.prompt?.trim()) rows.push(quoteText(db, novel, { kind: 'scene_prompt' }));
  } else if (kind === 'storyboard_image' && data.storyboard_id) {
    if (['quad_grid', 'nine_grid'].includes(data.frame_type)) {
      const row = db.prepare(`SELECT prompt FROM image_generations WHERE storyboard_id = ? AND frame_type = ?
        AND status = 'completed' AND prompt IS NOT NULL AND prompt != '' ORDER BY created_at DESC LIMIT 1`)
        .get(Number(data.storyboard_id), data.frame_type);
      const marker = data.frame_type === 'quad_grid' ? 'eye-level shot' : "worm's eye view";
      if (!row?.prompt?.includes(marker)) rows.push(quoteText(db, novel, { kind: 'frame_prompt' }));
    } else if (!['first', 'last', 'key', 'storyboard_first', 'storyboard_last'].includes(data.frame_type)) {
      const row = db.prepare('SELECT polished_prompt, image_prompt, description FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(data.storyboard_id));
      if (row && (data.text_chars || row.image_prompt || row.description) && !(row.polished_prompt?.trim().length > 10)
        && ai.getDefaultConfig(db, 'text')) rows.push(quoteText(db, novel, { kind: 'image_polish' }));
    }
  }
  return rows;
}

function quoteProduction(db, novel, items, scopes = new Set()) {
  const rows = items.flatMap(item => {
    if (Object.hasOwn(textTasks, item.kind)) {
      const cost = quoteText(db, novel, item);
      const possibleExtras = {
        characters: [['anchors', 6], ['character_prompt', 6]],
        scenes: [['scene_translation', 5], ['scene_prompt', 5]],
        props: [['prop_prompt', 5]],
      }[item.kind];
      const text = possibleExtras ? [cost, ...possibleExtras.map(([kind, contingentCount]) =>
        quoteText(db, novel, { kind, contingentCount }))] : [cost];
      if (text.some(row => row.maxUsd !== 0)) scopes.add(item.kind === 'agent' ? 'agent' : 'text');
      return text;
    }
    if (['image', 'storyboard_image', 'character_image', 'scene_image'].includes(item.kind)) {
      const quote = quoteImages(db, novel, item);
      if (quote[0].maxUsd !== 0) scopes.add('image');
      if (quote.slice(1).some(row => row.maxUsd !== 0)) scopes.add('text');
      return quote;
    }
    if (item.kind === 'video' || item.kind === 'tts') {
      const quote = item.kind === 'video' ? quoteVideo(db, item) : quoteVoice(db, item);
      if (quote.maxUsd !== 0) scopes.add(item.kind);
      return quote;
    }
    if (item.kind === 'vision') scopes.add('text');
    if (item.kind === 'merge_voice') {
      const config = tts.getTtsConfig(db);
      if (!config || isManaged(config)) return [];
      const narration = db.prepare(`SELECT narration FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL
        AND narration IS NOT NULL AND trim(narration) <> ''`).all(Number(item.id));
      if (!narration.length) return [];
      return withoutPrice('合成时补齐缺失旁白', modelId(config), `本集有 ${narration.length} 段旁白`, config);
    }
    return entry(item.kind === 'vision' ? '参考图分析' : '云端模型调用', '', '', null, null, '费用由当前云服务和实际用量决定，请查看服务商账单。');
  });
  const totals = rows.reduce((total, row) => ({
    minUsd: total.minUsd + (row.minUsd || 0),
    maxUsd: total.maxUsd + (row.maxUsd || 0),
    partial: total.partial || row.maxUsd === null,
  }), { minUsd: 0, maxUsd: 0, partial: false });
  return { rows, ...totals };
}

module.exports = { quoteProduction };
