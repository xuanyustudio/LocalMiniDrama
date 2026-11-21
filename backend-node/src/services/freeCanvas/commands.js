const document = require('./document');
const { layoutGraph } = require('./layout');

const TYPE_LABELS = { script: '剧本', storyboard: '分镜', image: '图片' };
const DEFAULT_NEXT = {
  script: { type: 'storyboard', relation: 'prompt_for' },
  storyboard: { type: 'image', relation: 'prompt_for' },
  image: { type: 'video', relation: 'media_input_for' },
  video: { type: 'compose', relation: 'composition_input_for' },
};
// 只用来为 add_next_node 挑选 relation。成环、重复边和非法配对仍由 document.addEdge 决定。
const RELATION_BY_PAIR = {
  'text|script': 'prompt_for',
  'text|storyboard': 'prompt_for',
  'text|image': 'prompt_for',
  'text|video': 'prompt_for',
  'style|script': 'prompt_for',
  'style|storyboard': 'prompt_for',
  'style|image': 'prompt_for',
  'style|video': 'prompt_for',
  'script|storyboard': 'prompt_for',
  'storyboard|image': 'prompt_for',
  'storyboard|video': 'prompt_for',
  'upload|image': 'media_input_for',
  'upload|video': 'media_input_for',
  'image|video': 'media_input_for',
  'character|storyboard': 'context_for',
  'character|image': 'context_for',
  'scene|storyboard': 'context_for',
  'scene|image': 'context_for',
  'prop|storyboard': 'context_for',
  'prop|image': 'context_for',
  'video|compose': 'composition_input_for',
  'audio|compose': 'composition_input_for',
};
const SINGLE_OPS = new Set([
  'create_node', 'create_edge', 'update_node', 'delete_edges', 'move_nodes', 'add_next_node', 'group_nodes',
]);

function fail(error, extra) {
  return extra ? { ok: false, error, ...extra } : { ok: false, error };
}

function resolveId(tempMap, id) {
  return tempMap.has(id) ? tempMap.get(id) : id;
}

function rememberTemp(tempMap, tempId, id) {
  if (tempId !== undefined && tempId !== null) tempMap.set(tempId, id);
}

