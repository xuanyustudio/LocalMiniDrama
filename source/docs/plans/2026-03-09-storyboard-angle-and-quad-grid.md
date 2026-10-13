# 分镜图相机角度视角 + 四宫格序列图 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复分镜图生成时背景角度固定的问题（让相机 angle 字段驱动背景透视），并新增四宫格序列图生成模式（通过特殊提示词一次生成含4个画面的分镜参考图）。

**Architecture:**
- 功能一：在 `framePromptService.js` 的 `buildStoryboardContext()` 中新增 `expandAngleDescription()` 辅助函数，将原始 angle 值扩展为含透视含义的详细描述，注入 AI 上下文，让 AI 生成帧提示词时考虑相机视角。
- 功能二：利用 `image_generations.frame_type` 已有字段存储 `'quad_grid'` 标志，在 `imageService.processImageGeneration()` 中检测并走四宫格分支：先串行生成 4 个帧提示词，再拼成四宫格格式提示词，最后生成一张图。前端新增全局开关控制是否启用四宫格模式。

**Tech Stack:** Node.js (Express), better-sqlite3, Vue 3, Element Plus

---

## Task 1：expandAngleDescription — 角度扩展注入

**Files:**
- Modify: `backend-node/src/services/framePromptService.js`（在 `buildStoryboardContext` 前添加辅助函数并调用）

**Step 1: 在 `buildStoryboardContext` 之前添加 `expandAngleDescription` 函数**

在文件第 45 行（`function buildStoryboardContext` 前）插入：

```javascript
function expandAngleDescription(angle) {
  if (!angle) return null;
  const a = angle.toString().trim().toLowerCase();
  // 中文 angle 值（来自分镜生成）
  if (a === '平视' || a === 'eye-level' || a === 'eye level') {
    return '平视视角（eye-level shot）：水平视角，正常透视，背景与人物同高度展开';
  }
  if (a === '仰视' || a === 'low-angle' || a === 'low angle') {
    return '仰视视角（low-angle shot）：从下往上仰拍，背景呈现天空/天花板/建筑顶部的仰视透视，地平线偏低';
  }
  if (a === '俯视' || a === 'high-angle' || a === 'high angle') {
    return '俯视视角（high-angle shot）：从上往下俯拍，背景呈现地面/场景的鸟瞰俯视透视，地平线偏高';
  }
  if (a === '侧面' || a === 'side') {
    return '侧面视角（side angle shot）：从侧面拍摄，背景呈侧向延伸的构图';
  }
  if (a === '背面' || a === 'back') {
    return '背面视角（rear/back shot）：从角色背后拍摄，角色背对镜头，背景场景在角色前方延伸展开';
  }
  // 未匹配到预设值时原样保留
  return `相机角度：${angle}`;
}
```

**Step 2: 在 `buildStoryboardContext` 中调用 `expandAngleDescription`**

找到当前的 angle 处理部分（约第 73-75 行）：
```javascript
  if (sb.angle) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'angle_label', sb.angle));
  }
```

替换为：
```javascript
  if (sb.angle) {
    const angleDesc = expandAngleDescription(sb.angle);
    if (angleDesc) {
      parts.push(promptI18n.formatUserPrompt(cfg, 'angle_label', angleDesc));
    } else {
      parts.push(promptI18n.formatUserPrompt(cfg, 'angle_label', sb.angle));
    }
  }
```

**Step 3: 手动验证（无自动化测试框架，目视检查）**

启动后端，生成一个 angle='仰视' 的分镜的帧提示词，检查日志中传给 AI 的 userPrompt 是否包含 "低角度仰拍" 等扩展描述。

**Step 4: Commit**

```bash
git add backend-node/src/services/framePromptService.js
git commit -m "feat: expand camera angle to perspective description in frame prompt context"
```

---

## Task 2：processImageGeneration 四宫格分支

**Files:**
- Modify: `backend-node/src/services/imageService.js`（在 `processImageGeneration` 中新增 quad_grid 分支）
- Modify: `backend-node/src/services/imageService.js`（新增 `buildQuadGridPrompt` 辅助函数）

**Step 1: 在 `imageService.js` 中引入 framePromptService**

在文件顶部（约第 56-59 行，现有 require 后）追加：
```javascript
const framePromptService = require('./framePromptService');
const loadConfig = require('../config').loadConfig;
```

注意：`loadConfig` 在 `processImageGeneration` 内部已有局部 require，改为顶部引入（删除函数内的重复 require）。

**Step 2: 新增 `buildQuadGridPrompt` 辅助函数**

在 `processImageGeneration` 函数之前添加：

