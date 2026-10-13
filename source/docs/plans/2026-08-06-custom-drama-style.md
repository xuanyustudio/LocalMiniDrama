# Custom Drama Style Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让用户在短剧项目里用一段中文描述自定义画面画风，并统一创作页/详情页入口与前后端预设列表。

**Architecture:** 自定义用 `dramas.style = 'custom'` + `metadata.style_prompt_zh/en`（中英同文）写入现有字段；StylePicker 增加自定义卡片与输入；详情页改用同一组件；后端补齐 7 个缺失预设。生成链路继续走 `mergeCfgStyleWithDrama`，无需改 schema。

**Tech Stack:** Vue 3 + Element Plus（frontweb）、Express + 纯 JS（backend-node）、Node.js 内置 `node:test`

**Spec:** `docs/superpowers/specs/2026-08-06-custom-drama-style-design.md`

---

### Task 1: 扩展 `stylePromptMetadataForSave` + 单测

**Files:**
- Modify: `frontweb/src/constants/styleOptions.js`
- Create: `frontweb/test/styleOptions.test.js`

**Step 1: Write the failing test**

Create `frontweb/test/styleOptions.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_STYLE_VALUE,
  stylePromptMetadataForSave,
  findStyleOption,
  getStyleLabel,
} from '../src/constants/styleOptions.js'

test('preset returns zh/en prompts', () => {
  const m = stylePromptMetadataForSave('realistic')
  assert.ok(m.style_prompt_zh.includes('写实'))
  assert.ok(m.style_prompt_en.includes('photorealistic'))
})

test('empty style clears prompts', () => {
  assert.deepEqual(stylePromptMetadataForSave(''), {
    style_prompt_zh: '',
    style_prompt_en: '',
  })
})

test('custom with prompt writes same zh/en', () => {
  const desc = '赛博朋克水墨，霓虹映在宣纸上'
  assert.deepEqual(stylePromptMetadataForSave(CUSTOM_STYLE_VALUE, desc), {
    style_prompt_zh: desc,
    style_prompt_en: desc,
  })
})

test('custom without prompt does not write literal custom', () => {
  assert.deepEqual(stylePromptMetadataForSave(CUSTOM_STYLE_VALUE), {
    style_prompt_zh: '',
    style_prompt_en: '',
  })
  assert.deepEqual(stylePromptMetadataForSave(CUSTOM_STYLE_VALUE, '  '), {
    style_prompt_zh: '',
    style_prompt_en: '',
  })
})

test('unknown legacy string still mirrors zh/en', () => {
  assert.deepEqual(stylePromptMetadataForSave('古风仙侠'), {
    style_prompt_zh: '古风仙侠',
    style_prompt_en: '古风仙侠',
  })
})

test('getStyleLabel covers custom and presets', () => {
  assert.equal(getStyleLabel('realistic'), '写实')
  assert.equal(getStyleLabel(CUSTOM_STYLE_VALUE), '自定义')
  assert.equal(getStyleLabel('2d gufeng'), '2D 古风')
  assert.equal(getStyleLabel('unknown-x'), 'unknown-x')
})

test('findStyleOption does not treat custom as preset', () => {
  assert.equal(findStyleOption(CUSTOM_STYLE_VALUE), null)
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd frontweb
node --test test/styleOptions.test.js
```

Expected: FAIL（`CUSTOM_STYLE_VALUE` / `getStyleLabel` 未导出，或 custom 分支行为不符）

**Step 3: Minimal implementation in `styleOptions.js`**

在文件顶部（`generationStyleOptions` 之前）增加：

```js
/** 自定义画风：dramas.style 固定短标识，完整描述写在 metadata.style_prompt_* */
export const CUSTOM_STYLE_VALUE = 'custom'
```

替换 `stylePromptMetadataForSave`：

