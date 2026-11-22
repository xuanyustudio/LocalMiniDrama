const document = require('./document');
const prompts = require('./prompts');

const MODEL_ERROR = '请先在 AI 配置里添加对应模型';
const PAID = {
  generate_image: new Set(['character', 'scene', 'prop', 'image']),
  generate_video: new Set(['video']),
  generate_audio: new Set(['audio']),
};
const PAID_LABEL = {
  generate_image: '出图',
  generate_video: '出视频',
  generate_audio: '配音',
};

function modelMissing(deps, name) {
  const fn = deps && deps[name];
  return typeof fn === 'function' && fn() === false;
}

function parseArray(raw) {
  const text = String(raw ?? '');
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function parseObject(raw) {
  const text = String(raw ?? '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function validDuration(value) {
  const n = Number(value);
  return [3, 5, 8, 10].includes(n) ? n : 5;
}

function hasStoryboardChild(graph, scriptId) {
  return (graph.edges || []).some((edge) => {
    if (edge.source !== scriptId) return false;
    const target = document.findNode(graph, edge.target);
    return Boolean(target && target.type === 'storyboard');
  });
}

function upstreamScript(graph, nodeId) {
  for (const edge of graph.edges || []) {
    if (edge.target !== nodeId || edge.relation !== 'prompt_for') continue;
    const source = document.findNode(graph, edge.source);
    if (source && source.type === 'script') return source;
  }
  return null;
}

function preferredModel(node, command) {
  const fromCommand = command && typeof command.model === 'string' ? command.model.trim() : '';
  if (fromCommand) return fromCommand;
  const fromNode = node && node.data && typeof node.data.model === 'string' ? node.data.model.trim() : '';
  return fromNode || undefined;
}

async function generateText(graph, nodes, instruction, deps, command) {
  if (modelMissing(deps, 'hasTextModel')) return { ok: false, error: MODEL_ERROR };
  const next = document.clone(graph);
  for (const original of nodes) {
    const node = document.findNode(next, original.id);
    if (!node) return { ok: false, error: '节点不存在' };
    const model = preferredModel(node, command);
    let raw;
    try {
      if (node.type === 'script') {
        raw = await deps.completeText([
          '根据前提和已有正文写短剧剧本正文。',
          `前提：${node.data?.premise || ''}`,
          `已有正文：${node.data?.text || ''}`,
          `补充：${instruction || ''}`,
        ].join('\n'), { model });
        node.data.text = String(raw ?? '');
      } else if (node.type === 'storyboard') {
        const script = upstreamScript(next, node.id);
        raw = await deps.completeText([
          '只返回 JSON：{"action":"","dialogue":"","prompt":""}',
          `剧本：${script?.data?.text || ''}`,
          `动作：${node.data?.action || ''}`,
          `台词：${node.data?.dialogue || ''}`,
          `提示词：${node.data?.prompt || ''}`,
          `补充：${instruction || ''}`,
        ].join('\n'), { model });
        const parsed = parseObject(raw);
        if (!parsed) return { ok: false, error: '模型没有返回这一镜的内容' };
        node.data.action = String(parsed.action || '');
        node.data.dialogue = String(parsed.dialogue || '');
        node.data.prompt = String(parsed.prompt || '');
      } else {
        return { ok: false, error: '这个节点不能这样运行' };
      }
    } catch {
      return { ok: false, error: '文本生成失败' };
    }
    if (model) node.data.model = model;
    node.status = 'succeeded';
    node.error = null;
  }
  return { ok: true, graph: next };
}

async function splitStoryboards(graph, nodes, instruction, deps, command) {
  if (nodes.length !== 1 || nodes[0].type !== 'script') return { ok: false, error: '只能拆分剧本' };
  const script = nodes[0];
  if (hasStoryboardChild(graph, script.id)) return { ok: false, error: '这个剧本已经有分镜' };
  if (modelMissing(deps, 'hasTextModel')) return { ok: false, error: MODEL_ERROR };
  const model = preferredModel(script, command);
  let raw;
  try {
    raw = await deps.completeText([
      '把剧本拆成分镜，只返回 JSON 数组。每项包含 action、dialogue、prompt、duration。duration 只能是 3、5、8、10。',
      `正文：${script.data?.text || ''}`,
      `前提：${script.data?.premise || ''}`,
      `补充：${instruction || ''}`,
    ].join('\n'), { model });
  } catch {
    return { ok: false, error: '文本生成失败' };
  }
  const items = parseArray(raw);
  if (!items) return { ok: false, error: '模型没有返回分镜列表' };
  if (items.length > 30) return { ok: false, error: '一次最多 30 个分镜' };
  const ids = document.runtimeIdFactory();
  let next = document.clone(graph);
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] || {};
    const created = document.createNode(next, {
      type: 'storyboard',
      data: {
        shot_number: index + 1,
        action: String(item.action || ''),
        dialogue: String(item.dialogue || ''),
        prompt: String(item.prompt || ''),
        duration: validDuration(item.duration),
      },
    }, ids);
    if (!created.ok) return { ok: false, error: created.error };
    const linked = document.addEdge(created.graph, {
      source: script.id,
      target: created.node.id,
      relation: 'prompt_for',
    }, ids);
    if (!linked.ok) return { ok: false, error: linked.error };
    next = linked.graph;
  }
  const scriptNode = document.findNode(next, script.id);
  scriptNode.status = 'succeeded';
  scriptNode.error = null;
  return { ok: true, graph: next };
}