```javascript
/**
 * 四宫格模式：为分镜生成 4 帧提示词，拼成 2×2 grid 格式的单张图生成提示词
 */
async function buildQuadGridPrompt(db, log, storyboardId, model) {
  let cfg = loadConfig();
  // 复用 framePromptService 内的辅助函数
  const sb = framePromptService.loadStoryboard(db, storyboardId);
  if (!sb) throw new Error('分镜不存在');

  // 读取 drama style
  try {
    const epRow = db.prepare(
      'SELECT drama_id FROM episodes WHERE id = (SELECT episode_id FROM storyboards WHERE id = ? AND deleted_at IS NULL) AND deleted_at IS NULL'
    ).get(Number(storyboardId));
    if (epRow && epRow.drama_id) {
      const dramaRow = db.prepare('SELECT style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(epRow.drama_id);
      if (dramaRow) {
        const styleOverrides = {};
        if (dramaRow.style && String(dramaRow.style).trim()) {
          styleOverrides.default_style = String(dramaRow.style).trim();
        }
        if (dramaRow.metadata) {
          try {
            const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
            if (meta && meta.aspect_ratio) {
              styleOverrides.default_image_ratio = meta.aspect_ratio;
            }
          } catch (_) {}
        }
        if (Object.keys(styleOverrides).length > 0) {
          cfg = { ...cfg, style: { ...(cfg?.style || {}), ...styleOverrides } };
        }
      }
    }
  } catch (_) {}

  const scene = framePromptService.loadScene(db, sb.scene_id);
  const characterNames = framePromptService.loadStoryboardCharacterNames(db, storyboardId);

  log.info('[四宫格] 开始生成4帧提示词', { storyboard_id: storyboardId });

  const [first, key1, key2, last] = await Promise.all([
    framePromptService.generateSingleFrameForQuadGrid(db, log, cfg, sb, scene, characterNames, model, 'first'),
    framePromptService.generateSingleFrameForQuadGrid(db, log, cfg, sb, scene, characterNames, model, 'key'),
    framePromptService.generateSingleFrameForQuadGrid(db, log, cfg, sb, scene, characterNames, model, 'key'),
    framePromptService.generateSingleFrameForQuadGrid(db, log, cfg, sb, scene, characterNames, model, 'last'),
  ]);

  log.info('[四宫格] 4帧提示词生成完成', { storyboard_id: storyboardId });

  const style = cfg?.style?.default_style || '';
  const styleHint = style ? `, art style: ${style}` : '';

  const quadPrompt =
    `Generate a 2x2 storyboard grid image (four panels showing action sequence progression${styleHint}). ` +
    `Each panel is clearly separated by a thin border. ` +
    `Panel 1 (top-left, initial state): ${first.prompt}. ` +
    `Panel 2 (top-right, action begins): ${key1.prompt}. ` +
    `Panel 3 (bottom-left, action climax): ${key2.prompt}. ` +
    `Panel 4 (bottom-right, final state): ${last.prompt}. ` +
    `Consistent character appearance and scene across all panels. Cinematic quality.`;

  return quadPrompt;
}
```

**Step 3: 在 `framePromptService.js` 中导出 `generateSingleFrame`**

`generateSingleFrame` 当前是 `framePromptService.js` 内的私有函数，需要将其导出（或新增一个包装导出）。

在 `framePromptService.js` 末尾 `module.exports` 中追加：

```javascript
module.exports = {
  generateFramePrompt,
  loadStoryboard,
  loadStoryboardCharacterNames,
  loadScene,
  getFramePrompts: (db, storyboardId) => storyboardService.getFramePrompts(db, storyboardId),
  // 供 imageService 的四宫格模式调用
  generateSingleFrameForQuadGrid: generateSingleFrame,
};
```

**Step 4: 在 `processImageGeneration` 中插入四宫格分支**

在 `processImageGeneration` 函数中，找到 Step 4（调用图生 API）之前的 Step 3（计算尺寸）后面，找到：

```javascript
    // ── Step 4: 调用图生 API ─────────────────────────────────────────
    log.info('[图生] Step4 调用图生 API →', { id: imageGenId, elapsed: elapsed() });
    const tApi = Date.now();
    const result = await imageClient.callImageApi(db, log, {
      prompt: row.prompt,
```

在 Step 4 开始前插入四宫格提示词覆盖逻辑（注意：使用 `let` 声明覆盖变量，需在 `try` 块内，位于 Step 3 结束后）：