```js
export function stylePromptMetadataForSave(styleValue, customPrompt) {
  const v = (styleValue || '').toString().trim()
  if (!v) return { style_prompt_zh: '', style_prompt_en: '' }
  if (v === CUSTOM_STYLE_VALUE) {
    const text = (customPrompt != null ? String(customPrompt) : '').trim()
    return { style_prompt_zh: text, style_prompt_en: text }
  }
  const opt = findStyleOption(v)
  if (!opt) return { style_prompt_zh: v, style_prompt_en: v }
  return {
    style_prompt_zh: opt.prompt || opt.promptEn || '',
    style_prompt_en: opt.promptEn || opt.prompt || '',
  }
}
```

新增：

```js
/** 列表/触发器展示用中文名 */
export function getStyleLabel(val) {
  const v = (val || '').toString().trim()
  if (!v) return ''
  if (v === CUSTOM_STYLE_VALUE) return '自定义'
  const opt = findStyleOption(v)
  return opt?.label || v
}
```

同步修正 `backfillDramaStylePromptMetadataIfNeeded`：在取 `styleVal` 后若 `styleVal === CUSTOM_STYLE_VALUE` 则直接 `return drama`（避免用空 custom 覆盖；有 en 时上面已 return）。

**Step 4: Run tests — expect PASS**

```bash
cd frontweb
node --test test/styleOptions.test.js
```

**Step 5: Commit**

```bash
git add frontweb/src/constants/styleOptions.js frontweb/test/styleOptions.test.js
git commit -m "feat: support custom style prompt metadata helpers"
```

---

### Task 2: StylePicker 自定义 UI

**Files:**
- Modify: `frontweb/src/components/StylePickerButton.vue`

**Step 1: 扩展 props / emits**

```js
import { CUSTOM_STYLE_VALUE, getStyleLabel } from '@/constants/styleOptions'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: { type: String, default: '' },
  customPrompt: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '图片/视频风格' },
})

const emit = defineEmits(['update:modelValue', 'update:customPrompt', 'change'])
```

**Step 2: 触发器显示**

- `selectedOption` 仍查预设。
- 新增 computed `displayLabel`：若 `modelValue === CUSTOM_STYLE_VALUE` → `'自定义'`；否则 `selectedOption?.label`。
- `has-value`：`!!modelValue`。
- 自定义时 swatch 用固定渐变，如 `linear-gradient(135deg,#5b8def,#2dd4bf)`。
- 「已选」hint 用 `getStyleLabel(modelValue)` 或 `displayLabel`。

**Step 3: 弹窗内「自定义」卡片 + 输入区**

在 `spd-body` 末尾（各组之后）增加一组：

```html
<div class="spd-group-title">其他</div>
<div class="spd-grid">
  <div
    class="spd-item"
    :class="{ 'is-active': modelValue === CUSTOM_STYLE_VALUE }"
    @click="openCustomEditor"
  >
    <div class="spd-thumb" :style="{ background: 'linear-gradient(135deg,#5b8def,#2dd4bf)' }">
      <span class="spd-thumb-text">自定</span>
    </div>
    <div class="spd-name">自定义</div>
    <div v-if="modelValue === CUSTOM_STYLE_VALUE" class="spd-check">✓</div>
  </div>
</div>

<div v-if="showCustomEditor" class="spd-custom-editor">
  <el-input
    v-model="customDraft"
    type="textarea"
    :rows="4"
    maxlength="500"
    show-word-limit
    placeholder="描述画面风格，例如：赛博朋克水墨，霓虹灯映在宣纸上…"
  />
  <div class="spd-custom-actions">
    <el-button @click="showCustomEditor = false">取消</el-button>
    <el-button type="primary" @click="confirmCustom">确认</el-button>
  </div>
</div>
```

逻辑：

