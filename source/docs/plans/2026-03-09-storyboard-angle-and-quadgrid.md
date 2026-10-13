# 分镜角度视角 + 四宫格序列图 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复分镜图背景角度固定问题，并支持四宫格序列图生成模式。

**Architecture:**
- 功能一：在 `framePromptService.js` 的 `buildStoryboardContext()` 中，将 `angle` 字段翻译为带透视含义的完整描述注入上下文，让 AI 根据相机角度生成正确视角的背景。
- 功能二：前端增加全局"四宫格序列图"开关；开启后图片生成时传 `frame_type: 'quad_grid'`；后端 `imageService.js` 检测到该标记后先用 AI 生成 4 个帧提示词，拼成四宫格格式提示词，再调用图片生成 API 生成一张四宫格图。
- 利用现有 `frame_type` 字段存储标记，无需 DB migration。

**Tech Stack:** Node.js, better-sqlite3, Vue 3, Element Plus

---

## Task 1：角度描述扩展（功能一）

**Files:**
- Modify: `backend-node/src/services/framePromptService.js`

**Step 1: 在 `buildStoryboardContext()` 前新增角度映射辅助函数**

在文件顶部（`const loadConfig` 之后）新增：

```js
function expandAngleDescription(angle, isEnglish) {
  if (!angle) return null;
  const a = String(angle).trim().toLowerCase();
  if (isEnglish) {
    if (a.includes('low') || a === '仰视') return 'camera angle: low-angle upward shot, scene background shows sky/ceiling/treetops from below, strong upward perspective';
    if (a.includes('high') || a === '俯视') return 'camera angle: high-angle downward shot, bird\'s eye view perspective, background shows ground/floor/scene from above';
    if (a.includes('side') || a === '侧面') return 'camera angle: side-angle shot, profile composition, background extends laterally';
    if (a.includes('back') || a === '背面') return 'camera angle: rear shot, character\'s back to camera, background scene stretches ahead';
    return `camera angle: eye-level horizontal shot, normal perspective`;
  } else {
    if (a.includes('仰') || a.includes('low')) return '相机角度：低角度仰拍，背景呈现天空/天花板/树冠的仰视透视效果，视角向上倾斜';
    if (a.includes('俯') || a.includes('high')) return '相机角度：高角度俯拍，鸟瞰视角，背景呈现地面/场景从上方向下看的俯视透视效果';
    if (a.includes('侧') || a.includes('side')) return '相机角度：侧面视角，侧向构图，背景向两侧延展';
    if (a.includes('背') || a.includes('back')) return '相机角度：从角色背后拍摄，角色背对镜头，背景场景在角色前方延伸';
    return '相机角度：平视水平拍摄，正常透视构图';
  }
}
```

**Step 2: 修改 `buildStoryboardContext()` 中 angle 处理部分**

找到原来的：
```js
  if (sb.angle) {
    parts.push(promptI18n.formatUserPrompt(cfg, 'angle_label', sb.angle));
  }
```

替换为：
```js
  if (sb.angle) {
    const isEn = promptI18n.isEnglish(cfg);
    const angleDesc = expandAngleDescription(sb.angle, isEn);
    if (angleDesc) parts.push(angleDesc);
  }
```

**Step 3: 同样修改 `episodeStoryboardService.js` 的 `generateImagePrompt()`**

`episodeStoryboardService.js` 中的 `generateImagePrompt()` 是生成初始 image_prompt 的函数，也需要加入角度信息。找到：
```js
function generateImagePrompt(sb, style) {
  const parts = [];
  if (sb.location) {
    let locationDesc = sb.location;
    if (sb.time) locationDesc += ', ' + sb.time;
    parts.push(locationDesc);
  }
  ...
  const styleText = style && String(style).trim();
  if (styleText) parts.push(styleText + ', first frame');
  else parts.push('first frame');
  return parts.length ? parts.join(', ') : (styleText ? styleText + ', first frame' : 'first frame');
}
```

在 `parts.push(locationDesc)` 之后，加入角度信息：
```js
  if (sb.angle) {
    const a = String(sb.angle).trim().toLowerCase();
    if (a.includes('仰') || a.includes('low')) parts.push('low-angle upward shot');
    else if (a.includes('俯') || a.includes('high')) parts.push('high-angle downward shot, bird\'s eye view');
    else if (a.includes('侧') || a.includes('side')) parts.push('side-angle shot');
    else if (a.includes('背') || a.includes('back')) parts.push('rear shot from behind character');
    else parts.push('eye-level shot');
  }
```

**Step 4: 提交**
```bash
git add backend-node/src/services/framePromptService.js backend-node/src/services/episodeStoryboardService.js
git commit -m "feat: expand camera angle to perspective description in storyboard image prompts"
```

---

## Task 2：四宫格图片生成（功能二后端）

**Files:**
- Modify: `backend-node/src/services/imageService.js`

**Step 1: 在 `imageService.js` 中新增 `buildQuadGridPrompt()` 函数**

在文件顶部 `const path = require('path')` 之后，引入 framePromptService（注意避免循环依赖，在函数内部 require）。

在 `processImageGeneration` 函数之前添加：

