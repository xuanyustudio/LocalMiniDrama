# 漫剧画布工作流（LibTV 式）实施计划

> 目标：在 LocalMiniDrama 现有 `project.json` / SQLite 数据之上，增加 LibTV 风格的无限画布视图；列表模式（FilmCreate）与画布模式双视图、单数据源。

**最后更新**：2026-06-15（阶段 D：交互增强、媒体对齐、全能模式）

## 设计原则

1. **真源不变**：角色、分镜、图片、视频仍存现有表与 `project.json` 结构。
2. **画布是视图层**：额外持久化 `drama.metadata.canvas_layout`（坐标、视口）与 `workflow_groups`（工作流组）。
3. **旧 JSON 兼容**：无 `canvas_layout` 时自动布局；导入/导出忽略未知 metadata 字段不影响旧版。
4. **列表模式对齐**：画布读取分镜图/视频/首尾帧/全能词的逻辑与 `FilmCreate.vue` 一致（通过 `/images`、`/videos` API + `storyboardMedia.js`）。
5. **技术栈**：Vue 3 + `@vue-flow/core` ^1.48（与 Element Plus / Pinia 一致）。

---

## 阶段 A：只读画布 MVP（已完成）

### 交付物

- [x] 路由 `/film/:id/canvas`
- [x] `FilmCreate` / `DramaDetail` 顶部「画布模式」入口
- [x] `dramaCanvasAdapter.js`：`drama` API 数据 → nodes/edges 自动布局
- [x] `DramaCanvas.vue`：平移缩放、小地图、集数筛选
- [x] 双击分镜节点 → 跳转列表模式并定位集数

---

## 阶段 B：布局持久化 + 素材侧栏交互（已完成）

### 交付物

- [x] 节点可拖动，debounce 保存 `metadata.canvas_layout`（PUT `/dramas/:id/canvas-layout`）
- [x] 导出 ZIP 时 `canvas_layout` 写入 `drama.metadata`
- [x] 左侧素材库点击高亮关联分镜与连线
- [x] 画布 ↔ 列表模式双向入口，保留集数筛选 query
- [x] 分镜节点展示生成状态，生成中自动轮询刷新

---

## 阶段 C：工作流编排（整组重跑）（已完成）

### 交付物

- [x] 框选 / Ctrl 多选分镜 →「创建工作流」
- [x] `metadata.workflow_groups` 持久化（随项目导出）
- [x] 流水线配置：生图 → 生视频 → 配音（可勾选）
- [x] 「整组重跑」按组内分镜顺序依次执行
- [x] 分镜节点显示所属工作流标签

### 数据结构（实际实现）

```json
{
  "canvas_layout": {
    "version": 1,
    "viewport": { "x": 0, "y": 0, "zoom": 0.75 },
    "nodes": { "sb:12": { "x": 360, "y": 144 } },
    "updated_at": "2026-06-15T12:00:00.000Z"
  },
  "workflow_groups": [
    {
      "id": "wg-1700000000-abc123",
      "title": "第一场批量",
      "storyboard_ids": [12, 13, 14],
      "pipeline": ["image", "video", "audio"],
      "created_at": "2026-06-15T12:00:00.000Z"
    }
  ]
}
```

> 注：早期草案中的 `node_refs` 已改为 `storyboard_ids`（仅存分镜 ID，媒体节点由 adapter 动态生成）。

---

## 阶段 D：交互与媒体对齐（2026-06-15，已完成）

### 交付物

#### 1. 连线与布局

- [x] 连线改为 Vue Flow 贝塞尔曲线（`type: default`，`curvature: 0.62`）
- [x] **默认布局改为竖排**：每个分镜占一行，自上而下；单行内仍为「分镜 → 媒体链」横向展开
- [x] 分镜顺序链改为上下连接（`chain-out` / `chain-in` 锚点）

#### 2. 节点内操作面板（无需切列表模式）

- [x] 单击分镜 / 媒体 / 素材节点，下方展开操作面板；单击空白画布关闭
- [x] 分镜面板：编辑动作、对白、提示词；保存 / 润色 / 生图 / 生视频 / 配音
- [x] 媒体面板：预览 + 对应步骤重跑
- [x] 素材面板：信息展示 + 生成参考图 + 高亮关联分镜
- [x] 面板区域 `nodrag nopan`，避免与画布拖拽冲突