```js
const CUSTOM_STYLE_VALUE = 'custom' // 或从 constants 导入
const showCustomEditor = ref(false)
const customDraft = ref('')

function openCustomEditor() {
  customDraft.value = props.customPrompt || ''
  showCustomEditor.value = true
}

function confirmCustom() {
  const text = customDraft.value.trim()
  if (!text) {
    ElMessage.warning('请填写画风描述')
    return
  }
  emit('update:customPrompt', text)
  emit('update:modelValue', CUSTOM_STYLE_VALUE)
  emit('change', CUSTOM_STYLE_VALUE)
  showCustomEditor.value = false
  visible.value = false
}

function select(opt) {
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
  // 选预设不强制清空 customPrompt 内存值；保存以 modelValue 为准
  visible.value = false
}

function clearAndClose() {
  emit('update:modelValue', '')
  emit('update:customPrompt', '')
  emit('change', '')
  showCustomEditor.value = false
  visible.value = false
}
```

搜索过滤时「其他/自定义」始终显示（不依赖 search），或当 kw 匹配「自定义」「custom」时显示。

**Step 4: 样式**

为 `.spd-custom-editor` 增加 margin-top、textarea 与按钮间距，与现有 dialog 风格一致即可。

**Step 5: Commit**

```bash
git add frontweb/src/components/StylePickerButton.vue
git commit -m "feat: add custom style entry to StylePicker"
```

---

### Task 3: 接线 FilmCreate

**Files:**
- Modify: `frontweb/src/views/FilmCreate.vue`

**Step 1: 状态与导入**

```js
import {
  generationStyleOptions,
  stylePromptMetadataForSave,
  backfillDramaStylePromptMetadataIfNeeded,
  CUSTOM_STYLE_VALUE,
} from '@/constants/styleOptions'

const customStylePrompt = ref('')
```

**Step 2: 模板**

```html
<StylePickerButton
  v-model="generationStyle"
  v-model:custom-prompt="customStylePrompt"
  :options="generationStyleOptions"
  @change="() => saveProjectSettings(true)"
/>
```

**Step 3: metadata / 加载 / 清空**

```js
function projectStylePromptMetadata() {
  return stylePromptMetadataForSave(generationStyle.value, customStylePrompt.value)
}
```

在 `loadDrama` 里 `generationStyle.value = d.style || ''` 之后：

```js
if ((d.style || '') === CUSTOM_STYLE_VALUE) {
  customStylePrompt.value = (d.metadata?.style_prompt_zh || d.metadata?.style_prompt_en || '').toString()
} else {
  customStylePrompt.value = ''
}
```

在重置项目状态处（约 `generationStyle.value = ''`）同时 `customStylePrompt.value = ''`。

**Step 4: `runGenerateStoryFromPremise` 传入 custom**

在调用处增加 `customStylePrompt: customStylePrompt.value`（Task 4 会改 composable 签名）。

**Step 5: Commit**

```bash
git add frontweb/src/views/FilmCreate.vue
git commit -m "feat: wire custom style on FilmCreate"
```

---

### Task 4: useStoryGeneration 传入 customPrompt

**Files:**
- Modify: `frontweb/src/composables/useStoryGeneration.js`

**Step 1: 参数与调用**

在解构参数中增加 `customStylePrompt`（默认 `''`）。

两处 `stylePromptMetadataForSave(generationStyle)` 改为：

```js
stylePromptMetadataForSave(generationStyle, customStylePrompt)
```

**Step 2: Commit**

```bash
git add frontweb/src/composables/useStoryGeneration.js
git commit -m "fix: pass custom style prompt into story generation metadata"
```

---

### Task 5: DramaDetail 换 StylePicker

**Files:**
- Modify: `frontweb/src/views/DramaDetail.vue`

**Step 1: 替换表单项**

删除约 42–84 行硬编码 `el-select` / `el-option-group`，改为：

```html
<el-form-item label="图片/视频风格">
  <StylePickerButton
    v-model="infoForm.style"
    v-model:custom-prompt="infoForm.customStylePrompt"
    :options="generationStyleOptions"
    placeholder="选择全剧统一风格"
    @change="saveInfo"
  />
</el-form-item>
```

**Step 2: script**

