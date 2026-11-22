# 自由画布与画布智能体 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在首页增加一块不从属于剧的自由画布，智能体只用命令改画布文档，并跑通剧本、分镜、出图、出视频、配音和合成，再由人把这条链路落成一部剧。

**Architecture:** 纯函数负责节点、连线、命令、提示词拼装和落成预览；SQLite 表 `free_canvases` 用 `revision` 做比较写入。运行和落成调用现有生图、视频、配音、ffmpeg 和建剧函数，生成过程中不写剧表。画布智能体是单独的 `canvas-assistant`，不往剧助手工具列表里加命令。旧的 `/film/:id/canvas` 不改。

**Tech Stack:** Express、better-sqlite3、现有 Mastra 助手、Vue 3、`@vue-flow/core` 1.48、Node 内置 `node --test`。

**规格：** `docs/superpowers/specs/2026-11-21-free-canvas-agent-design.md`

---

## 文件地图

| 路径 | 职责 |
|------|------|
| `backend-node/migrations/24_free_canvases.sql` | 建表 |
| `backend-node/src/services/freeCanvas/document.js` | 节点、连线、校验、摘要 |
| `backend-node/src/services/freeCanvas/commands.js` | `apply_ops` 等写命令，失败不改文档 |
| `backend-node/src/services/freeCanvas/layout.js` | 缺坐标和 `layout_nodes` |
| `backend-node/src/services/freeCanvas/store.js` | 列表、读取、带 revision 的保存 |
| `backend-node/src/services/freeCanvas/prompts.js` | 运行前拼提示词 |
| `backend-node/src/services/freeCanvas/run.js` | 文本运行、付费确认、合成 |
| `backend-node/src/services/freeCanvas/materialize.js` | 落成预览和事务写入 |
| `backend-node/src/routes/freeCanvas.js` | REST |
| `backend-node/src/mastra/canvasAgent.mjs` | 只含画布工具的助手 |
| `backend-node/src/routes/freeCanvasAgent.js` | 画布对话 SSE |
| `frontweb/src/utils/freeCanvasReceipt.js` | 回执合并、确认卡 |
| `frontweb/src/utils/freeCanvasSummary.js` | 落成确认框数量 |
| `frontweb/src/api/freeCanvas.js` | 请求 |
| `frontweb/src/views/StudioList.vue` | `/studio` |
| `frontweb/src/views/StudioCanvas.vue` | `/studio/:id` |

测试假实现从参数注入，不请求真实模型。

---

### Task 1: 建表和读写画布行

**Files:**
- Create: `backend-node/migrations/24_free_canvases.sql`
- Create: `backend-node/src/services/freeCanvas/store.js`
- Test: `backend-node/test/freeCanvas-store.test.js`

**Step 1: Write the failing test**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function openDb() {
  const db = new Database(':memory:');
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/24_free_canvases.sql'), 'utf8');
  db.exec(sql);
  return db;
}