#### 3. 媒体读取与列表模式对齐

- [x] `useCanvasStoryboardMedia.js`：进入画布时按集批量拉取 `/images`、`/videos`
- [x] `storyboardMedia.js`：首帧 / 尾帧 / 主图 / 视频解析（对齐 `FilmCreate.getSbFirstImage` 等）
- [x] 后端 `dramaService.rowToStoryboard` 补全 `first_frame_*`、`last_frame_*` 字段
- [x] 首尾帧模式：画布展示 **首帧** + **尾帧** 两个图节点（`sbimg-first` / `sbimg-last`）
- [x] 画布内生成视频时传递 `first_frame_url` / `last_frame_url`

#### 4. 全能模式（`creation_mode === 'universal'`）

- [x] 不展示空的分镜图节点
- [x] 流水线：`分镜 → 全能分镜词 → 视频`（节点 `sbuni:{id}`，kind `universal`）
- [x] 分镜卡片显示「全能」徽章；操作面板编辑 `universal_segment_text`，隐藏生图入口

#### 5. 框选与工作流交互修复

- [x] Vue Flow 1.48 移除 `selection-on-drag`，改为 `:selection-key-code="true"` 实现左键框选
- [x] `:pan-on-drag="[1, 2]"`：左键框选，中键/右键平移画布

---

## 默认布局规则（2026-06-15）

```
┌─────────────────────────────────────────────────────────────────┐
│ 顶栏：列表模式 | 集数 | 工作流条（创建/选择/整组重跑/删除）        │
├──────────────┬──────────────────────────────────────────────────┤
│ 素材库       │  第1集                                            │
│ 👤 角色      │  [SB#1] ─→ [文本] ─→ [首帧] ─→ [尾帧] ─→ [视频]   │
│ 🏞 场景      │  [SB#2] ─→ ...          （竖排，每镜一行）         │
│ 🎭 道具      │  [SB#3] ─→ [全能分镜词] ─→ [视频]  （全能模式）    │
│ 工作流列表   │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

- 左栏（x≈48）：角色 / 场景 / 道具 + 工作流列表
- 右栏（x≥360）：每集标题 + 分镜竖排；单行内媒体节点横向排列
- 虚线（绿色）：素材 → 分镜
- 实线（紫色/蓝）：分镜 → 媒体、分镜 ↓ 分镜（顺序链）
- 曲线：所有边为贝塞尔曲线

> 已有 `canvas_layout` 的项目仍使用已保存坐标；清除 metadata 中 `canvas_layout.nodes` 可恢复新默认竖排。

---

## 节点 ID 规范

| ID 格式 | 含义 |
|---------|------|
| `char:{id}` | 角色 |
| `scene:{id}` | 场景 |
| `prop:{id}` | 道具 |
| `episode:{id}` | 集标题 |
| `drama:header` | 项目标题 |
| `sb:{id}` | 分镜 |
| `sbtxt:{id}` | 分镜文本摘要（经典模式） |
| `sbuni:{id}` | 全能分镜词（全能模式） |
| `sbimg:{id}` | 分镜图（经典单图） |
| `sbimg-first:{id}` | 首帧图（首尾帧模式） |
| `sbimg-last:{id}` | 尾帧图（首尾帧模式） |
| `sbvid:{id}` | 分镜视频 |
| `sbaud:{id}:dialogue` | 对白音频 |

---

## 用户使用说明

### 画布基本操作

| 操作 | 效果 |
|------|------|
| 左键在**空白处**拖拽 | 框选多个分镜 |
| Ctrl + 点击分镜 | 多选 / 取消选择 |
| 中键 / 右键拖拽 | 平移画布 |
| 滚轮 | 缩放 |
| 单击节点 | 展开下方操作面板 |
| 单击空白 | 关闭操作面板 |
| 双击分镜 | 跳转列表模式并定位 |
| 拖动节点 | 保存布局（debounce） |

### 工作流（批量生成）

1. 框选或 Ctrl 选中多个**分镜节点**（带 `#N` 的卡片，不是媒体子节点）
2. 勾选步骤：生图 / 生视频 / 配音（全能模式分镜建议只勾生视频）
3. 点 **创建工作流**，输入名称
4. 在 **选择工作流** 下拉框（或左侧列表）选中该组
5. 点 **整组重跑**：按组内分镜顺序依次执行；某一镜失败则停止
6. **删除工作流** 仅删除分组配置，不删除分镜与媒体