```js
import StylePickerButton from '@/components/StylePickerButton.vue'
import {
  generationStyleOptions,
  stylePromptMetadataForSave,
  backfillDramaStylePromptMetadataIfNeeded,
  CUSTOM_STYLE_VALUE,
} from '@/constants/styleOptions'
```

`infoForm` 增加 `customStylePrompt: ''`。

加载 drama 时：

```js
infoForm.style = d.style || ''
if (infoForm.style === CUSTOM_STYLE_VALUE) {
  infoForm.customStylePrompt = (d.metadata?.style_prompt_zh || d.metadata?.style_prompt_en || '').toString()
} else {
  infoForm.customStylePrompt = ''
}
```

`saveInfo` 中：

```js
...stylePromptMetadataForSave(infoForm.style, infoForm.customStylePrompt),
```

若选 custom 且描述为空，可在 `saveInfo` 开头 `ElMessage.warning` 并 return（与 Picker 确认逻辑双保险）。

**Step 3: Commit**

```bash
git add frontweb/src/views/DramaDetail.vue
git commit -m "feat: use StylePicker with custom style on DramaDetail"
```

---

### Task 6: FilmList `formatStyle` 统一

**Files:**
- Modify: `frontweb/src/views/FilmList.vue`

**Step 1: 替换 formatStyle**

```js
import { getStyleLabel } from '@/constants/styleOptions'

function formatStyle(style) {
  return getStyleLabel(style)
}
```

删除本地大 map（含过时项）。保留对历史别名 `anime` / `sci_fi` 的兼容：可在 `getStyleLabel` 内加一小段 alias map，或在 `formatStyle` 里：

```js
const aliases = { anime: 'anime style', sci_fi: 'sci-fi' }
const key = aliases[style] || style
return getStyleLabel(key)
```

**Step 2: Commit**

```bash
git add frontweb/src/views/FilmList.vue frontweb/src/constants/styleOptions.js
git commit -m "fix: show custom and synced style labels in FilmList"
```

---

### Task 7: 后端同步 7 个预设

**Files:**
- Modify: `backend-node/src/constants/generationStylePresets.js`
- Create: `backend-node/test/generationStylePresets.test.js`

**Step 1: 失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveStylePreset } from '../src/constants/generationStylePresets.js'

const EXTRA = [
  '2d gufeng',
  'xianxia 3d',
  'gufeng 3d',
  'neo chinese guochao',
  'neo gufeng',
  'urban romance comic',
  'korean romance webtoon',
]

for (const value of EXTRA) {
  test(`resolves ${value}`, () => {
    const p = resolveStylePreset(value)
    assert.ok(p, `missing preset ${value}`)
    assert.ok(p.zh.length > 10)
    assert.ok(p.en.length > 10)
  })
}