```javascript
    // ── Step 3.5: 四宫格模式 — 用 AI 生成的4帧内容替换 prompt ────────
    let finalPrompt = row.prompt;
    if (row.frame_type === 'quad_grid' && row.storyboard_id) {
      log.info('[图生] Step3.5 四宫格模式，生成组合提示词', { id: imageGenId });
      try {
        finalPrompt = await buildQuadGridPrompt(db, log, row.storyboard_id, row.model);
        log.info('[图生] Step3.5 四宫格提示词生成完成', {
          id: imageGenId,
          prompt_preview: finalPrompt.slice(0, 120),
        });
      } catch (qErr) {
        log.warn('[图生] Step3.5 四宫格提示词生成失败，回退到原始 prompt', { error: qErr.message });
        // 回退到原始 prompt，不中断流程
      }
    }
```

然后在 Step 4 的 `callImageApi` 调用中将 `prompt: row.prompt` 改为 `prompt: finalPrompt`：

```javascript
    const result = await imageClient.callImageApi(db, log, {
      prompt: finalPrompt,
```

**Step 5: Commit**

```bash
git add backend-node/src/services/imageService.js
git add backend-node/src/services/framePromptService.js
git commit -m "feat: add quad-grid storyboard image generation via combined frame prompts"
```

---

## Task 3：前端四宫格全局开关 UI

**Files:**
- Modify: `frontweb/src/views/FilmCreate.vue`

**Step 1: 添加 `quadGridMode` 响应式变量**

在 `FilmCreate.vue` 的 `<script setup>` 区域，找到现有的 `storyboardCount` 和 `videoDuration` ref 声明处（约第 1432 行附近），追加：

```javascript
const quadGridMode = ref(false)
```

**Step 2: 在分镜生成配置区添加开关 UI**

找到 `sb-config-row` 区域（约第 511-523 行），在最后一个 `<label>` 配置项之后，在 `</div>` 关闭前添加：

```html
          <span class="sb-config-divider">｜</span>
          <label class="sb-config-item">
            <span class="sb-config-label">四宫格序列图</span>
            <el-switch v-model="quadGridMode" />
            <span class="sb-config-hint">开启后生成含4帧画面的序列参考图</span>
          </label>
```

**Step 3: 修改 `onGenerateSbImage` 传参**

找到 `onGenerateSbImage` 函数（约第 1744 行），将：

```javascript
    const res = await imagesAPI.create({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      prompt: sb.image_prompt || sb.description || '',
      model: undefined,
      style: getSelectedStyle()
    })
```

改为：

```javascript
    const res = await imagesAPI.create({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      prompt: sb.image_prompt || sb.description || '',
      model: undefined,
      style: getSelectedStyle(),
      frame_type: quadGridMode.value ? 'quad_grid' : undefined
    })
```

**Step 4: 修改批量生成分镜图逻辑（`startBatchImageGeneration`）**

找到 `startBatchImageGeneration` 函数（约第 1527 行），在其内部调用 `onGenerateSbImage` 或 `imagesAPI.create` 的地方确认是否已封装调用 `onGenerateSbImage`。

查找批量图片生成的实际循环逻辑，找到类似：
```javascript
await imagesAPI.create({ storyboard_id: sb.id, ... })
```
或间接调用 `onGenerateSbImage`。

如果批量生成直接复用了 `onGenerateSbImage`，则无需修改（全局 `quadGridMode` 会自动传递）。

如果批量生成有独立的 `imagesAPI.create` 调用，同样追加 `frame_type: quadGridMode.value ? 'quad_grid' : undefined`。

**Step 5: 验证 UI 显示**

启动前端，在分镜生成区看到"四宫格序列图"开关，切换后开关状态正常。

**Step 6: Commit**

```bash
git add frontweb/src/views/FilmCreate.vue
git commit -m "feat: add quad-grid mode global toggle in storyboard section UI"
```

---

## Task 4：端到端验证

**验证步骤：**

1. **验证功能一（角度视角）：**
   - 创建一个 angle='仰视' 的分镜，触发生成帧提示词
   - 查看后端日志，确认传给 AI 的 userPrompt 包含 "低角度仰拍" 等扩展描述
   - 生成的 image_prompt 应包含仰视视角相关描述

2. **验证功能二（四宫格）：**
   - 开启前端"四宫格序列图"开关
   - 点击某个分镜的"生成分镜"按钮
   - 查看后端日志，确认出现 `[四宫格]` 日志行
   - 最终生成的图片为 2×2 四格图

3. **回归验证（确保原有流程不受影响）：**
   - 关闭四宫格开关，正常生成分镜图，确保行为与修改前一致
   - angle='平视' 的分镜，生成的提示词包含平视描述

**Step: Final Commit（如有遗漏修改）**

```bash
git add -A
git commit -m "feat: storyboard angle perspective + quad-grid sequence image generation"
```