function markPending(graph, nodes, action, command) {
  const next = document.clone(graph);
  const nodeIds = [];
  for (const original of nodes) {
    const node = document.findNode(next, original.id);
    const model = preferredModel(node, command);
    node.status = 'awaiting_confirm';
    node.data = { ...(node.data || {}), pending_action: action };
    if (model) node.data.model = model;
    nodeIds.push(node.id);
  }
  return {
    ok: true,
    pending: true,
    graph: next,
    nodeIds,
    summary: `将为 ${nodeIds.length} 个节点${PAID_LABEL[action]}`,
  };
}

async function runNode(graph, command, deps) {
  const action = command && command.action;
  const ids = Array.isArray(command && command.node_ids) ? command.node_ids : [];
  const nodes = ids.map((id) => document.findNode(graph, id));
  if (!nodes.length || nodes.some((node) => !node)) return { ok: false, error: '节点不存在' };
  if (PAID[action]) {
    const checkName = action === 'generate_image' ? 'hasImageModel' : action === 'generate_video' ? 'hasVideoModel' : 'hasTts';
    if (modelMissing(deps, checkName)) return { ok: false, error: MODEL_ERROR };
    if (nodes.some((node) => !PAID[action].has(node.type))) return { ok: false, error: '这个节点不能这样运行' };
    if ((graph.nodes || []).some((node) => node.status === 'awaiting_confirm')) {
      return { ok: false, error: '还有未确认的生成' };
    }
    return markPending(graph, nodes, action, command);
  }
  if (action === 'generate_text') return generateText(graph, nodes, command.instruction, deps, command);
  if (action === 'split_storyboards') return splitStoryboards(graph, nodes, command.instruction, deps, command);
  return { ok: false, error: '不认识的运行动作' };
}

async function confirmRun(graph, approved, deps, options = {}) {
  const next = document.clone(graph);
  const waiting = (next.nodes || []).filter((node) => node.status === 'awaiting_confirm');
  if (approved !== true) {
    for (const node of waiting) {
      node.status = 'idle';
      if (node.data) delete node.data.pending_action;
    }
    return { ok: true, cancelled: true, graph: next };
  }
  for (const node of waiting) {
    const action = node.data && node.data.pending_action;
    try {
      if (action === 'generate_image') {
        const prompt = prompts.promptForImage(next, node.id);
        if (node.type === 'image') node.data.prompt = prompt;
        const created = await deps.createImage({
          drama_id: 0,
          storyboard_id: null,
          prompt,
          aspect_ratio: options.aspectRatio || '9:16',
          model: node.data.model || undefined,
        });
        node.data.generation_id = created.id;
        node.status = 'running';
      } else if (action === 'generate_video') {
        const built = prompts.promptForVideo(next, node.id);
        // 与竞品/规格一致：有上游图片入边时作为画面输入（image_url + first_frame）
        if (!built.imagePath) {
          const media = prompts.upstreamMedia(next, node.id);
          node.status = 'failed';
          node.error = media
            ? '上游图片还没有可用文件，请先完成出图'
            : '请先连上游图片或上传图，再生成视频';
          if (node.data) delete node.data.pending_action;
          continue;
        }
        if (!built.prompt) {
          node.status = 'failed';
          node.error = '请填写视频提示词，或连上带提示词的分镜/图片';
          if (node.data) delete node.data.pending_action;
          continue;
        }
        node.data.prompt = built.prompt;
        node.data.duration = built.duration;
        const created = await deps.createVideo({
          drama_id: 0,
          storyboard_id: null,
          prompt: built.prompt,
          duration: built.duration,
          aspect_ratio: options.aspectRatio || '9:16',
          image_url: built.imagePath,
          first_frame_url: built.imagePath,
          model: node.data.model || undefined,
        });
        node.data.generation_id = created.id;
        node.status = 'running';
      } else if (action === 'generate_audio') {
        const text = prompts.spokenText(next, node.id);
        const voiceId = node.data.voice_id;
        const created = await deps.synthesize({
          text,
          storyboard_id: null,
          model: node.data.model || undefined,
          ...(voiceId ? { voice_id: voiceId } : {}),
        });
        if (created && (created.local_path || created.audio_url)) {
          node.data.local_path = created.local_path || '';
          node.data.audio_url = created.audio_url || created.url || '';
          node.status = 'succeeded';
        } else {
          node.status = 'running';
        }
      } else {
        node.status = 'failed';
        node.error = '不认识的运行动作';
      }
      node.error = node.status === 'failed' ? node.error : null;
      if (node.data) delete node.data.pending_action;
    } catch (err) {
      node.status = 'failed';
      node.error = err && err.message ? err.message : '生成失败';
      if (node.data) delete node.data.pending_action;
    }
  }
  return { ok: true, graph: next };
}

module.exports = { runNode, confirmRun };