test('custom is not a preset', () => {
  assert.equal(resolveStylePreset('custom'), null)
})
```

**Step 2: Run — expect FAIL**

```bash
cd backend-node
node --test test/generationStylePresets.test.js
```

**Step 3: 在 `PRESETS` 数组中、`wuxia` 之后插入**（文案与 `styleOptions.js` 完全一致）：

```js
['2d gufeng', '国产二维古风插画，清瘦线稿与赛璐璐平涂，低饱和雅致配色，汉服与发饰精细刻画，亭台楼阁或山水留白，网文封面与番剧人设常见气质，干净无噪点数码绘', 'Chinese 2D guofeng illustration, delicate linework and cel shading, soft muted elegant palette, detailed hanfu and hair ornaments, pavilion or misty landscape, web novel cover and donghua character art style, clean digital painting'],
['xianxia 3d', '仙侠玄幻三维渲染，空灵仙境氛围，灵力流光与法术粒子，广袖仙袍与玉冠发饰，云海奇峰与宫阙楼阁，国产仙侠剧与游戏CG审美，柔和体积光与景深', 'Chinese xianxia fantasy 3D render, ethereal immortal realm, spiritual glow and spell particles, flowing immortal robes and jade hair crown, sea of clouds and celestial palace, Chinese fantasy drama and game CG aesthetic, soft volumetric light and depth of field'],
['gufeng 3d', '古风写实三维角色与场景，次表面散射肤质与丝绸布料，高盘发与步摇细节，宫殿园林或市井街景，古装剧级服化道，暖调电影级调色，精致但不过分卡通', 'Chinese historical 3D realistic character and scene, subsurface skin and silk fabric detail, elaborate hairpins and hanfu, palace garden or ancient street, costume drama level production design, warm cinematic color grading, refined semi-realistic 3D'],
['neo chinese guochao', '新中式国潮视觉，传统纹样与书法笔触融入现代平面设计，高饱和撞色与霓虹点缀，祥云龙纹水墨几何化，海报插画感，年轻潮流与东方符号并存', 'neo-Chinese guochao graphic style, traditional patterns and brush strokes in modern flat design, bold saturated colors with neon accents, stylized clouds dragons ink geometry, poster illustration vibe, youthful street fashion meets oriental motifs'],
['neo gufeng', '新古风插画，在古典意境上偏清新明亮，柔焦轮廓与细腻渐变，言情与仙侠题材常见，人物唯美表情细腻，背景水墨氤氲但不压抑，适合竖版封面', 'neo guofeng illustration, classical mood with fresh bright tones, soft edges and smooth gradients, romance and xianxia novel aesthetic, delicate faces and expressive eyes, misty ink wash background, vertical cover art composition'],
['urban romance comic', '都市现代言情漫画风，明亮清透上色，写字楼咖啡厅街景，人物美型大眼简化鼻唇，条漫分镜感，点缀星光或柔焦浪漫光斑，国产现言漫常见甜宠气质', 'urban contemporary romance manhua style, bright clean coloring, office cafe city street backgrounds, pretty stylized faces big eyes, webcomic panel feel, sparkle and soft bokeh romantic lighting, sweet modern Chinese romance comic aesthetic'],
['korean romance webtoon', '韩式条漫纯爱画风，极简干净线稿，柔和粉彩与渐变，角色清秀少年感，竖构图留白，心跳初恋氛围，柔边阴影与高光，类似韩国恋爱类网漫', 'Korean romance webtoon style, clean minimal linework, soft pastel gradients, delicate youthful characters, vertical scroll composition, innocent first love mood, soft cel shading and highlights, Korean BL or romance manhwa aesthetic'],
```

确认 `module.exports` 仍导出 `resolveStylePreset`（及现有导出名）。

**Step 4: Run — expect PASS**

```bash
cd backend-node
node --test test/generationStylePresets.test.js
```

**Step 5: Commit**

```bash
git add backend-node/src/constants/generationStylePresets.js backend-node/test/generationStylePresets.test.js
git commit -m "fix: sync guoman style presets with frontend"
```

---

### Task 8: 回归测试与手工验收

**Step 1: 跑相关测试**

```bash
cd frontweb
node --test test/styleOptions.test.js

cd ../backend-node
node --test test/generationStylePresets.test.js
```

Expected: 全部 PASS

**Step 2: 手工清单（对照 spec 验收标准）**

1. 创作页打开风格弹窗 → 点「自定义」→ 填描述 → 确认 → 触发器显示「自定义」
2. 刷新页面仍为自定义，再打开可编辑描述
3. 详情页同样可选自定义并保存
4. 项目列表 badge 显示「自定义」
5. （有 AI key 时）生成角色/分镜，提示词含用户描述而非字面量 `custom`
6. 选国漫「2D 古风」等新预设，仅写 style、无 metadata 的旧路径后端能 resolve

**Step 3: 若有修复，单独 commit**

---

## 执行说明

- 按 Task 顺序做；每 Task 结束再 commit。
- 不要改故事风格 / genre / FreeCreate 独立风格框。
- 不要把 `custom` 写入后端 PRESETS。
- Windows PowerShell 下逐条 `cd` + `node --test`，勿用 `&&`。
