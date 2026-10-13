# 自定义画面画风（Custom Drama Style）设计

日期：2026-08-06  
状态：已确认

## 背景

短剧「画面画风」目前只能从预设列表选择。后端 `mergeCfgStyleWithDrama` 已支持非预设文案，但前端 StylePicker / DramaDetail 无自定义入口；详情页与列表还使用过时硬编码选项；后端预设比前端少 7 项。

本需求只覆盖**画面画风**（影响角色/场景/道具/分镜图与视频提示词），不改故事风格（`story_style`）或剧本类型（`genre`）。

## 目标

1. 用户可在当前项目填写一段中文画风描述并生效。
2. 创作页与详情页入口一致，预设列表统一。
3. 前后端预设 value 对齐，避免仅存 `style` key 时后端无法展开。

## 非目标

- 跨项目风格库 / 本地收藏
- 中英文分填
- 新数据库列
- 故事风格自定义

## 数据约定

| 字段 | 选预设 | 选自定义 |
|------|--------|----------|
| `dramas.style` | 预设 value（如 `realistic`） | 固定短标识 `custom` |
| `metadata.style_prompt_zh` | 预设中文长文案 | 用户中文描述 |
| `metadata.style_prompt_en` | 预设英文长文案 | 与 zh **相同** |

- 常量：`CUSTOM_STYLE_VALUE = 'custom'`（前端 `styleOptions.js`）。
- 清空风格：`style` 与两个 prompt 字段均清空。
- 后端不把 `custom` 加入 `generationStylePresets`；生成链路优先读 `style_prompt_*`，已有逻辑足够。
- 加载项目：若 `style === 'custom'`，用 `metadata.style_prompt_zh` 回填编辑框。

## UI

### StylePickerButton（创作页主入口）

- 弹窗网格末尾增加「自定义」卡片（无缩略图，占位色块 +「自定义」）。
- 点击后展开/弹出 textarea，占位示例：「描述画面风格，例如：赛博朋克水墨，霓虹灯映在宣纸上…」。
- 确认：`modelValue = 'custom'`，同步 `customPrompt`；关闭弹窗；触发器显示「自定义」。
- 已是自定义时再次打开可编辑已有描述。
- 搜索区「已选」在 custom 时显示「自定义」，不再因找不到 option 而空白。

### DramaDetail

- 删除硬编码 `el-option` 列表。
- 改用 `StylePickerButton` + `generationStyleOptions`，与创作页同一套自定义流程。
- 保存仍走 `saveInfo` → outline API，metadata 用扩展后的 `stylePromptMetadataForSave`。

### FilmList

- `formatStyle`：`custom` →「自定义」；可选改为基于 `findStyleOption` / 共享 label map，避免国漫新 value 显示英文 key（至少覆盖 `custom` 与缺失的 7 个）。

## 代码改动

### 前端

1. **`frontweb/src/constants/styleOptions.js`**
   - 导出 `CUSTOM_STYLE_VALUE`。
   - `stylePromptMetadataForSave(styleValue, customPrompt?)`：
     - 空 value → 空 prompt。
     - `custom` → zh/en 均为 `trim(customPrompt)`（若为空则空串）。
     - 命中预设 → 用预设 prompt / promptEn。
     - 其他非预设字符串（兼容旧数据）→ zh/en 均为该字符串（保持现行为）。

2. **`frontweb/src/components/StylePickerButton.vue`**
   - Props：`customPrompt`（String）。
   - Emits：`update:modelValue`、`update:customPrompt`、`change`（change 载荷可为 value，父组件用 v-model 即可）。
   - 内嵌自定义输入 UI；选预设时清空或忽略 customPrompt（父组件保存时以 value 为准）。

3. **`frontweb/src/views/FilmCreate.vue`**
   - 维护 `customStylePrompt`；加载 drama 时回填。
   - `projectStylePromptMetadata()` / 保存 outline：传入 custom prompt。
   - StylePicker 双向绑定 style + customPrompt。

4. **`frontweb/src/views/DramaDetail.vue`**
   - 换 StylePicker；保存时传入 custom prompt。

5. **`frontweb/src/composables/useStoryGeneration.js`**
   - `stylePromptMetadataForSave(generationStyle, customPrompt)`，避免把字面量 `custom` 写入 prompt。

6. **`frontweb/src/views/FilmList.vue`**
   - `formatStyle` 支持 `custom` 及与 `styleOptions` 对齐的 label。

### 后端

向 `backend-node/src/constants/generationStylePresets.js` 追加与前端一致的 7 项：

- `2d gufeng`
- `xianxia 3d`
- `gufeng 3d`
- `neo chinese guochao`
- `neo gufeng`
- `urban romance comic`
- `korean romance webtoon`

文案直接复制 `styleOptions.js` 中对应 `prompt` / `promptEn`。

## 数据流

```
用户选「自定义」并填写描述
  → style=custom, style_prompt_zh=en=描述
  → PUT outline / create drama metadata
  → 后续生成：mergeCfgStyleWithDrama 读 style_prompt_*
  → 提示词【画风·最高优先级】注入用户描述
```

## 错误与边界

- 选自定义但描述为空：确认时提示「请填写画风描述」，不写入。
- 从自定义改回预设：按预设展开覆盖 `style_prompt_*`（与现有 saveOutline 行为一致）。
- 旧项目：仅有非预设长文案在 `style` 字段、无 metadata 时，后端仍按现逻辑把 legacy 当整段文案；本期不强制迁移为 `custom`。

## 测试

- 前端：`stylePromptMetadataForSave` 对 preset / custom / 空 / 未知字符串的断言（`frontweb/test/` 补用例）。
- 后端：`resolveStylePreset` 覆盖新增 7 value；现有 `dramaStyleMerge` 自定义用例保持通过。
- 手工：创作页选自定义 → 保存刷新仍显示「自定义」且描述在 → 生成角色/分镜提示词含该描述；详情页改风格同步。

## 验收标准

- [ ] 创作页可选自定义并保存到当前项目
- [ ] 刷新后仍为自定义且描述可再编辑
- [ ] 详情页与创作页选项一致且可自定义
- [ ] 列表对 `custom` 显示「自定义」
- [ ] 后端能 resolve 上述 7 个国漫/现言预设
- [ ] 生成链路使用用户描述而非字面量 `custom`