```js
async function buildQuadGridPrompt(db, log, cfg, storyboardId, model) {
  const framePromptService = require('./framePromptService');
  const sb = framePromptService.loadStoryboard(db, storyboardId);
  if (!sb) return null;
  const scene = framePromptService.loadScene(db, sb.scene_id);
  const characterNames = framePromptService.loadStoryboardCharacterNames(db, storyboardId);

  const [first, key1, key2, last] = await Promise.all([
    framePromptService.generateSingleFrameExported(db, log, cfg, sb, scene, characterNames, model, 'first'),
    framePromptService.generateSingleFrameExported(db, log, cfg, sb, scene, characterNames, model, 'key'),
    framePromptService.generateSingleFrameExported(db, log, cfg, sb, scene, characterNames, model, 'key'),
    framePromptService.generateSingleFrameExported(db, log, cfg, sb, scene, characterNames, model, 'last'),
  ]);

  const style = cfg?.style?.default_style || '';
  const styleNote = style ? `, consistent style: ${style}` : '';
  return `Generate a 2x2 four-panel storyboard grid image (comic strip layout, clear panel borders). Each panel shows a different moment in sequence${styleNote}:
Panel 1 (top-left, first frame): ${first.prompt}
Panel 2 (top-right, key moment): ${key1.prompt}
Panel 3 (bottom-left, key moment): ${key2.prompt}
Panel 4 (bottom-right, last frame): ${last.prompt}
All panels have consistent character appearance and scene. Clear visible borders between panels. Sequential action progression.`;
}
```

**Step 2: 在 `framePromptService.js` 中导出 `generateSingleFrame`**

在 `framePromptService.js` 的 `module.exports` 中添加：
```js
  generateSingleFrameExported: generateSingleFrame,
```

**Step 3: 在 `processImageGeneration()` 中添加四宫格分支**

在 `processImageGeneration` 中，找到 `// ── Step 1: 获取 AI 配置 ──` 之前，添加四宫格处理：

```js
  // ── 四宫格模式：先生成4帧提示词，再拼装组合提示词 ──────────────────
  if (row.frame_type === 'quad_grid' && row.storyboard_id) {
    try {
      const quadPrompt = await buildQuadGridPrompt(db, log, cfg, row.storyboard_id, row.model);
      if (quadPrompt) {
        db.prepare('UPDATE image_generations SET prompt = ?, updated_at = ? WHERE id = ?')
          .run(quadPrompt, new Date().toISOString(), imageGenId);
        row.prompt = quadPrompt;
      }
    } catch (quadErr) {
      log.warn('[图生] 四宫格提示词生成失败，使用原始提示词', { error: quadErr.message });
    }
  }
```

这段代码放在 `// ── Step 1: 获取 AI 配置 ──` 注释之前。

**Step 4: 提交**
```bash
git add backend-node/src/services/imageService.js backend-node/src/services/framePromptService.js
git commit -m "feat: add quad-grid storyboard image generation support"
```

---

## Task 3：四宫格前端 UI（功能二前端）

**Files:**
- Modify: `frontweb/src/views/FilmCreate.vue`

**Step 1: 添加 `quadGridMode` 响应式变量**

在文件中找到 `const resourcePanelCollapsed = ref(false)` 附近（约第 1432 行），添加：
```js
const quadGridMode = ref(false)
```

**Step 2: 在分镜配置行添加四宫格开关 UI**

找到分镜配置区（约 511 行的 `<div class="sb-config-row">`），在最后一个 `</label>` 之后、`</div>` 之前添加：

```html
          <span class="sb-config-divider">｜</span>
          <label class="sb-config-item">
            <span class="sb-config-label">四宫格序列图</span>
            <el-switch v-model="quadGridMode" />
            <span class="sb-config-hint">生成含4帧的序列参考图</span>
          </label>
```

**Step 3: 修改 `onGenerateSbImage()` 传参**

找到 `onGenerateSbImage` 函数（约 1744 行），修改 `imagesAPI.create()` 调用：

```js
    const res = await imagesAPI.create({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      prompt: sb.image_prompt || sb.description || '',
      model: undefined,
      style: getSelectedStyle(),
      frame_type: quadGridMode.value ? 'quad_grid' : undefined,
    })
```

**Step 4: 修改批量生成分镜图也透传 quad_grid**

找到 `startBatchImageGeneration` 函数（约 1527 行），找到其中调用 `imagesAPI.create` 的地方，同样加上：
```js
      frame_type: quadGridMode.value ? 'quad_grid' : undefined,
```

**Step 5: 提交**
```bash
git add frontweb/src/views/FilmCreate.vue
git commit -m "feat: add quad-grid mode switch to storyboard UI"
```

---

## 验证步骤

1. 重启后端服务
2. 打开一个剧集的分镜页
3. **验证角度**：检查一个带有"俯视"角度的分镜，点击生成分镜图，观察 AI 生成的图片背景是否呈现俯视透视
4. **验证四宫格**：打开四宫格开关，点击某个分镜的"生成分镜"按钮，等待后确认生成的图片是 2×2 四格布局
5. **验证批量**：开启四宫格模式后点击"批量生成分镜图"，确认所有分镜均生成四宫格图
