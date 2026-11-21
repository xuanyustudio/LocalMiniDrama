const TYPES = ['text', 'script', 'character', 'scene', 'prop', 'storyboard', 'upload', 'image', 'video', 'audio', 'compose', 'style', 'group'];
const WRITABLE = {
  text: ['text'],
  script: ['title', 'premise', 'text'],
  character: ['name', 'prompt'],
  scene: ['name', 'prompt'],
  prop: ['name', 'prompt'],
  storyboard: ['shot_number', 'action', 'dialogue', 'prompt', 'duration'],
  upload: [],
  image: ['prompt'],
  video: ['prompt', 'duration'],
  audio: ['text', 'voice_id'],
  compose: [],
  style: ['text'],
  group: ['title'],
};
const LIMITS = { text: 20000, premise: 2000, prompt: 2000, action: 500, dialogue: 300, title: 80, name: 80 };
const DURATIONS = new Set([3, 5, 8, 10]);
const PAIRS = new Set([
  'text|prompt_for|script', 'text|prompt_for|storyboard', 'text|prompt_for|image', 'text|prompt_for|video',
  'style|prompt_for|script', 'style|prompt_for|storyboard', 'style|prompt_for|image', 'style|prompt_for|video',
  'script|prompt_for|storyboard', 'storyboard|prompt_for|image', 'storyboard|prompt_for|video',
  'upload|media_input_for|image', 'upload|media_input_for|video', 'image|media_input_for|video',
  'character|context_for|storyboard', 'character|context_for|image',
  'scene|context_for|storyboard', 'scene|context_for|image',
  'prop|context_for|storyboard', 'prop|context_for|image',
  'video|composition_input_for|compose', 'audio|composition_input_for|compose',
]);

function emptyGraph() {
  return { viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] };
}
function createIdFactory() {
  let n = 0;
  return (kind) => `${kind}_${++n}`;
}
function clone(graph) {
  return JSON.parse(JSON.stringify(graph));
}
function findNode(graph, id) {
  return graph.nodes.find((node) => node.id === id) || null;
}
function fail(error) {
  return { ok: false, error };
}
function defaults(type) {
  if (type === 'storyboard') return { shot_number: 1, action: '', dialogue: '', prompt: '', duration: 5 };
  if (type === 'script') return { title: '', premise: '', text: '' };
  if (type === 'audio') return { text: '', voice_id: '' };
  if (type === 'group') return { title: '编组' };
  const data = {};
  for (const key of WRITABLE[type]) data[key] = '';
  return data;
}
function checkPatch(type, data) {
  const allowed = new Set(WRITABLE[type]);
  for (const key of Object.keys(data || {})) {
    if (!allowed.has(key)) return `不能改 ${key}`;
    if (LIMITS[key] && String(data[key] || '').length > LIMITS[key]) return `${key} 超过 ${LIMITS[key]} 字`;
  }
  if (data && data.duration !== undefined && !DURATIONS.has(Number(data.duration))) return '时长只允许 3、5、8、10 秒';
  return '';
}
function reaches(graph, from, target) {
  const stack = [from];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of graph.edges) if (edge.source === id) stack.push(edge.target);
  }
  return false;
}
function createNode(graph, input, idFactory) {
  if (!TYPES.includes(input.type)) return fail('不认识的节点类型');
  const reason = checkPatch(input.type, input.data || {});
  if (reason) return fail(reason);
  const next = clone(graph);
  const node = {
    id: idFactory(input.type),
    type: input.type,
    position: input.position || null,
    parent_id: null,
    status: 'idle',
    error: null,
    data: { ...defaults(input.type), ...(input.data || {}) },
  };
  next.nodes.push(node);
  return { ok: true, graph: next, node };
}
function addEdge(graph, input, idFactory) {
  const source = findNode(graph, input.source);
  const target = findNode(graph, input.target);
  if (!source || !target) return fail('连线两端不存在');
  if (input.source === input.target || reaches(graph, input.target, input.source)) return fail('连线会成环');
  const key = `${source.type}|${input.relation}|${target.type}`;
  if (!PAIRS.has(key)) return fail('这种连线不允许');
  if (input.relation === 'prompt_for' && source.type === 'storyboard' && target.type === 'image') {
    const exists = graph.edges.some((edge) => edge.relation === 'prompt_for' && edge.target === target.id && findNode(graph, edge.source)?.type === 'storyboard');
    if (exists) return fail('一张图片只能有一条来自分镜的提示词连线');
  }
  if (input.relation === 'prompt_for' && source.type === 'script' && target.type === 'storyboard') {
    const exists = graph.edges.some((edge) => edge.target === target.id && findNode(graph, edge.source)?.type === 'script');
    if (exists) return fail('一个分镜只能连一个剧本');
  }
  if (input.relation === 'media_input_for' && target.type === 'video' && source.type === 'image') {
    const exists = graph.edges.some((edge) => edge.relation === 'media_input_for' && edge.target === target.id && findNode(graph, edge.source)?.type === 'image');
    if (exists) return fail('一条视频只能有一张上游图片');
  }
  const next = clone(graph);
  const edge = { id: idFactory('edge'), source: input.source, target: input.target, relation: input.relation };
  next.edges.push(edge);
  return { ok: true, graph: next, edge };
}

module.exports = {
  TYPES, WRITABLE, emptyGraph, createIdFactory, clone, findNode, createNode, addEdge, checkPatch, reaches,
};