describe('free canvas store', () => {
  it('creates a blank canvas and rejects a stale revision', () => {
    const { createCanvas, getCanvas, saveDocument } = require('../src/services/freeCanvas/store');
    const db = openDb();
    const created = createCanvas(db, '未命名画布');
    assert.equal(created.revision, 1);
    assert.equal(created.aspect_ratio, '9:16');
    assert.deepEqual(created.document.nodes, []);

    const saved = saveDocument(db, created.id, 1, { nodes: [{ id: 'script_1' }], edges: [] });
    assert.equal(saved.ok, true);
    assert.equal(saved.canvas.revision, 2);

    const stale = saveDocument(db, created.id, 1, { nodes: [], edges: [] });
    assert.equal(stale.ok, false);
    assert.equal(stale.revision, 2);
    assert.equal(getCanvas(db, created.id).document.nodes[0].id, 'script_1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-store.test.js`

Expected: FAIL，找不到 `store` 模块或迁移文件。

**Step 3: Write minimal implementation**

`backend-node/migrations/24_free_canvases.sql`

```sql
CREATE TABLE IF NOT EXISTS free_canvases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '未命名画布',
  revision INTEGER NOT NULL DEFAULT 1,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  materialized_drama_id INTEGER,
  document TEXT NOT NULL DEFAULT '{"viewport":{"x":0,"y":0,"zoom":1},"nodes":[],"edges":[]}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`backend-node/src/services/freeCanvas/store.js`

```js
function emptyDocument() {
  return { viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [] };
}

function rowToCanvas(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    revision: row.revision,
    aspect_ratio: row.aspect_ratio,
    materialized_drama_id: row.materialized_drama_id || null,
    document: JSON.parse(row.document),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function createCanvas(db, title) {
  const now = new Date().toISOString();
  const info = db.prepare(
    `INSERT INTO free_canvases (title, revision, aspect_ratio, document, created_at, updated_at)
     VALUES (?, 1, '9:16', ?, ?, ?)`
  ).run(title || '未命名画布', JSON.stringify(emptyDocument()), now, now);
  return getCanvas(db, info.lastInsertRowid);
}

function listCanvases(db) {
  return db.prepare(
    'SELECT * FROM free_canvases ORDER BY updated_at DESC'
  ).all().map(rowToCanvas);
}

function getCanvas(db, id) {
  return rowToCanvas(db.prepare('SELECT * FROM free_canvases WHERE id = ?').get(Number(id)));
}

function saveDocument(db, id, revision, document) {
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE free_canvases SET document = ?, revision = revision + 1, updated_at = ?
     WHERE id = ? AND revision = ?`
  ).run(JSON.stringify(document), now, Number(id), Number(revision));
  if (result.changes !== 1) {
    const current = getCanvas(db, id);
    return { ok: false, error: '画布已被更新', revision: current ? current.revision : null };
  }
  return { ok: true, canvas: getCanvas(db, id) };
}

function saveColumns(db, id, revision, columns) {
  const sets = [];
  const params = [];
  for (const key of ['title', 'aspect_ratio', 'materialized_drama_id']) {
    if (columns[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(columns[key]);
    }
  }
  if (columns.document !== undefined) {
    sets.push('document = ?');
    params.push(JSON.stringify(columns.document));
  }
  const now = new Date().toISOString();
  sets.push('revision = revision + 1', 'updated_at = ?');
  params.push(now, Number(id), Number(revision));
  const result = db.prepare(
    `UPDATE free_canvases SET ${sets.join(', ')} WHERE id = ? AND revision = ?`
  ).run(...params);
  if (result.changes !== 1) {
    const current = getCanvas(db, id);
    return { ok: false, error: '画布已被更新', revision: current ? current.revision : null };
  }
  return { ok: true, canvas: getCanvas(db, id) };
}

module.exports = { emptyDocument, createCanvas, listCanvases, getCanvas, saveDocument, saveColumns };
```

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-store.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/migrations/24_free_canvases.sql backend-node/src/services/freeCanvas/store.js backend-node/test/freeCanvas-store.test.js
git commit -m "feat: store free canvases with a revision"
```

---

### Task 2: 节点和连线校验

**Files:**
- Create: `backend-node/src/services/freeCanvas/document.js`
- Test: `backend-node/test/freeCanvas-document.test.js`

**Step 1: Write the failing test**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const doc = require('../src/services/freeCanvas/document');

describe('free canvas document', () => {
  it('rejects a server field, a cycle, and a second storyboard image edge', () => {
    const id = doc.createIdFactory();
    let graph = doc.emptyGraph();
    const script = doc.createNode(graph, { type: 'script', data: { title: '甲' } }, id);
    graph = script.graph;
    const image = doc.createNode(graph, { type: 'image', data: { prompt: '图', image_url: 'secret' } }, id);
    assert.equal(image.ok, false);
    assert.match(image.error, /不能改/);

    const story = doc.createNode(graph, { type: 'storyboard', data: { duration: 4 } }, id);
    assert.equal(story.ok, false);

    const board = doc.createNode(graph, { type: 'storyboard', data: { shot_number: 1, action: '走' } }, id);
    graph = board.graph;
    const pic = doc.createNode(graph, { type: 'image', data: { prompt: '街' } }, id);
    graph = pic.graph;
    const linked = doc.addEdge(graph, { source: script.node.id, target: board.node.id, relation: 'prompt_for' }, id);
    graph = linked.graph;
    const toPic = doc.addEdge(graph, { source: board.node.id, target: pic.node.id, relation: 'prompt_for' }, id);
    graph = toPic.graph;
    const again = doc.addEdge(graph, { source: board.node.id, target: pic.node.id, relation: 'prompt_for' }, id);
    assert.equal(again.ok, false);
    const self = doc.addEdge(graph, { source: board.node.id, target: board.node.id, relation: 'prompt_for' }, id);
    assert.equal(self.ok, false);
    assert.equal(self.error, '连线会成环');
    assert.equal(doc.reaches({ edges: [{ source: 'b', target: 'a' }] }, 'b', 'a'), true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-document.test.js`

Expected: FAIL，`Cannot find module`。

**Step 3: Write minimal implementation**

`backend-node/src/services/freeCanvas/document.js` 导出下面这些行为。类型和可写字段与规格表一致。

```js
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
```

自环和 `reaches` 都在查合法类型之前判断，所以测试里的自环得到 `连线会成环`，而不是 `这种连线不允许`。`image_url` 不在可写字段里，返回 `不能改 image_url`。时长 `4` 走 `checkPatch`。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-document.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/src/services/freeCanvas/document.js backend-node/test/freeCanvas-document.test.js
git commit -m "feat: validate free canvas nodes and edges"
```

---

### Task 3: apply_ops 整批成功或整批失败

**Files:**
- Create: `backend-node/src/services/freeCanvas/commands.js`
- Test: `backend-node/test/freeCanvas-commands.test.js`

**Step 1: Write the failing test**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { applyCommand } = require('../src/services/freeCanvas/commands');
const { emptyGraph, createIdFactory } = require('../src/services/freeCanvas/document');

describe('free canvas commands', () => {
  it('builds a script-storyboard-image chain or rolls back', () => {
    const ids = createIdFactory();
    const ok = applyCommand(emptyGraph(), {
      name: 'apply_ops',
      ops: [
        { op: 'create_node', temp_id: 's', type: 'script', data: { title: '甲' } },
        { op: 'create_node', temp_id: 'b', type: 'storyboard', data: { shot_number: 1, action: '推门' } },
        { op: 'create_node', temp_id: 'i', type: 'image', data: { prompt: '' } },
        { op: 'create_edge', source: 's', target: 'b', relation: 'prompt_for' },
        { op: 'create_edge', source: 'b', target: 'i', relation: 'prompt_for' },
      ],
    }, ids);
    assert.equal(ok.ok, true);
    assert.equal(ok.graph.nodes.length, 3);
    assert.equal(ok.graph.edges.length, 2);
    assert.equal(ok.receipt.created.length, 3);

    const bad = applyCommand(emptyGraph(), {
      name: 'apply_ops',
      ops: [
        { op: 'create_node', temp_id: 's', type: 'script', data: { title: '甲' } },
        { op: 'create_edge', source: 's', target: 'missing', relation: 'prompt_for' },
      ],
    }, ids);
    assert.equal(bad.ok, false);
    assert.equal(bad.graph, undefined);
  });

  it('rejects the 41st op and a server field inside the batch', () => {
    const ids = createIdFactory();
    const ops = Array.from({ length: 41 }, (_, index) => ({
      op: 'create_node', temp_id: `t${index}`, type: 'text', data: { text: String(index) },
    }));
    assert.equal(applyCommand(emptyGraph(), { name: 'apply_ops', ops }, ids).ok, false);
    const secret = applyCommand(emptyGraph(), {
      name: 'apply_ops',
      ops: [{ op: 'create_node', temp_id: 'i', type: 'image', data: { prompt: 'a', image_url: 'x' } }],
    }, ids);
    assert.equal(secret.ok, false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-commands.test.js`

Expected: FAIL，模块不存在。

**Step 3: Write minimal implementation**

`commands.js` 的 `applyCommand(graph, command, idFactory)`：

- `apply_ops` 超过 40 条返回 `{ ok: false, error: '一批最多 40 步' }`，不返回 `graph`。
- 含 `delete_node` 或 `run_node` 返回 `{ ok: false, error: '这一批不能删除或运行' }`。
- 在副本上逐步执行。任一步失败则丢弃副本，返回 `{ ok: false, error }`。
- `create_node` 调用 `document.createNode`。`temp_id` 记到正式 id 的映射。
- `create_edge` / `add_next_node` 的 `source`、`target` 先经映射换成正式 id。
- `update_node` 用 `checkPatch`，只合并可写字段。
- `delete_edges` 按 id 或 `{ source, target, relation }` 从副本去掉边。若被拆的边连着一个分镜，且该分镜还有指向 `image` 或 `video` 的出边，返回 `{ ok: false, error: '这个分镜已经有图片或视频，要先删除节点' }`。
- `move_nodes` 写 `position`。
- 成功返回 `{ ok: true, graph, receipt }`。`receipt` 为 `{ ok: true, created: [{ temp_id, id, type }], updated: [], connected: [], summary }`。`summary` 用中文数节点类型，例如 `新增 1 个剧本、1 个分镜、1 个图片`。
- `select_nodes` 返回 `{ ok: true, select: command.node_ids || [], revisionChanged: false }`，不改 graph。
- `delete_nodes` 在 `command.approved !== true` 时返回 `{ ok: false, pending: true, error: '删除需要允许', node_ids }`，不改 graph。`approved === true` 时删节点和相关边。类型是 `group` 且 `command.include_ids` 不含子节点时，只删组框，子节点 `parent_id` 置空。
- `add_next_node` 的默认类型：`script→storyboard`、`storyboard→image`、`image→video`、`video→compose`。其他类型没带 `type` 时返回 `必须指定下一个节点类型`。新建节点后按上表连对应 relation。
- `group_nodes` 建 `group` 节点，把 `node_ids` 的 `parent_id` 设为组 id。
- `update_canvas` 不在 graph 里处理，留给路由改列。这里遇到它返回 `{ ok: false, error: 'update_canvas 不写在文档命令里' }`，避免静默成功。

类型中文：`script` 剧本，`storyboard` 分镜，`image` 图片，其余用类型名。测试只断言 `created.length`。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-commands.test.js test/freeCanvas-document.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/src/services/freeCanvas/commands.js backend-node/test/freeCanvas-commands.test.js
git commit -m "feat: apply free canvas edits as one batch"
```

---

### Task 4: 自动排版

**Files:**
- Create: `backend-node/src/services/freeCanvas/layout.js`
- Modify: `backend-node/src/services/freeCanvas/commands.js`（`create_node` 没坐标时调用 `placeNode`，`layout_nodes` 调用 `layoutGraph`）
- Test: `backend-node/test/freeCanvas-layout.test.js`

**Step 1: Write the failing test**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { applyCommand } = require('../src/services/freeCanvas/commands');
const { emptyGraph, createIdFactory } = require('../src/services/freeCanvas/document');

describe('free canvas layout', () => {
  it('places a storyboard to the right of its script', () => {
    const ids = createIdFactory();
    const result = applyCommand(emptyGraph(), {
      name: 'apply_ops',
      ops: [
        { op: 'create_node', temp_id: 's', type: 'script', data: { title: '甲' } },
        { op: 'create_node', temp_id: 'b', type: 'storyboard', data: { shot_number: 1 } },
        { op: 'create_edge', source: 's', target: 'b', relation: 'prompt_for' },
        { op: 'layout_nodes' },
      ],
    }, ids);
    const script = result.graph.nodes.find((node) => node.type === 'script');
    const board = result.graph.nodes.find((node) => node.type === 'storyboard');
    assert.equal(script.position.x, 80);
    assert.equal(board.position.x, 400);
    assert.ok(board.position.y >= script.position.y);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-layout.test.js`

Expected: FAIL，`position` 为 `null` 或命令不认识 `layout_nodes`。

**Step 3: Write minimal implementation**

`layout.js`：

```js
const X = { script: 80, storyboard: 400, image: 720, video: 1040, audio: 1040, compose: 1360 };
const Y0 = 80;
const GAP_Y = 220;

function layoutGraph(graph, onlyIds) {
  const next = JSON.parse(JSON.stringify(graph));
  const allow = onlyIds && onlyIds.length ? new Set(onlyIds) : null;
  const scripts = next.nodes.filter((node) => node.type === 'script');
  scripts.forEach((script, index) => {
    if (!allow || allow.has(script.id)) script.position = { x: X.script, y: Y0 + index * GAP_Y };
  });
  const boards = next.nodes.filter((node) => node.type === 'storyboard');
  boards.forEach((board, index) => {
    if (!allow || allow.has(board.id)) board.position = { x: X.storyboard, y: Y0 + index * GAP_Y };
  });
  for (const node of next.nodes) {
    if (allow && !allow.has(node.id)) continue;
    if (node.type === 'image' || node.type === 'video' || node.type === 'audio' || node.type === 'compose') {
      const upstream = next.edges.find((edge) => edge.target === node.id);
      const source = upstream && next.nodes.find((item) => item.id === upstream.source);
      const y = source && source.position ? source.position.y : Y0;
      const yShift = node.type === 'audio' ? 160 : 0;
      node.position = { x: X[node.type], y: y + yShift };
    }
    if (!node.position && node.type !== 'group') node.position = { x: 80, y: Y0 };
  }
  return next;
}

module.exports = { layoutGraph };
```

`apply_ops` 遇到 `layout_nodes` 时 `graph = layoutGraph(graph, op.node_ids)`。`create_node` 的 `position` 为 `null` 时先放入图，批末若仍有 `position === null` 的节点，对整图调用 `layoutGraph`。已有坐标的节点在 `onlyIds` 为空时也会被重排；规格说「未指定则重排整张图」。`layout_nodes` 不带 id 时传 `null`。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-layout.test.js test/freeCanvas-commands.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/src/services/freeCanvas/layout.js backend-node/src/services/freeCanvas/commands.js backend-node/test/freeCanvas-layout.test.js
git commit -m "feat: lay out free canvas chains from the script"
```

---

### Task 5: 命令 HTTP

**Files:**
- Create: `backend-node/src/routes/freeCanvas.js`
- Modify: `backend-node/src/routes/index.js`（在 `setupRouter` 末尾、`return r` 之前挂路由）
- Test: `backend-node/test/freeCanvas-routes.test.js`

**Step 1: Write the failing test**

用现有路由测试的方式直接调用 handler，不拉起端口。参考 `backend-node/test/agent-routes.test.js` 里如何伪造 `req`/`res`。断言：

- `POST` 创建后 `GET /` 列表含该画布。
- `POST /:id/commands`，body `{ name: 'apply_ops', revision: 1, ops: [...] }` 成功后 revision 为 2。
- 用 revision `1` 再提交一次，状态思路是 handler 调用 `response.badRequest`，正文含 `画布已被更新`。看 `response.badRequest` 的 JSON 字段是 `error.message`。测试读取 `res.body.error.message`。

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-routes.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

`freeCanvas.js` 导出 `routes(db, log)`，方法：`list`、`create`、`get`、`command`。

`command`：

```js
const canvas = getCanvas(db, req.params.id);
if (!canvas) return response.notFound(res, '画布不存在');
if (req.body.name === 'get_canvas' || req.body.name === 'get_node') {
  return response.success(res, summarize(canvas, req.body));
}
if (Number(req.body.revision) !== canvas.revision) {
  return response.badRequest(res, '画布已被更新');
}
const applied = applyCommand(canvas.document, req.body, createIdFactory());
if (!applied.ok) return response.badRequest(res, applied.error);
const saved = saveDocument(db, canvas.id, canvas.revision, applied.graph);
if (!saved.ok) return response.badRequest(res, saved.error);
return response.success(res, { canvas: saved.canvas, receipt: { ...applied.receipt, revision: saved.canvas.revision } });
```

`get_canvas` 的摘要由 `document.summarize(canvas)` 产生：每个节点只给 `id`、`type`、`status`、`shot_number`、文本截到 120 字、全部边、`revision`、`title`、`aspect_ratio`。`get_node` 返回一个节点全文。这两个不写库。

`update_canvas` 在路由里处理：校验比例属于 `9:16`、`16:9`、`1:1`，调用 `saveColumns`。

在 `routes/index.js`：

```js
const freeCanvasRoutes = require('./freeCanvas');
const freeCanvas = freeCanvasRoutes(db, log);
r.get('/free-canvases', freeCanvas.list);
r.post('/free-canvases', freeCanvas.create);
r.get('/free-canvases/:id', freeCanvas.get);
r.post('/free-canvases/:id/commands', freeCanvas.command);
```

`createIdFactory` 在生产里用时间戳加随机，不要用从 1 开始的测试工厂，否则重启后 id 会撞。`document.js` 再导出 `runtimeIdFactory()`：`() => (kind) => `${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}``。路由用它。测试仍传入 `createIdFactory()`。`applyCommand` 第三个参数可选，缺省用 `runtimeIdFactory()`。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-routes.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/src/routes/freeCanvas.js backend-node/src/routes/index.js backend-node/src/services/freeCanvas/document.js backend-node/test/freeCanvas-routes.test.js
git commit -m "feat: expose free canvas commands over HTTP"
```

---

### Task 6: 上传节点的文件

**Files:**
- Modify: `backend-node/src/routes/freeCanvas.js`
- Modify: `backend-node/src/routes/index.js`
- Test: `backend-node/test/freeCanvas-upload.test.js`

**Step 1: Write the failing test**

内存库建一块画布，`apply_ops` 建一个 `upload` 节点。调用 upload handler，传入 `{ node_id, revision, filename: 'a.png', buffer: Buffer.from('png') }`，并注入 `writeFile(absPath, buffer)` 假函数，记录路径以 `free-canvases/<id>/uploads/` 结尾。断言节点 `data.local_path` 被写入，`source_file_name` 为 `a.png`，revision 加 1。没有 `node_id` 时不写文件。

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-upload.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

上传不走 `apply_ops` 的可写字段。路由 `upload(req, res, deps)` 在 revision 匹配时直接改该节点的 `data.local_path`、`data.image_url`、`data.source_file_name`，`status` 设为 `succeeded`。`image_url` 用现有静态访问前缀 `/static/` 加上相对路径。磁盘相对路径：`free-canvases/<canvasId>/uploads/<nodeId>-<filename>`。文件名只保留basename，去掉 `..` 和斜杠。`deps.writeFile` 默认是 `fs.promises.writeFile`，根目录用现有 `videoMergeService.getStorageRoot()` 的同一配置读取方式：`loadConfig().storage.local_path`。

`index.js` 用 multer `memoryStorage`，字段名 `file`，限制 20MB：

```js
r.post('/free-canvases/:id/upload', uploadImage.single('file'), freeCanvas.upload);
```

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-upload.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/src/routes/freeCanvas.js backend-node/src/routes/index.js backend-node/test/freeCanvas-upload.test.js
git commit -m "feat: upload a file onto a free canvas node"
```

---

### Task 7: 前端回执和确认卡

**Files:**
- Create: `frontweb/src/utils/freeCanvasReceipt.js`
- Test: `frontweb/test/freeCanvasReceipt.test.js`

**Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyReceipt, pendingConfirmNodes, assistantTextChangesGraph } from '../src/utils/freeCanvasReceipt.js'

test('applies a receipt and ignores assistant prose', () => {
  const doc = { nodes: [], edges: [] }
  const next = applyReceipt(doc, {
    ok: true,
    graph: { nodes: [{ id: 'script_1', type: 'script' }], edges: [] },
  })
  assert.equal(next.nodes[0].id, 'script_1')
  assert.equal(assistantTextChangesGraph('已经建好剧本节点'), false)
})

test('one canvas has a single confirm card', () => {
  const nodes = [
    { id: 'a', status: 'awaiting_confirm' },
    { id: 'b', status: 'awaiting_confirm' },
    { id: 'c', status: 'idle' },
  ]
  assert.deepEqual(pendingConfirmNodes(nodes).map((node) => node.id), ['a', 'b'])
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontweb && node --test test/freeCanvasReceipt.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

```js
export function applyReceipt(document, receipt) {
  if (!receipt || receipt.ok !== true || !receipt.graph) return document
  return receipt.graph
}

export function assistantTextChangesGraph() {
  return false
}

export function pendingConfirmNodes(nodes) {
  return (nodes || []).filter((node) => node.status === 'awaiting_confirm')
}
```

接口实际返回 `{ canvas, receipt }`。`applyReceipt` 同时接受 `payload.canvas.document`：

```js
export function documentFromCommandResponse(payload) {
  if (payload && payload.canvas && payload.canvas.document) return payload.canvas.document
  return null
}
```

补一个测试：`documentFromCommandResponse({ canvas: { document: { nodes: [{ id: 'n' }] } } })` 取到该文档；`{ reply: '已经做好了' }` 返回 `null`。

**Step 4: Run test to verify it passes**

Run: `cd frontweb && node --test test/freeCanvasReceipt.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add frontweb/src/utils/freeCanvasReceipt.js frontweb/test/freeCanvasReceipt.test.js
git commit -m "feat: merge free canvas receipts without trusting chat text"
```

---

### Task 8: 画布列表和空白画布页

**Files:**
- Create: `frontweb/src/api/freeCanvas.js`
- Create: `frontweb/src/views/StudioList.vue`
- Create: `frontweb/src/views/StudioCanvas.vue`
- Modify: `frontweb/src/router/index.js`
- Modify: `frontweb/src/views/FilmList.vue`（快速开始卡片里、新建短剧按钮下面加一个按钮）

**Step 1: Write the failing test**

这个任务的纯逻辑已经在 Task 7。此处不新增会连真实后端的测试。先把路由和页面接上，用手测清单验证。

**Step 2: 跳过单独的失败测试**

没有可在 `node --test` 里渲染 Vue 的现成设施。不要为这一步引入新的组件测试框架。

**Step 3: Write the implementation**

`frontweb/src/api/freeCanvas.js` 用 `@/utils/request`：

- `list()` → `GET /free-canvases`
- `create(title)` → `POST /free-canvases`
- `get(id)` → `GET /free-canvases/:id`
- `command(id, body)` → `POST /free-canvases/:id/commands`
- `upload(id, nodeId, revision, file)` → `FormData` 字段 `file`、`node_id`、`revision`

`router/index.js` 增加：

```js
{ path: '/studio', name: 'studio-list', component: () => import('@/views/StudioList.vue'), meta: { title: '自由画布' } },
{ path: '/studio/:id', name: 'studio', component: () => import('@/views/StudioCanvas.vue'), meta: { title: '自由画布' } },
```

`FilmList.vue` 快速开始里加按钮「自由画布」，`@click="$router.push('/studio')"`。不要恢复被注释的「自由创作」。

`StudioList.vue`：进入时 `list()`。空列表显示「还没有画布」和「新建画布」。新建调用 `create('未命名画布')` 后 `router.push('/studio/' + id)`。每张卡片显示标题和更新时间，点击进入。

`StudioCanvas.vue` 这一任务只做手改，不做对话：

- `onMounted` 调用 `get(id)`，把 `document` 交给 `<VueFlow>`。
- 节点类型先都用一个 `StudioNode`，按 `type` 显示中文名和主文本字段。
- 顶栏：标题输入框失焦时发 `update_canvas`；比例下拉只含 `9:16`、`16:9`、`1:1`。
- 「添加节点」菜单只含规格里的 13 类。点击后 `apply_ops` 一条 `create_node`，`revision` 用当前画布的 revision。
- 连线放下时，根据两端类型选择规格表里第一条合法 relation；没有则 `ElMessage.error('这种连线不允许')` 并去掉这条本地边。
- 拖拽用 400ms 防抖，把当前全部 `position` 合成一条 `move_nodes`。请求返回 `画布已被更新` 时重新 `get`。
- 成功响应只用 `documentFromCommandResponse` 替换本地文档。
- 不引用 `DramaCanvas.vue`。

`@vue-flow/core` 的背景和控件按 `DramaCanvas.vue` 同样的组件名引入：`VueFlow`、`Background`、`Controls`。

**Step 4: 手测**

启动 `backend-node` 的 `npm run dev` 和 `frontweb` 的 `npm run dev`。打开首页，进入自由画布，新建一块，添加剧本节点，拖动后刷新，位置还在。比例改成 `16:9` 后刷新仍在。

**Step 5: Commit**

```bash
git add frontweb/src/api/freeCanvas.js frontweb/src/views/StudioList.vue frontweb/src/views/StudioCanvas.vue frontweb/src/router/index.js frontweb/src/views/FilmList.vue
git commit -m "feat: open a free canvas from the project list"
```

---

### Task 9: 提示词拼装

**Files:**
- Create: `backend-node/src/services/freeCanvas/prompts.js`
- Test: `backend-node/test/freeCanvas-prompts.test.js`

**Step 1: Write the failing test**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { promptForImage, promptForVideo, spokenText } = require('../src/services/freeCanvas/prompts');

const graph = {
  nodes: [
    { id: 'style_2', type: 'style', data: { text: '水墨' } },
    { id: 'style_1', type: 'style', data: { text: '夜戏' } },
    { id: 'c', type: 'character', data: { name: '阿兰', prompt: '短发' } },
    { id: 'b', type: 'storyboard', data: { prompt: '推门', duration: 5, dialogue: '谁' } },
    { id: 'i', type: 'image', data: { prompt: '' } },
    { id: 'v', type: 'video', data: {} },
    { id: 'a', type: 'audio', data: { text: '' } },
  ],
  edges: [
    { source: 'b', target: 'i', relation: 'prompt_for' },
    { source: 'c', target: 'i', relation: 'context_for' },
    { source: 'style_2', target: 'i', relation: 'prompt_for' },
    { source: 'style_1', target: 'i', relation: 'prompt_for' },
    { source: 'i', target: 'v', relation: 'media_input_for' },
    { source: 'b', target: 'a', relation: 'prompt_for' },
  ],
};

describe('free canvas prompts', () => {
  it('joins the storyboard, character, and styles sorted by id', () => {
    const text = promptForImage(graph, 'i');
    assert.match(text, /推门/);
    assert.match(text, /阿兰/);
    assert.match(text, /短发/);
    assert.ok(text.indexOf('夜戏') < text.indexOf('水墨'));
    assert.equal(promptForVideo(graph, 'v').duration, 5);
    assert.match(promptForVideo(graph, 'v').prompt, /夜戏/);
    assert.equal(spokenText(graph, 'a'), '谁');
  });
});
```

视频节点没有直接连风格。`promptForVideo` 从上游图片再收集风格，或从上游分镜收集。测试要求视频提示词也含「夜戏」。实现时：视频先找 `media_input_for` 的图片，再沿图片的入边收集风格和分镜提示词。

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-prompts.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

`promptForImage`：节点自己的 `prompt` 非空就用它，否则用上游 `storyboard.prompt`。追加所有 `context_for` 入边的 `name` 与 `prompt`。风格节点按 id 升序，用中文逗号连接在末尾。

`promptForVideo` 返回 `{ prompt, duration, imagePath }`。`duration` 用视频节点自己的，否则分镜的，否则 5。`imagePath` 取上游图片的 `local_path` 或 `image_url`。

`spokenText`：音频节点 `text` 非空就用它，否则上游分镜 `dialogue`。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-prompts.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/src/services/freeCanvas/prompts.js backend-node/test/freeCanvas-prompts.test.js
git commit -m "feat: assemble free canvas prompts from connected nodes"
```

---

### Task 10: 文本运行和拆分镜

**Files:**
- Create: `backend-node/src/services/freeCanvas/run.js`
- Test: `backend-node/test/freeCanvas-run-text.test.js`

**Step 1: Write the failing test**

注入 `completeText`。用例：

- 没有文本配置：`deps.hasTextModel` 返回 false。`runNode` 对剧本 `generate_text` 返回 `{ ok: false, error: '请先在 AI 配置里添加对应模型' }`，图的节点数不变。
- `completeText` 返回 `'正文'`。剧本 `text` 变为 `正文`，`status` 为 `succeeded`。
- `split_storyboards`：`completeText` 返回 JSON 数组 2 条 `{ action, dialogue, prompt, duration }`。图上新增 2 个分镜并连到剧本。
- 已有分镜再连一张图片时，再次 `split_storyboards` 返回失败，节点数不变。
- 返回 31 条时失败，节点数不变。
- `completeText` 抛错时节点数不变。

`runNode(graph, { node_ids, action, instruction }, deps)`。

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-run-text.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

`split_storyboards` 只允许剧本节点，且不存在从该剧本出发、再从分镜出发指向 `image` 或 `video` 的路径。更直接：该剧本已经有任何分镜出边就拒绝，错误 `这个剧本已经有分镜`。规格原文是「该剧本还没有分镜才允许」以及「下游已有图片时拒绝拆分」。两句都满足的做法：已经有分镜就拒绝。测试里的「已有图片」情形包含已有分镜，因此会拒绝。不要做成「有分镜但没图片就允许覆盖」。

解析模型输出：截取第一个 `[` 到最后一个 `]`，`JSON.parse`。每条只用 `action`、`dialogue`、`prompt`、`duration`。`shot_number` 从 1 递增。超过 30 条在写入前拒绝。

`generate_text` 对剧本：把 `premise`、现有 `text`、`instruction` 拼进 user prompt。对分镜：把上游剧本文本和这一镜的现有字段拼进去，要求模型只回 JSON `{ action, dialogue, prompt }`。

缺模型时不调用 `completeText`。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-run-text.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/src/services/freeCanvas/run.js backend-node/test/freeCanvas-run-text.test.js
git commit -m "feat: write script and storyboard text on the free canvas"
```

---

### Task 11: 付费运行先确认

**Files:**
- Modify: `backend-node/src/services/freeCanvas/run.js`
- Test: `backend-node/test/freeCanvas-run-confirm.test.js`

**Step 1: Write the failing test**

- 两个图片节点 `generate_image`：`deps.createImage` 调用次数为 0，两个节点 `status` 为 `awaiting_confirm`，结果 `{ ok: true, pending: true }`。
- 已有 `awaiting_confirm` 时再对视频调用 `generate_video`，返回失败 `还有未确认的生成`，视频节点仍是 `idle`。
- `confirmRun(graph, false)` 把等待节点改回 `idle`，错误文案由路由固定为 `用户取消了这次生成`。函数返回 `{ ok: true, cancelled: true, graph }`。
- `confirmRun(graph, true, deps)` 调用 `createImage`，参数 `drama_id` 为 `0`，`storyboard_id` 为 `null`。节点 `status` 为 `running`，`data.generation_id` 等于假服务返回的 id。
- 视频、配音同样在确认前不调用 `createVideo`、`synthesize`。

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-run-confirm.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

`PAID` 为 `generate_image`、`generate_video`、`generate_audio`。`runNode` 看到这些 action：

- 图里已有 `awaiting_confirm` 就拒绝。
- 否则把目标节点标为 `awaiting_confirm`，`data.pending_action` 记下 action。这是服务端字段，不通过 `update_node` 暴露。
- 不调用 deps。

`confirmRun`：

- `approved === false`：这些节点回到 `idle`，删掉 `pending_action`。
- `approved === true`：按 action 调用 deps。图片用 `prompts.promptForImage`，并把它写回 `data.prompt`。`createImage` 的参数是 `{ drama_id: 0, storyboard_id: null, prompt, aspect_ratio }`，比例用调用方传入的画布比例。返回值的 `id` 写入 `generation_id`。
- 视频调用 `createVideo({ drama_id: 0, storyboard_id: null, prompt, duration, aspect_ratio, image_url })`。
- 配音调用 `synthesize({ text, voice_id, storyboard_id: null })`。假服务可同步返回 `{ local_path, audio_url }`，那时直接 `succeeded`。真实 TTS 是同步写文件的，确认后即可标 `succeeded`。图片和视频是异步的，确认后标 `running`。

缺图片或视频或配音配置时，`deps` 对应的 `hasImageModel` / `hasVideoModel` / `hasTts` 为 false，则整次 `runNode` 失败且不改图。错误文案与文本相同：`请先在 AI 配置里添加对应模型`。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-run-confirm.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/src/services/freeCanvas/run.js backend-node/test/freeCanvas-run-confirm.test.js
git commit -m "feat: confirm paid free canvas runs before calling providers"
```

---

### Task 12: 把运行接到现有服务

**Files:**
- Modify: `backend-node/src/routes/videos.js`（把 create 函数体抽成 `videoService.createGeneration(db, log, body)`，路由改为调用它）
- Modify: `backend-node/src/services/videoService.js`
- Modify: `backend-node/src/routes/freeCanvas.js`
- Modify: `backend-node/src/routes/index.js`（`POST /free-canvases/:id/confirm-run`）
- Test: `backend-node/test/freeCanvas-run-route.test.js`

**Step 1: Write the failing test**

路由测试注入假的 `createImage`、`createVideo`、`synthesize`。先 `run_node` 两个图片，断言 `image_generations` 不增加（假服务不插表，断言假函数调用次数为 0，且响应 `pending: true`）。再 `confirm-run` `{ approved: true }`，断言假函数被调用且 `drama_id === 0`。

另测 `compose_video`：两个视频节点都有 `local_path`，按镜号排序后调用 `mergeVideos`。一个视频没有 `local_path` 时合成节点 `status === 'failed'`，`error` 含镜号，且不调用 `mergeVideos`。`hasFfmpeg: false` 时 `error` 含 `ffmpeg`。

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-run-route.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

`videoService.createGeneration` 就是现在 `routes/videos.js` 里 `create` 的插入和 `setImmediate(processVideoGeneration)`。路由 `create` 改为调用它后 `response.created`。自由画布确认时调用它，不经 HTTP。`drama_id` 传 0，`aspect_ratio` 传画布比例，`image_url` 传上游图片地址。现有插入语句已经允许这两个 id 为空，不要新表。

图片确认调用 `imageService.create(db, log, { drama_id: 0, storyboard_id: null, prompt, aspect_ratio })`。

配音确认调用 `ttsService.synthesize`。没有 `voice_id` 时不传，让它走配置默认音色。

合成：收集 `composition_input_for` 指向该节点的视频，上游分镜 `shot_number` 升序，相同则按边在数组里的顺序。调用 `videoMergeService.create` 时 `drama_id` 和 `episode_id` 为 0，`scenes` 为 `[{ video_url: local_path, duration }]`，再 `processVideoMerge`。不要在测试里真的跑 ffmpeg。`deps.mergeVideos` 包装这两步，测试替换它。

命令入口 `run_node`：`apply` 之前调用 `runNode`。若 `pending`，用 `saveDocument` 保存并返回 `{ pending: true, revision, nodeIds, summary }`。文本运行成功也保存。`summary` 例：`将为 2 个节点出图`。

`confirm-run` body `{ approved: true|false }`。拒绝时保存 idle 图，并让响应里的 `agent_message` 为 `用户取消了这次生成`。前端把这句展示在对话里。这一任务可以只返回 JSON，对话展示放在 Task 14。

任务完成写回：新增 `noteFreeCanvasResult(db, { generation_id, kind, url, local_path, error })`。它按 `data.generation_id` 在所有画布文档里找节点。找到后循环最多 5 次：读 revision，改该节点 `status`、`error` 和地址，`saveColumns`。`changes !== 1` 就重试。图片和视频现有完成回调里各加一次调用。用测试调用 `noteFreeCanvasResult`，同时并发 `saveDocument` 一次旧 revision，断言地址最后仍在节点上。这个测试放在 `test/freeCanvas-complete.test.js`，可以和本任务一起提交。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-run-route.test.js test/freeCanvas-complete.test.js`

Expected: PASS。再跑 `node --test test/freeCanvas-*.test.js`，全部 PASS。

**Step 5: Commit**

```bash
git add backend-node/src/services/videoService.js backend-node/src/routes/videos.js backend-node/src/services/freeCanvas/run.js backend-node/src/routes/freeCanvas.js backend-node/src/routes/index.js backend-node/test/freeCanvas-run-route.test.js backend-node/test/freeCanvas-complete.test.js
git commit -m "feat: run free canvas image video audio and compose jobs"
```

---

### Task 13: 画布助手只拿画布工具

**Files:**
- Create: `backend-node/src/mastra/canvasAgent.mjs`
- Create: `backend-node/src/routes/freeCanvasAgent.js`
- Modify: `backend-node/src/routes/index.js`
- Test: `backend-node/test/freeCanvas-agent.test.js`

**Step 1: Write the failing test**

不加载真实模型。导出纯函数 `canvasToolNames(tools)` 和 `dramaToolNames` 的对比不必要。测试 `canvasAgent.mjs` 导出的 `toolIds` 常量：

```js
const { CANVAS_TOOL_IDS } = await import('../src/mastra/canvasAgent.mjs');
assert.deepEqual(CANVAS_TOOL_IDS, [
  'get_canvas', 'get_node', 'apply_ops', 'add_next_node', 'update_node',
  'delete_edges', 'move_nodes', 'layout_nodes', 'group_nodes', 'select_nodes',
  'update_canvas', 'delete_nodes', 'run_node',
]);
```

再从 `backend-node/src/mastra/index.mjs` 断言 `buildTools` 的 key 里没有 `apply_ops`。若 `buildTools` 未导出，改为读源码不现实。把 `dramaToolIds()` 从 `index.mjs` 导出，测试：

```js
const { dramaToolIds } = await import('../src/mastra/index.mjs');
assert.equal(dramaToolIds().includes('apply_ops'), false);
assert.equal(dramaToolIds().includes('get_current_project'), true);
```

`delete_nodes` 的工具定义带 `requireApproval: true`。测试检查 `canvasAgent.deleteNodesNeedsApproval === true`。

画布 id：`execute` 使用 `requestContext.get('canvasId')`，忽略模型参数里的 `canvasId`。用一个假 db 和直接调用 `executeApplyOps({ requestContext, input })` 的导出函数测。输入 `{ canvasId: 999, ops }` 仍改上下文里的画布。

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-agent.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

`canvasAgent.mjs` 照 `index.mjs` 的 `createTool` 写法。每个工具的 `execute` 调用 `freeCanvas` 命令或 `runNode`，画布 id 只从 `requestContext` 取。`delete_nodes` 设 `requireApproval: true`，`execute` 只有在批准后的恢复运行里被调用，那时 `approved` 已由 Mastra 放过，命令传 `approved: true`。

`streamCanvasChat({ canvasId, message, writeEvent })` 使用线程 `studio-${canvasId}`。模型用现有 `resolveTextModel`。系统提示写明：只能用工具改画布；出图、出视频、配音要等用户允许；不要说自己已经改好，除非工具回执 `ok === true`；不能落成项目。

`initCanvasAgent` 失败只把画布助手标为未就绪，不影响 `isAgentReady()` 的剧助手。画布路由看到未就绪时返回 503，正文 `助手未就绪`。

`freeCanvasAgent.js` 复制 `agent.js` 的 SSE 写法。`POST /free-canvas-agent/chat` body `{ message, canvasId }`。`POST /free-canvas-agent/approve` 和 `decline` 只处理删节点的未决审批，校验该 run 的线程属于 `studio-<canvasId>`。`select_nodes` 的工具结果若带 `select`，`writeEvent({ type: 'select', nodeIds })`。

`index.mjs` 只加 `export function dramaToolIds()`，不要把画布工具塞进 `buildTools`。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-agent.test.js test/agent-tools.test.js`

Expected: PASS。剧助手原有测试仍然通过。

**Step 5: Commit**

```bash
git add backend-node/src/mastra/canvasAgent.mjs backend-node/src/mastra/index.mjs backend-node/src/routes/freeCanvasAgent.js backend-node/src/routes/index.js backend-node/test/freeCanvas-agent.test.js
git commit -m "feat: add a canvas agent that cannot edit dramas"
```

---

### Task 14: 画布页上的对话和确认卡

**Files:**
- Create: `frontweb/src/components/studio/StudioChat.vue`
- Modify: `frontweb/src/views/StudioCanvas.vue`
- Modify: `frontweb/src/api/freeCanvas.js`

**Step 1: 不新增浏览器测试框架**

对话事件解析复用 `parseSseBlock`。若要测「select 事件取出 nodeIds」，在 `freeCanvasReceipt.js` 加 `selectIdsFromEvent(event)`，并在 `frontweb/test/freeCanvasReceipt.test.js` 断言 `{ type: 'select', nodeIds: ['a'] }` 得到 `['a']`，其他事件得到空数组。先写这个失败测试。

**Step 2: Run test to verify it fails**

Run: `cd frontweb && node --test test/freeCanvasReceipt.test.js`

Expected: FAIL，`selectIdsFromEvent` 不是函数。

**Step 3: Write minimal implementation**

`StudioChat.vue` 放在画布右侧，宽度 360px。输入框回车发送。请求 `streamAgent('/free-canvas-agent/chat', { message, canvasId }, onEvent)`，复用 `frontweb/src/api/agent.js` 已导出的 `streamAgent`。若未导出，从该文件导出它，不要复制第二份 SSE 读取。

`onEvent`：

- `text-delta` 追加到当前气泡。
- `tool-result` 且 `pending === true`，或本地节点出现 `awaiting_confirm`，显示一张卡：「将为 N 个节点出图/出视频/配音」和允许、拒绝。允许调用 `POST /free-canvases/:id/confirm-run`。拒绝同样调用 `approved: false`，并把返回的 `agent_message` 追加到对话。
- `tool-call-approval` 沿用 `AgentDrawer.vue` 的允许/拒绝，请求改为 `/free-canvas-agent/approve` 和 `decline`，body 带 `canvasId` 而不是 `dramaId`。
- `select` 调用父组件 `setSelection`。
- `error` 且消息是 `助手未就绪` 时，输入框禁用，提示「助手未就绪」。节点按钮仍可用。

打开页面时如果 `get` 到的节点已有 `awaiting_confirm`，立刻显示同一张卡。

每次命令或确认返回后，用 `documentFromCommandResponse` 更新图。不要把助手文本写进节点。

**Step 4: Run test to verify it passes**

Run: `cd frontweb && node --test test/freeCanvasReceipt.test.js`

Expected: PASS

手测：助手未配置时页面仍能添加节点。配置文本模型后，说「写一段两镜的短剧本并拆成两镜」，画布上出现剧本和两个分镜。再说「给两镜出图」，出现一张确认卡，点拒绝后没有新的图片生成记录。

**Step 5: Commit**

```bash
git add frontweb/src/components/studio/StudioChat.vue frontweb/src/views/StudioCanvas.vue frontweb/src/api/freeCanvas.js frontweb/src/api/agent.js frontweb/src/utils/freeCanvasReceipt.js frontweb/test/freeCanvasReceipt.test.js
git commit -m "feat: chat with the free canvas and confirm paid runs"
```

---

### Task 15: 落成预览的数量

**Files:**
- Create: `frontweb/src/utils/freeCanvasSummary.js`
- Create: `backend-node/src/services/freeCanvas/materialize.js`（这一任务只放 `reachableChain` 和 `previewCounts`）
- Test: `frontweb/test/freeCanvasSummary.test.js`
- Test: `backend-node/test/freeCanvas-preview.test.js`

**Step 1: Write the failing test**

后端：一个剧本连着两个分镜，只有第一镜有图片 `local_path`。`previewCounts` 得到 `{ characters: 0, scenes: 0, props: 0, storyboards: 2, images: 1, videos: 0, audios: 0, compose: false }`。另一个不相连的角色不计入。没有剧本时，画布上的分镜都计入，`scriptText` 为 `''`。

前端 `summarizePreview(preview)` 把上述对象变成确认框行：`2 个分镜`、`1 张可用图片`。`removedLabels(preview.removed)` 在 `removed` 为空时返回空数组。

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-preview.test.js`

然后：`cd frontweb && node --test test/freeCanvasSummary.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

`reachableChain(graph, scriptNodeId)`：从剧本沿出边走。`scriptNodeId` 为空时，若剧本节点多于 1 个，返回 `{ ok: false, error: '请选择一个剧本' }`。0 个剧本则收集全部 `storyboard`。1 个剧本则用它。

`previewCounts` 在可达集合里按类型计数。图片、视频、配音只在有 `local_path` 或 url 且 `status !== 'failed'` 时计入可用数。合成节点有 `local_path` 则 `compose: true`。

**Step 4: Run test to verify it passes**

两边的测试 PASS。

**Step 5: Commit**

```bash
git add backend-node/src/services/freeCanvas/materialize.js backend-node/test/freeCanvas-preview.test.js frontweb/src/utils/freeCanvasSummary.js frontweb/test/freeCanvasSummary.test.js
git commit -m "feat: preview what a free canvas will write into a drama"
```

---

### Task 16: 落成事务

**Files:**
- Modify: `backend-node/src/services/freeCanvas/materialize.js`
- Modify: `backend-node/src/routes/freeCanvas.js`
- Test: `backend-node/test/freeCanvas-materialize.test.js`
- 测试库表结构抄 `backend-node/test/helpers/agentTestDb.js`，再补 `image_generations`、`video_generations`、`video_merges` 里落成会写的列，以及 `free_canvases`。

**Step 1: Write the failing test**

准备一块画布：剧本、角色、场景、道具、两镜、第一镜有 `generation_id` 和 `local_path`。`copyFile` 假函数把源路径记录下来并成功。

断言第一次 `materialize`：

- 新建 1 部剧、1 集，`script_content` 等于剧本文本。
- 角色、场景、道具各 1 行，图片地址是复制后的剧目录路径，不是画布原路径。
- 2 条分镜。第一镜 `image_prompt` 有值，`image_generations.drama_id` 和 `storyboard_id` 已改。第二镜没有图片地址。
- 画布 `materialized_drama_id` 和节点 `bound_id` 已写。
- 角色表的插入不要调用 `saveCharacters`。测试可以 spy 不了未导出的函数，就断言另一条预先插入、不属于这次的角色还在。

第二次：把第一镜 `action` 改成 `回头`，去掉第二镜节点，不传 `delete_bound_ids`。断言第一镜动作已更新，第二镜行还在，剧 id 不变。

传入第二镜的 `bound_id` 后，该分镜 `deleted_at` 非空。

失败：`copyFile` 对第一镜抛错。断言该分镜行存在、`image_url` 为空、结果 `missing` 含该镜号，剧仍然创建。这是规格里的「复制失败只跳过文件」。另测事务失败：让插入分镜的下一步抛错（给 `materialize` 注入 `failAfter: 'episode'`）。断言 `dramas` 行数为 0，画布 `materialized_drama_id` 仍为空。

**Step 2: Run test to verify it fails**

Run: `cd backend-node && node --test test/freeCanvas-materialize.test.js`

Expected: FAIL

**Step 3: Write minimal implementation**

`materialize(db, log, canvasId, { script_node_id, delete_bound_ids, copyFile, dramaDir })` 包在 `db.transaction` 里。

第一次：

- `dramaService.createDrama` 的标题用画布标题，`metadata.aspect_ratio` 用画布比例，`style` 用可达风格节点按 id 升序、逗号拼接。
- 插入一集，或调用不会软删除其他集的单行插入。字段：`episode_number = 1`，`title` 用剧本标题，`script_content` 用正文。
- 角色插入列与 `dramaService.js` 里单条 `INSERT INTO characters` 一致，只写名字、`appearance`（节点 prompt）、图片地址。不要调用 `saveCharacters`。
- 场景用 `sceneService.createScene`。道具用 `propService` 里已有的单条创建。若该函数会写别的剧的数据，改为同样的单行 `INSERT`。
- 分镜用 `storyboardService.createStoryboard`。`scene_id` 用连到该镜的场景节点的 `bound_id`。角色列表写该镜 `context_for` 角色的新 id。
- 复制文件到 `dramaDir`，目标名 `<nodeId>-<basename>`。复制成功才把地址写进分镜和生成记录。`image_generations` 更新 `drama_id`、`storyboard_id`。视频表同样。配音写分镜 `audio_local_path`。合成插入 `video_merges`，`merged_url` 指向复制后的文件，`status` 为 `completed`，不调用 ffmpeg。
- 节点写 `data.bound_id`。画布写 `materialized_drama_id`。这两步在同一事务末尾。

再次落成：按 `bound_id` `UPDATE`，不用 `saveEpisodes`。`delete_bound_ids` 里的分镜、角色、场景、道具做软删除（`deleted_at`）。不在列表里的、画布已没有的行保持不动。

`failAfter: 'episode'` 只在测试注入，生产不传。实现为插入集之后若 `deps.failAfter === 'episode'` 则 `throw`。事务回滚。

路由 `POST /free-canvases/:id/materialize`。也提供 `POST /free-canvases/:id/materialize-preview`，只返回计数、剧本选项和 `removed`。`removed` 的算法：上次落成的 `bound_id` 不在本次可达节点里。预览要读剧表里仍未软删除的那些 id，避免把已经删掉的又列出来。

**Step 4: Run test to verify it passes**

Run: `cd backend-node && node --test test/freeCanvas-materialize.test.js test/freeCanvas-preview.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add backend-node/src/services/freeCanvas/materialize.js backend-node/src/routes/freeCanvas.js backend-node/test/freeCanvas-materialize.test.js
git commit -m "feat: materialize a free canvas chain into one drama"
```

---

### Task 17: 落成按钮

**Files:**
- Modify: `frontweb/src/views/StudioCanvas.vue`
- Modify: `frontweb/src/api/freeCanvas.js`

**Step 1: 前端数量测试已在 Task 15**

不重复。这一步把预览接到对话框。

**Step 2: 无新的失败单测**

**Step 3: Write the implementation**

顶栏按钮「落成项目」。点击先请求 `materialize-preview`。多个剧本时用 `el-select` 选择，选完重新请求预览。确认框用 `summarizePreview` 列出数量，`removed` 每项一个默认不勾的复选框。确定后把勾选的 `bound_id` 和 `script_node_id` 发给 `materialize`。

成功后 `ElMessage.success`，并给一个按钮「打开项目」，`router.push('/film/' + dramaId)`。对话框里展示 `missing` 文案，例如 `第 2 镜的图片没有复制成功`。

失败显示接口返回的中文 `error.message`，不关闭画布、不改本地文档，重新 `get` 一次。

**Step 4: 手测**

做一块含剧本、一镜、一张已确认生成的图的画布。落成后打开 `/film/:id`，能看到第 1 集剧本和这一镜。回到自由画布改动作，再落成，列表里的动作变了，剧没有变成两部。取消勾选「删除」时，从画布删掉的镜在列表里还在。

**Step 5: Commit**

```bash
git add frontweb/src/views/StudioCanvas.vue frontweb/src/api/freeCanvas.js
git commit -m "feat: materialize a free canvas from the studio toolbar"
```

---

### Task 18: 全量回归

**Step 1: Run backend tests**

Run: `cd backend-node && node --test test/freeCanvas-*.test.js test/agent-tools.test.js test/agent-routes.test.js`

Expected: PASS

**Step 2: Run frontend tests**

Run: `cd frontweb && node --test test/freeCanvasReceipt.test.js test/freeCanvasSummary.test.js test/agentStream.test.js`

Expected: PASS

**Step 3: 手测整条链路**

1. 首页进入自由画布，不打开任何旧项目。
2. 让助手写剧本并拆成两镜。
3. 出图时点拒绝，数据库 `image_generations` 不增加。
4. 再出图并允许，节点进入运行，完成后图片出现在节点上。刷新后仍在。
5. 出视频、配音、合成。没有 ffmpeg 时合成节点显示缺少 ffmpeg，其他节点还在。
6. 落成，打开列表模式。旧画布 `/film/:id/canvas` 仍是这部剧的结构视图。
7. 打开原来就有的另一部剧，它的剧助手对话里没有画布命令。

**Step 4: Commit**

只有文档或测试修正才提交。信息用 `test: cover the free canvas chain`。没有改动就不要空提交。