### 经典 / 首尾帧 / 全能 三种流水线展示

| 模式 | 画布媒体链 |
|------|------------|
| 经典 | 文本 → 分镜图 → 视频 →（音频） |
| 首尾帧（`metadata.storyboard_use_first_last_frame`） | 文本 → 首帧 → 尾帧 → 视频 →（音频） |
| 全能（`creation_mode: universal`） | 全能分镜词 → 视频 →（音频） |

---

## 文件结构

```
frontweb/src/
  views/DramaCanvas.vue
  composables/
    useCanvasContext.js          # provide/inject 画布上下文
    useCanvasStoryboardMedia.js  # 批量加载 images/videos
    useCanvasWorkflowRunner.js   # 单步/整组生成（export runImageStep 等）
  utils/
    dramaCanvasAdapter.js        # drama → Vue Flow 图
    canvasLayout.js              # layout 解析/持久化
    canvasWorkflow.js            # workflow_groups CRUD
    storyboardMedia.js           # 首帧/尾帧/视频 URL 解析（对齐列表模式）
    mediaUrl.js
  components/dramaCanvas/
    CanvasAssetNode.vue
    CanvasAssetPanel.vue
    CanvasEpisodeNode.vue
    CanvasDramaHeaderNode.vue
    CanvasLabelNode.vue
    CanvasStoryboardNode.vue
    CanvasStoryboardPanel.vue
    CanvasMediaNode.vue
    CanvasMediaPanel.vue

backend-node/src/services/
  dramaService.js                # rowToStoryboard 含首尾帧字段
```

### API

- `GET /api/v1/dramas/:id` — 项目数据（含 metadata）
- `PUT /api/v1/dramas/:id/canvas-layout` — 保存 `canvas_layout` 和/或 `workflow_groups`
- `GET /api/v1/images?storyboard_id=` — 画布加载分镜图列表
- `GET /api/v1/videos?storyboard_id=` — 画布加载分镜视频列表

---

## Vue Flow 配置要点

```vue
<VueFlow
  :selection-key-code="true"
  :pan-on-drag="[1, 2]"
  :pan-on-scroll="true"
  :elements-selectable="true"
/>
```

> **勿使用** 已废弃的 `selection-on-drag`（@vue-flow/core 1.41+ 已移除，配置了也不生效）。

---

## 风险与规避

| 风险 | 规避 |
|------|------|
| 分镜过多画布过长 | 集数筛选 + fitView + 小地图 + 竖排一镜一行 |
| metadata 合并覆盖 | update 时 merge 现有 metadata |
| 画布与列表媒体不一致 | 统一走 `storyboardMedia.js` + images/videos API |
| 全能模式误触生图 | 全能分镜隐藏生图；工作流勾选项需用户自行判断 |
| 框选无效 | 必须在空白处拖拽；或 Ctrl 点击多选 |
| Vue Flow 包体积 | 画布路由按需加载 |

---

## 后续可选 / TODO

### 画布与工作流

- [ ] 全能模式画布内润色 / 流式编辑全能词
- [ ] 工作流组内分镜顺序可视化拖拽调整
- [ ] 多集同时展示时的节点虚拟化（仅渲染视口内）
- [ ] 画布内首尾帧单独生图（走 frame-prompt 模块，对齐列表模式完整能力）
- [ ] 顶栏工作流区域增加简短帮助 tooltip

### 场景与素材

- [ ] **场景图 → 全景图**：基于已有场景参考图/背景图，AI 扩展或生成超宽/360° 全景图；可用于场景库展示、分镜大景别运镜参考，以及全能模式 `@图片N` 的环境图；需评估与现有 `scenes` 表、`generateImage` / 四视图流程的衔接方式

### 其他

- [ ] 分镜参考图自由上传（列表模式已有部分能力，画布侧统一入口）
- [ ] 参考图自由选择（生成分镜图时手动指定角色/场景参考）