function summarize(created) {
  if (!created.length) return '没有新增节点';
  const order = [];
  const counts = new Map();
  for (const item of created) {
    const label = TYPE_LABELS[item.type] || item.type;
    if (!counts.has(label)) order.push(label);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return `新增 ${order.map((label) => `${counts.get(label)} 个${label}`).join('、')}`;
}

function emptyReceipt() {
  return { ok: true, created: [], updated: [], connected: [], summary: '' };
}

function trackUpdated(receipt, id) {
  if (!receipt.updated.includes(id)) receipt.updated.push(id);
}

function applyCreateNode(graph, op, idFactory, tempMap, receipt) {
  const created = document.createNode(graph, {
    type: op.type,
    data: op.data,
    position: op.position,
  }, idFactory);
  if (!created.ok) return created;
  rememberTemp(tempMap, op.temp_id, created.node.id);
  receipt.created.push({ temp_id: op.temp_id, id: created.node.id, type: created.node.type });
  return { ok: true, graph: created.graph };
}

function applyCreateEdge(graph, op, idFactory, tempMap, receipt) {
  const source = resolveId(tempMap, op.source);
  const target = resolveId(tempMap, op.target);
  const added = document.addEdge(graph, { source, target, relation: op.relation }, idFactory);
  if (!added.ok) return added;
  receipt.connected.push({ id: added.edge.id, source, target, relation: op.relation });
  return { ok: true, graph: added.graph };
}

function applyUpdateNode(graph, op, tempMap, receipt) {
  const rawId = op.id !== undefined ? op.id : op.node_id;
  const id = resolveId(tempMap, rawId);
  const node = document.findNode(graph, id);
  if (!node) return fail('节点不存在');
  const patch = op.data || {};
  const reason = document.checkPatch(node.type, patch);
  if (reason) return fail(reason);
  const next = document.clone(graph);
  const target = document.findNode(next, id);
  for (const key of Object.keys(patch)) target.data[key] = patch[key];
  trackUpdated(receipt, id);
  return { ok: true, graph: next };
}

function edgeSelectors(op) {
  const selectors = [];
  const listed = []
    .concat(Array.isArray(op.edges) ? op.edges : [])
    .concat(Array.isArray(op.edge_ids) ? op.edge_ids : [])
    .concat(Array.isArray(op.ids) ? op.ids : []);
  for (const item of listed) {
    selectors.push(typeof item === 'string' ? { id: item } : item);
  }
  if (listed.length === 0 && (op.id !== undefined || op.source !== undefined || op.target !== undefined)) {
    selectors.push({ id: op.id, source: op.source, target: op.target, relation: op.relation });
  }
  return selectors;
}

function edgeMatches(edge, selector, tempMap) {
  if (selector && selector.id !== undefined && selector.id !== null) return edge.id === selector.id;
  if (!selector) return false;
  const source = resolveId(tempMap, selector.source);
  const target = resolveId(tempMap, selector.target);
  return edge.source === source && edge.target === target && edge.relation === selector.relation;
}

function storyboardHasMedia(graph, storyboardId) {
  return graph.edges.some((edge) => {
    if (edge.source !== storyboardId) return false;
    const target = document.findNode(graph, edge.target);
    return Boolean(target && (target.type === 'image' || target.type === 'video'));
  });
}

function applyDeleteEdges(graph, op, tempMap) {
  const selectors = edgeSelectors(op);
  if (selectors.length === 0) return fail('没有要删除的连线');
  const chosen = [];
  for (const selector of selectors) {
    const hits = graph.edges.filter((edge) => edgeMatches(edge, selector, tempMap));
    if (hits.length === 0) return fail('连线不存在');
    for (const hit of hits) {
      if (!chosen.some((edge) => edge.id === hit.id)) chosen.push(hit);
    }
  }
  for (const edge of chosen) {
    for (const endpoint of [edge.source, edge.target]) {
      const node = document.findNode(graph, endpoint);
      if (node && node.type === 'storyboard' && storyboardHasMedia(graph, node.id)) {
        return fail('这个分镜已经有图片或视频，要先删除节点');
      }
    }
  }
  const removeIds = new Set(chosen.map((edge) => edge.id));
  const next = document.clone(graph);
  next.edges = next.edges.filter((edge) => !removeIds.has(edge.id));
  return { ok: true, graph: next };
}

function moveEntries(op) {
  if (Array.isArray(op.nodes)) return op.nodes;
  if (Array.isArray(op.moves)) return op.moves;
  if (op.positions && typeof op.positions === 'object' && !Array.isArray(op.positions)) {
    return Object.entries(op.positions).map(([id, position]) => ({ id, position }));
  }
  return [];
}

function readPosition(entry) {
  const source = entry && entry.position && typeof entry.position === 'object' ? entry.position : entry;
  if (!source || source.x === undefined || source.y === undefined) return null;
  return { x: source.x, y: source.y };
}

function applyMoveNodes(graph, op, tempMap, receipt) {
  const entries = moveEntries(op);
  const next = document.clone(graph);
  for (const entry of entries) {
    const id = resolveId(tempMap, entry.id !== undefined ? entry.id : entry.node_id);
    const node = document.findNode(next, id);
    if (!node) return fail('节点不存在');
    const position = readPosition(entry);
    if (!position) return fail('坐标不正确');
    node.position = position;
    trackUpdated(receipt, id);
  }
  return { ok: true, graph: next };
}

function applyAddNext(graph, op, idFactory, tempMap, receipt) {
  const rawSource = op.source !== undefined ? op.source : op.node_id;
  const sourceId = resolveId(tempMap, rawSource);
  const source = document.findNode(graph, sourceId);
  if (!source) return fail('节点不存在');
  const fallback = DEFAULT_NEXT[source.type];
  const nextType = op.type || (fallback && fallback.type);
  if (!nextType) return fail('必须指定下一个节点类型');
  const relation = op.relation || RELATION_BY_PAIR[`${source.type}|${nextType}`];
  if (!relation) return fail('必须指定连线关系');
  const created = document.createNode(graph, {
    type: nextType,
    data: op.data,
    position: op.position,
  }, idFactory);
  if (!created.ok) return created;
  const edged = document.addEdge(created.graph, {
    source: sourceId,
    target: created.node.id,
    relation,
  }, idFactory);
  if (!edged.ok) return edged;
  rememberTemp(tempMap, op.temp_id, created.node.id);
  receipt.created.push({ temp_id: op.temp_id, id: created.node.id, type: created.node.type });
  receipt.connected.push({
    id: edged.edge.id,
    source: sourceId,
    target: created.node.id,
    relation,
  });
  return { ok: true, graph: edged.graph };
}

function applyLayoutNodes(graph, op, tempMap) {
  const onlyIds = Array.isArray(op.node_ids)
    ? op.node_ids.map((id) => resolveId(tempMap, id))
    : undefined;
  return { ok: true, graph: layoutGraph(graph, onlyIds) };
}

function applyGroupNodes(graph, op, idFactory, tempMap, receipt) {
  const data = op.data || (op.title !== undefined ? { title: op.title } : {});
  const created = document.createNode(graph, { type: 'group', data, position: op.position }, idFactory);
  if (!created.ok) return created;
  const next = created.graph;
  const groupId = created.node.id;
  for (const rawId of op.node_ids || []) {
    const id = resolveId(tempMap, rawId);
    if (id === groupId) continue;
    const node = document.findNode(next, id);
    if (!node) return fail('节点不存在');
    node.parent_id = groupId;
  }
  rememberTemp(tempMap, op.temp_id, groupId);
  receipt.created.push({ temp_id: op.temp_id, id: groupId, type: 'group' });
  return { ok: true, graph: next };
}

function applyOp(graph, op, idFactory, tempMap, receipt) {
  if (!op || typeof op.op !== 'string') return fail('不认识的步骤');
  switch (op.op) {
    case 'create_node':
      return applyCreateNode(graph, op, idFactory, tempMap, receipt);
    case 'create_edge':
      return applyCreateEdge(graph, op, idFactory, tempMap, receipt);
    case 'update_node':
      return applyUpdateNode(graph, op, tempMap, receipt);
    case 'delete_edges':
      return applyDeleteEdges(graph, op, tempMap);
    case 'move_nodes':
      return applyMoveNodes(graph, op, tempMap, receipt);
    case 'add_next_node':
      return applyAddNext(graph, op, idFactory, tempMap, receipt);
    case 'group_nodes':
      return applyGroupNodes(graph, op, idFactory, tempMap, receipt);
    case 'layout_nodes':
      return applyLayoutNodes(graph, op, tempMap);
    case 'delete_node':
    case 'run_node':
      return fail('这一批不能删除或运行');
    default:
      return fail('不认识的步骤');
  }
}

function applyOps(graph, command, idFactory) {
  const ops = command.ops;
  if (!Array.isArray(ops)) return fail('ops 必须是数组');
  if (ops.length > 40) return fail('一批最多 40 步');
  if (ops.some((op) => op && (op.op === 'delete_node' || op.op === 'run_node'))) {
    return fail('这一批不能删除或运行');
  }
  let working = document.clone(graph);
  const tempMap = new Map();
  const receipt = emptyReceipt();
  for (const op of ops) {
    const result = applyOp(working, op, idFactory, tempMap, receipt);
    if (!result.ok) return fail(result.error);
    working = result.graph;
  }
  if (working.nodes.some((node) => node.position === null)) {
    working = layoutGraph(working);
  }
  receipt.summary = summarize(receipt.created);
  return { ok: true, graph: working, receipt };
}

function applyDeleteNodes(graph, command) {
  const nodeIds = Array.isArray(command.node_ids) ? command.node_ids : [];
  if (command.approved !== true) {
    return { ok: false, pending: true, error: '删除需要允许', node_ids: nodeIds };
  }
  const next = document.clone(graph);
  for (const id of nodeIds) {
    if (!document.findNode(next, id)) return fail('节点不存在');
  }
  const include = new Set(command.include_ids || []);
  const requested = new Set(nodeIds);
  const remove = new Set();

  function consider(id) {
    if (remove.has(id)) return;
    const node = document.findNode(next, id);
    if (!node) return;
    remove.add(id);
    if (node.type !== 'group') return;
    for (const child of next.nodes) {
      if (child.parent_id !== id) continue;
      if (include.has(child.id) || requested.has(child.id)) consider(child.id);
      else child.parent_id = null;
    }
  }

  for (const id of nodeIds) consider(id);
  next.nodes = next.nodes.filter((node) => !remove.has(node.id));
  next.edges = next.edges.filter((edge) => !remove.has(edge.source) && !remove.has(edge.target));
  return {
    ok: true,
    graph: next,
    receipt: {
      ok: true,
      created: [],
      updated: [],
      connected: [],
      summary: `删除 ${remove.size} 个节点`,
    },
  };
}

function applyCommand(graph, command, idFactory) {
  const ids = idFactory || document.createIdFactory();
  if (!command || typeof command.name !== 'string') return fail('不认识的命令');
  if (command.name === 'apply_ops') return applyOps(graph, command, ids);
  if (command.name === 'select_nodes') {
    return { ok: true, select: command.node_ids || [], revisionChanged: false };
  }
  if (command.name === 'delete_nodes') return applyDeleteNodes(graph, command);
  if (command.name === 'update_canvas') return fail('update_canvas 不写在文档命令里');
  if (SINGLE_OPS.has(command.name)) {
    return applyOps(graph, { ops: [{ ...command, op: command.name }] }, ids);
  }
  return fail('不认识的命令');
}

module.exports = { applyCommand };
