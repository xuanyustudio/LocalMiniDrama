# Changelog

所有版本的重要改动记录在此文件中，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

**官方仓库：**
[![GitHub](https://img.shields.io/badge/GitHub-xuanyustudio%2FLocalMiniDrama-181717?logo=github)](https://github.com/xuanyustudio/LocalMiniDrama)
[![Gitee](https://img.shields.io/badge/Gitee-bi__shang__a%2Flocalminidrama-C71D23?logo=gitee)](https://gitee.com/bi_shang_a/localminidrama)

---

## [1.2.3] - 2026-03-24

### 新增

- **分镜解说旁白（narration）**：分镜生成请求支持 `include_narration`；数据库 `storyboards` 表新增 `narration` 字段；提示词要求与角色对白 `dialogue` 分离的纪录片式/第三人称解说文案
- **导出解说 SRT**：前端按分镜顺序与 `duration` 累计时间轴，导出非空解说为 SubRip 文件；项目 `metadata.storyboard_include_narration` 持久化勾选状态
- **解说 TTS**：分镜视频区在存在解说文案时提供「解说配音」按钮，沿用现有音频合成接口

### 修复

- **首镜（及前几镜）解说永久为空**：流式增量写入会先插入不完整对象；原逻辑在最终 `saveStoryboards` 时跳过已插入行且不再更新，导致 `narration` 等后出字段无法落库；改为对增量已写入的 `storyboard_number` 用最终解析结果执行 `UPDATE` 合并（`deriveStoryboardFieldsFromAi` + `updateStoryboardRowFromDerived`）
- **解说漏写**：用户提示与系统提示增加最高优先级说明（首镜开场解说、全镜非空等），减少模型将建立镜头留空

### 优化

- **解说相关 UI**：`FilmCreate.vue` 中解说多行输入框、复选框说明与「导出解说 SRT」按钮在浅色/深色主题下的字色与背景对比度；导出按钮白字紫底

### 文档

- 根目录 `README.md`、`docs/en.md` 版本徽章与「最新亮点」同步至 v1.2.3
- `frontweb` / `backend-node` / `desktop` 的 `package.json` 版本号统一为 1.2.3

---

## [1.2.2] - 2026-03-17

### 新增

- **视频帧连贯性（连贯帧模式）**：批量生成分镜视频新增「连贯帧模式」开关；启用后强制顺序生成，每条视频完成后自动用浏览器 Canvas 提取末帧，上传后作为下一条视频的 `first_frame_url` 参考图，有效减少视频片段间的跳跃感；tooltip 详细说明支持的模型（kling-video、wan2.2-kf2v-flash 等）及不支持模型的静默降级行为
- **小说/长文章节导入**：故事生成区域新增「导入小说」按钮；支持粘贴文本或上传 `.txt/.md` 文件；后端基于正则识别章节标题自动分割，可选 AI 改写为剧本格式；返回章节列表自动填入剧本编辑区，每章对应一集（`novelImportService.js`）
- **场景 AI 生成 tooltip**：场景 AI 生成按钮悬停提示改为「多角度图一张（正/侧/俯/仰）」，原重复的「多视角」独立按钮已移除
- **ffmpeg 自动解压**：安装包首次启动时自动将内置的 `ffmpeg.exe`/`ffprobe.exe` 从 `resources/ffmpeg/` 复制到 userData 工作目录，无需用户手动配置；已存在则跳过，支持用户手动替换版本；`electron-builder-lite.json` 通过 `extraResources` 将 `backend-node/tools/ffmpeg` 打包进安装包

### 修复

- **doubao/火山引擎模型分镜 JSON 解析失败**：修复 doubao-1-5-pro 等模型将 JSON 数组包装成 `{"storyboards":[...]}` 对象格式、叠加 max_tokens 截断导致全部修复策略失效的问题；新增 `extractWrappedArrayStr()` 函数，检测到包装对象后提取内部数组候选串，再走截断修复 → jsonrepair 兜底流水线；同样适用于流式增量保存路径（`tryIncrementalSave`）
- **分镜截断后续写内容重复**：续写 prompt 原只携带末尾 5 条分镜，AI 不知道前面已覆盖哪些情节，导致母亲关怀、雪儿致歉等段落反复出现；改为将全量已生成分镜标题列表（`镜号. [段落] 标题`）一并传入，明确禁止 AI 重复，续写连贯性大幅提升
- **分镜生成默认 max_tokens 过小**：默认不传 max_tokens 导致 doubao 等模型使用 4096 token 默认上限，12000 字符即截断；改为默认传 `max_tokens: 16384`；若模型返回参数错误（HTTP 4xx 含 max_tokens/length/token 关键字），自动降级为不传 max_tokens 重试，所有尝试均记录日志
- **JSON 字符串内原始换行符**：中文 AI 模型在对话/描述字段直接输出换行字节（非 `\n` 转义），导致 `JSON.parse` 报 "Unterminated string"；在 `safeParseAIJSON` 预处理阶段新增 `escapeNewlinesInStrings()` 字符级状态机扫描，将字符串值内的 `\n`/`\r`/`\t` 原始字节转义，修复后所有截断修复策略均可正常执行

### 优化

- **火山引擎默认文本模型**：一键配置和手动选择时，文本/对话默认模型由 doubao-1-5-pro-32k 改为 deepseek-v3-2-251201，生成质量更稳定
- **首页隐藏「自由创作」和「素材库」按钮**：功能待完善，暂时注释隐藏，路由与页面代码保留

---

## [1.2.1] - 2026-03-17

### 新增

- **可灵 Kling AI 接入**：新增可灵图片生成协议（kling-image / kling-omni-image）及视频生成协议（kling-video / kling-omni-video / kling-motion-control），AI 配置页可直接选择可灵作为服务商，Base URL / 端点自动填充
- **场景/道具"加入本集"**：场景库和道具库弹窗新增「加入本集」按钮，与角色库体验对齐；后端 `createScene` / `create`（prop）补充保存 `image_url`、`local_path` 字段，确保素材图片 URL 正确保存
- **视频历史记录与主视频选择**：分镜视频重新生成后保留历史版本，下方缩略图条带一览可选；点击历史缩略图即切换主视频，并将选择持久化到分镜记录的 `video_url`；合成视频时后端优先使用用户选定版本，兜底取最新生成记录
- **参考图独立字段（ref_image）**：角色、场景、道具各自新增 `ref_image` 数据库字段，专门存储用户手动上传的参考图，与 AI 生成的主图（`image_url`/`local_path`）完全分离，互不干扰；`migrate.js` 自动迁移
- **编辑弹窗参考图区域（角色/道具/场景）**：添加与编辑模式均显示参考图上传区；编辑时优先展示已保存的 `ref_image`，其次半透明展示主图；上传新参考图后点击保存自动上传并持久化到 `ref_image` 字段；支持"移除参考图"操作
- **从参考图提取描述**：参考图存在时一键调用视觉 AI 提取角色外貌/场景/道具描述，直接填入对应文本框；`resolveEntityImageSource` 优先使用 `ref_image`（高于主图和 `extra_images`）

### 修复

- **合成视频主视频不对**：`getVideoUrlForStoryboard` 调整为优先读 `storyboard.video_url`（用户选定主视频），再兜底 `video_generations ORDER BY created_at DESC`，修复合成时始终取最新生成记录、忽略用户已选定历史视频的问题
- **重新生成视频后主视频混乱**：`onGenerateSbVideo` / `startBatchVideoGeneration` 在提交新生成任务前自动清除 `storyboard.video_url` 及前端 `sbSelectedVideoId`，确保新视频生成完成后合成使用最新记录
- **视觉 AI 返回空内容（o4-mini）**：`max_tokens: 400` 过小导致推理模型（o4-mini）推理过程耗尽 token 而输出为空；改为 `max_tokens: 2000`；同时检测模型名是否以 `o数字` 开头，推理模型改用 `max_completion_tokens`（不能同时传两个参数），并跳过 `temperature` 参数（推理模型不支持）
- **视觉 API system 消息兼容性**：推理模型（o1/o3/o4 系列）不识别 `system` role，改为将 system prompt 合并到 user 消息前缀传入
- **提取描述后保存的参考图覆盖主图**：修复原先将参考图存为 `image_url/local_path`（覆盖 AI 生成主图）的问题，改为存入独立的 `ref_image` 字段；`putImage` 路由调整为只有明确传入 `image_url` 时才更新主图
- **场景导入重复**：工程导入时按 `location|time` 去重，避免多次导入同名场景累积重复条目

### 优化

- **视觉提示词重构**：角色外貌提取提示词改为"角色造型设计"语境（cosplay/概念图），明确要求描述发型/五官/体型/服装四维度，忽略背景，并加入推断指引和拒绝检测（`isRefusalResponse`）；场景/道具提示词同步优化
- **提示词单一来源**：`EXTRACT_PROMPTS` 常量统一在 `aiClient.js` 定义并导出，`characterLibraryService`、`sceneService`、`propService` 直接引用，消除多处重复维护

### 文档

- README 新增「AI 生成实拍效果」章节，展示即梦 1.0 生成的 3 段连续分镜视频，验证跨镜头角色一致性
- README 新增 3 张界面截图（角色管理、专业分镜参数、场景库加入本集）
- AI 服务商表格加入可灵 Kling AI（图片 + 视频）

---

## [1.2.0] - 2026-03-14

### 新增

- **角色图生提示词（polished_prompt）**：提取角色后异步自动生成 AI 润色的最终图像提示词并保存到数据库；编辑弹窗展示该提示词，支持手动编辑与一键重新生成；生成图片时直接使用该提示词，无需临时拼接
- **道具图生提示词（prompt）**：同上，道具提取后异步生成专业英文图像提示词，展示在编辑弹窗，可编辑和重新生成
- **场景四视图提示词（polished_prompt）**：场景提取后异步生成完整四视图图像提示词，展示在编辑弹窗，与角色/道具体验一致
- **结构化镜头角度三元组**：新增 `angleService.js`，定义 8 水平方向 × 4 仰俯角度 × 3 景别共 96 种组合，分镜表新增 `angle_h`、`angle_v`、`angle_s` 字段；分镜编辑区原单行文本输入替换为三个下拉选择器（景别 / 俯仰 / 方向），旁边实时显示中文标签（如「特写·俯拍·正面」）
- **分镜道具自动关联**：分镜 AI 生成时自动提取该镜头使用的道具 ID，写入 `storyboard_props` 表；分镜卡片显示关联道具，编辑弹窗可手动调整
- **分镜段落分组（segment）**：分镜生成时 AI 自动分配幕次/段落（`segment_index` + `segment_title`），前端以段落标题分组展示（如「第一幕：相遇」）
- **角色身份类型下拉**：编辑角色弹窗将「身份/定位」由文本框改为下拉选择器（主角 / 配角 / 次要角色），与 AI 提取的固定值 `main/supporting/minor` 对齐；角色卡片名称旁显示对应颜色 Tag
- **风格双语提示词**：24 种创作风格每项新增 `promptEn`（英文）字段，`prompt` 保留中文说明；图像/视频 AI 调用时自动使用英文版（效果更好），中文版用于界面展示；`getSelectedStylePrompt()` 返回英文，`getSelectedStylePromptZh()` 返回中文
- **分镜图片/视频提示词全中文**：重构 `generateImagePrompt` / `generateVideoPrompt`，输出全中文提示词，角度部分使用中文标签（`特写·俯拍·正面`），视频提示词同时附上英文括号说明兼容双语模型
- **配置文件统一**：合并 `config.yaml` 与 `config.example.yaml` 为单一 `config.yaml`，简化配置管理；Electron 打包与开发环境均只依赖 `config.yaml`

### 优化

- **编辑弹窗体验**：角色、道具、场景编辑弹窗宽度从固定 720px 改为屏幕 75%；所有多行文本框改为 `autosize` 自适应高度（最少 3~5 行，内容多时自动撑高最多 16 行），提示词框不再需要手动滚动
- **默认风格质量描述**：`config.yaml` 中 `default_role_style`、`default_scene_style`、`default_prop_style` 改为风格无关的通用画质描述词，不再预置特定艺术风格，避免覆盖用户在 UI 选择的风格

### 修复

- **场景 polished_prompt 前端轮询不结束**：修正 Axios 拦截器自动解包 `data` 层导致的路径多嵌套问题（`res?.data?.scene` → `res?.scene`），轮询现可正确检测到生成完成
- **分镜段落生成后刷新丢失**：`dramaService.rowToStoryboard` 和 `storyboardService` 补充返回 `segment_index`、`segment_title`、`angle_h`、`angle_v`、`angle_s` 字段，刷新页面后分组和角度信息不再丢失
- **分镜道具批量保存缺失**：`saveStoryboards`（整批保存路径）补充道具关联写入逻辑，与 `insertOneStoryboard`（流式逐条路径）保持一致
- **风格切换不生效**：修复 `backgroundExtractionService.js` 未将请求 `style` 参数透传给异步 `generateScenePromptOnly` 的问题；修复 `generationStyleOptions` value 字段曾改为长描述导致旧项目 v-model 不匹配的问题

### 架构

- 新增 `angleService.js`：结构化角度定义、`toChineseLabel()`、`toPromptFragment()`、`parseFromLegacyText()` 方法
- 新增迁移文件：`15_storyboard_angle_structured.sql`、`16_character_polished_prompt.sql`（`migrate.js` 自动执行）
- `characterLibraryService` 新增 `generateCharacterPromptOnly()`；`sceneService` 新增 `generateScenePromptOnly()`；`propService` 新增 `generatePropPromptOnly()`
- 新增 API 路由：`GET /characters/:id`、`POST /characters/:id/generate-prompt`；`GET /scenes/:id`、`POST /scenes/:id/generate-prompt`；`GET /props/:id`、`POST /props/:id/generate-prompt`

---

## [1.1.16] - 2026-03-14

### 修复

- **场景四视图生成后不显示**：`createAndGenerateImage` 新增 `scene_id` 参数支持，图片存储目录从 hardcode `characters/` 改为动态判断（`scenes/` / `characters/`），生成成功后自动回写 `scenes.image_url` / `scenes.local_path`
- **分镜图生成结果仍为宫格布局**：修正 Gemini 多模态输入结构，参考图说明文字与图片数据严格交替排列（`[说明] → [图] → [说明] → [图] → [生成指令]`），移除错误的 `systemInstruction` 字段，在生成指令中明确要求输出单张图
- **角色参考图干扰分镜布局**：优先使用拆分后的单张面板作为参考（场景取 `quad_panel_0` 建立远景，角色取 `quad_panel_1` 正面全身），无拆分面板时 fallback 到四视图合图
- **拆分角色面板无法按 ID 查询**：`splitQuadGridToImages` INSERT 时补充 `character_id` 字段，确保面板图片可关联到对应角色
- **参考图标签与传图数量不对齐**：`extra_images` 推入逻辑移入主图存在分支，`refLabels` 强制裁剪到 `refs.length`，Gemini parts 构建时同步对齐

### 架构

- `imageClient.js`：`callGeminiImageApi` 重构多模态 parts 构建逻辑；`MAX_GEMINI_REF_IMAGES` 从 3 提升至 4（支持场景参考图 1 张 + 角色参考图最多 3 张）；`createAndGenerateImage` 支持 `scene_id`，回写 `scenes` 表
- `imageService.js`：`splitQuadGridToImages` INSERT 增加 `character_id`；Step 2 参考图解析优先取拆分面板；移除 Step 2.5 冗余的 `CRITICAL OUTPUT REQUIREMENT` 文字注入；`callImageApi` 调用时传入 `system_prompt`（含参考图标签映射）
- `sceneService.js`：`createAndGenerateImage` 调用时传入 `scene_id`

---

## [1.1.15] - 2026-02-28

### 新增

- **多集剧本生成**：故事生成区新增「生成集数」下拉（1 / 2 / 3 / 4 / 5 / 6 集，默认 1），AI 一次性输出对应集数的连续剧本；返回格式统一为 JSON 数组，每集含 `episode`（序号）、`title`（标题）、`content`（约 800 字正文），多集剧情前后衔接、结尾留悬念；前端自动将所有集数保存到项目并默认选中第 1 集
- **标签优化**：故事生成区「风格」改为「故事风格」、「类型」改为「剧本类型」，语义更清晰
- **AI 并发生成（图片 & 视频）**：「AI 配置 → 生成设置」新增「图片并发数」和「视频并发数」选项（默认各 3，可选 1/2/3/5/8/10 或自定义）；一键生成流水线（角色图 → 场景图 → 分镜图 → 分镜视频）及「补全并生成」均采用 `runConcurrently()` 并发执行，不再串行等待
- **实时任务进度**：流水线运行时底部状态栏同步展示当前正在执行的所有并发任务标签（如「分镜图 #3」「角色图 #1」），含脉冲动画
- **可视化风格选择器（StylePickerButton）**：一键生成视频的「生成风格」从普通下拉框升级为图文选择器弹窗，每种风格显示缩略图（本地 `public/style-thumbs/`）与梯度色块兜底，支持按分类浏览和名称搜索，弹窗尺寸为 `90vw`（最大 1100px），可一次预览更多风格
- **AI JSON 输出强化**：分镜生成、角色提取、场景提取、道具提取全面启用 `json_mode: true`（向兼容模型发送 `response_format: { type: "json_object" }` 约束），从模型层面减少非法 JSON 输出概率
- **jsonrepair 自动修复**：`safeParseAIJSON` 集成 `jsonrepair` 库作为兜底修复策略，自动处理未引号字符串值、括号内容、尾逗号等 AI 常见畸形 JSON；修复时输出 WARN 日志记录修复策略、成功挽救的条目数、原文长度等，方便统计破损率
- **`min_max_tokens` 机制**：`aiClient.generateText` 新增 `min_max_tokens` 参数，调用方可声明最低 token 需求；若用户 AI 配置的 `settings.max_tokens` 低于此需求，自动提升并打 WARN 日志，确保多集剧本等长输出任务不被截断
- **全局设置持久化**：后端新增 `global_settings` 表与 `settingsService`（`getGlobalSetting` / `setGlobalSetting`），并暴露 `GET/PUT /settings/generation` 接口，持久化并发数等全局生成配置
- **AI 配置端点预览**：AI 配置弹窗选择厂商/协议后自动显示实际请求 URL（图片提交地址、视频提交地址），方便排查配置是否正确；特别处理 Google Gemini 的端点拼接规则

### 修复

- **供应商锁定 `api_protocol` 丢失**：`applyVendorLock` 的 `INSERT` 语句补充 `api_protocol` 字段，修复锁定厂商的打包 exe 中视频 API 协议路由错误（如 Vidu 接口返回 `images is required`）
- **导入配置 `api_protocol` 未恢复**：`importConfigs` 中的 `aiAPI.create` 调用补充 `api_protocol`，修复导入旧配置后协议字段丢失问题
- **打包 exe 分镜图片 `fetch failed`**：`uploadService.js` 中图片下载从 Node.js 原生 `fetch` 改为自定义 `downloadBufferViaNodeHttp`（`http`/`https` 模块），支持 3 次重试、30s 超时、自动跟随重定向和 `User-Agent`，解决 Electron 打包环境网络兼容性问题
- **`no such table: storyboard_characters` 警告**：`migrate.js` 补充 `CREATE TABLE IF NOT EXISTS storyboard_characters`，消除九宫格提示词生成时的数据库报错
- **端点预览 URL 重复 `/v1`**：OpenAI 图片端点和 MiniMax 视频端点的预览 URL 去除重复拼接的 `/v1`

### 架构

- **后端**：`safeJson.js` 引入 `jsonrepair` 包；`migrate.js` 新增 `storyboard_characters`、`global_settings` 表；`settingsService.js` 新增全局 KV 设置读写；`routes/settings.js` 暴露并发数 API；`routes/index.js` 注册新路由并向 `settingsRoutes` 传递 `db`；`storyGenerationService.js` 重写为多集 JSON 数组模式；`aiClient.js` 支持 `min_max_tokens`；分镜/角色/背景/道具服务统一启用 `json_mode`
- **前端**：新增 `StylePickerButton.vue` 可视化风格选择器组件；`FilmCreate.vue` 新增 `runConcurrently()` 并发工具函数、`pipelineActiveTasks` 任务进度集合、`storyEpisodeCount` 集数控制、多集 `onGenerateStory` 逻辑；`AIConfigContent.vue` 新增「生成设置」Tab（图片/视频并发数）及端点预览面板；`api/prompts.js` 新增 `generationSettingsAPI`；`public/style-thumbs/` 新增 30 张本地风格缩略图

---

## [1.1.14] - 2026-02-28

### 新增

- **官方仓库链接**：`README.md`、`backend-node/README.md`、`CHANGELOG.md` 均新增 GitHub 与 Gitee 官方仓库徽章链接，方便用户直接提交 Issue 或 PR
- **文档规范化**：`backend-node/README.md` 顶部新增官方仓库说明及 Issue 反馈引导

---

## [1.1.13] - 2026-03-09

### 新增

- **分镜图相机角度视角修正**：`framePromptService.js` 新增 `expandAngleDescription()`，将分镜的 `angle` 字段（平视/仰视/俯视/侧面/背面）翻译为完整的相机透视描述，注入图像提示词上下文，使 AI 生成的背景视角与镜头角度一致
- **四宫格序列图模式（后端拆分）**：分镜配置区新增全局「四宫格序列图」开关。开启后：
  - 生成分镜图时传 `frame_type: 'quad_grid'`，后端并行生成首帧/关键帧×2/尾帧共 4 个帧提示词，拼装为 2×2 象限布局提示词调用一次图片 API
  - 图片保存到本地后，后端使用 `sharp` 自动将整图拆分为 4 张子图（左上/右上/左下/右下），每张子图左上角叠加位置标签，分别存为独立的 `image_generation` 记录（`frame_type = quad_panel_0~3`）
  - 4 张子图与普通生成图完全一致，支持点击缩略图切换主图、重新生成自动更新、历史记录保留
  - 主图选择持久化到 `storyboard.image_url / local_path`，刷新页面后自动从后端恢复

### 修复

- **分镜主图刷新后恢复**：`dramaService.rowToStoryboard()` 和 `storyboardService.getStoryboardById()` 均补充返回 `image_url`、`local_path`、`main_panel_idx` 字段，前端 `restoreSelectionsFromBackend()` 可正确从后端数据比对恢复主图选中状态
- **四宫格生成无变化**：移除前端 Canvas 拆分逻辑后，重新生成触发新的后端拆分，不再受旧内存缓存影响
- **四宫格图片白框**：prompt 改为"NO borders of any color (black, white, gray)，panels must be seamlessly adjacent with no gaps"，杜绝任何颜色边框

### 架构

- **后端**：`imageService.js` 新增 `splitQuadGridToImages()`（依赖 `sharp`），Step 7 自动触发；`buildQuadGridPrompt()` 组装四宫格提示词；`storyboards` 表新增 `image_url`、`local_path`、`main_panel_idx` 列（migrate.js 自动迁移）
- **前端**：删除全部 Canvas 拆分相关代码（`sbQuadPanels`、`splitImageIntoQuadrants`、`triggerSplitQuadGrid`、`_persistPanelToBackend` 等约 120 行），四宫格子图完全复用普通单张图片的展示与选择流程；缩略图条对 `quad_panel_*` 类型图片自动显示位置标签

---

## [1.1.11] - 2026-03-06

### 新增

- **批量生成分镜图 / 批量生成分镜视频**：在「重新生成分镜」按钮右侧新增两个右对齐批量按钮，支持一键为所有缺图分镜生成图片、为所有缺视频分镜生成视频，含实时进度、错误日志和随时停止功能
- **角色/场景影响分镜面板**：角色、场景卡片描述下方新增「影响的分镜：#XX #ZZ」标签行及「↻ 重新生成分镜图」按钮，点击可批量重新生成与该资源关联的所有分镜图片，含确认弹窗和实时进度显示
- **多并发 AI 生成转圈**：同时点击多个角色/道具/场景的「AI生成」或「重新生成」按钮，每个按钮独立保持转圈状态，互不干扰（底层由 `ref(null)` 改为 `reactive(new Set())` 实现）
- **提示词管理动态同步**：`promptOverrides.js` 中的 `default_body` 和 `locked_suffix` 改为从 `promptI18n.js` 动态读取，新增 `getDefaultPromptBody(key)` 和 `getLockedSuffix(key)` 导出函数，UI 展示内容与运行时提示词始终一致，彻底消除双维护问题
- **userData 路径统一**：`desktop/main.js` 将开发模式与打包 exe 的用户数据目录统一固定为 `localminidrama-desktop`，并在首次运行时自动迁移旧路径 `LocalMiniDrama` 下的数据，彻底解决开发/发布切换时数据丢失问题

### 修复

- **手动选择角色不进入分镜生成**：`FilmCreate.vue` 中 `onStoryboardCharacterChange` / `onStoryboardSceneChange` 函数原来为空，导致用户在分镜卡片上手动多选角色或切换场景后，选择不会持久化到后端。现已实现调用 `storyboardsAPI.update`，确保分镜脚本生成时使用用户手动指定的角色/场景
- **道具/角色参考图不生效**：修复 `imageClient.js` 中 `resolveImageRef` 函数的 `isLocalhost` 判断逻辑，使其同时检测 URL 字符串本身是否包含 `localhost/127.0.0.1`；修复 `imageService.js` 在构建分镜参考图列表时未读取 `extra_images` 字段的问题
- **分镜数量控制优化**：当用户指定分镜数量时，在系统提示词末尾动态追加 HIGHEST PRIORITY 级别的数量约束覆盖指令，防止系统提示词中的「独立动作数量匹配」规则与用户数量约束冲突
- **角色数量与分镜动作不一致**：强化 `promptI18n.js` 中的 `character_constraint`、`getStoryboardUserPromptSuffix` 及系统提示词，明确要求 `characters` 数组只填写在本镜头 `action/dialogue` 中有实际描写行为的角色，数量必须与动作描述中出现的人物一致

### 架构

- `promptI18n.js` 新增 `getDefaultPromptBody(key)` / `getLockedSuffix(key)` 两个导出函数，作为提示词默认内容的唯一来源
- `promptOverrides.js` 精简为只维护提示词元数据（key / label / description），彻底去除内容冗余副本

---

## [1.1.10] - 2026-03-05

### 新增

- **Google Gemini 图片生成支持**：新增 `callGeminiImageApi`，使用 `generateContent` 接口，支持 `gemini-2.5-flash-image`、`gemini-3.1-flash-image-preview`、`gemini-3-pro-image-preview` 等模型
- **Google Gemini (Veo) 视频生成支持**：新增 `callGeminiVideoApi`，支持 `veo-3.1-generate-preview`、`veo-3.0-generate-preview`、`veo-3.0-fast-generate-preview` 等模型，含异步任务轮询
- **Gemini 参考图支持（图床方案）**：分镜图片生成时，参考图先上传至中转图床获取公开 URL，再通过 `fileData.fileUri` 传给 Gemini，彻底解决 `inlineData` base64 导致的 503 内存溢出问题
- **图床上传缓存**：新增 `image_proxy_cache` 表，本地图片路径与图床 URL 一一映射，相同图片只上传一次，命中缓存时跳过上传（附 `migrations/12_image_proxy_cache.sql`）
- **API 接口规范字段**：数据库新增 `api_protocol` 列（`migrations/11_add_api_protocol.sql`），可为每条 AI 配置显式指定接口类型（`openai` / `volcengine` / `dashscope` / `gemini` / `nano_banana`），优先级高于厂商自动推断，解决中转站自定义配置走错接口的问题
- **AI 配置页面「接口规范」字段**：自定义厂商时显示下拉框供用户选择接口类型；预设厂商自动填充，无需手动选
- **Gemini 作为分镜图片生成厂商**：在 AI 配置页面，分镜图片生成 (`storyboard_image`) 服务类型增加 Gemini 系列模型选项
- **Gemini 作为视频生成厂商**：在 AI 配置页面，视频生成 (`video`) 服务类型增加 Google Gemini (Veo) 系列模型选项
- **图片/视频风格扩展**：在 `DramaDetail.vue`、`FilmCreate.vue`、`FilmList.vue` 三处将风格选项从 8 个扩展至 29 个，按写实、动漫、中国风、绘画、幻想、数字六大类使用 `el-option-group` 分组展示
- **新增 3:4 竖版比例**：画面比例选项新增「3:4 竖版」
- **分镜生成数量上限提升**：前端 `storyboardCount` 最大值从 50 提升至 200
- **全链路生成日志**：图片生成全链路（接收请求 → 解析参考图 → 图床上传 → Gemini API → 保存图片）均打印带计时的结构化日志，便于排查耗时瓶颈
- **`max_tokens` 自适应上限**：`aiClient.generateText` 读取 AI 配置 `settings.max_tokens` 作为上限，调用方传入值超出时自动截断并打印警告，避免不同模型因上限差异导致 400 错误

### 修复

- **修复 Gemini `MALFORMED_FUNCTION_CALL` 错误**：`generateContent` 接口的请求体中，`aspectRatio` / `numberOfImages` 必须直接放在 `generationConfig` 顶层，而非嵌套在 `imageGenerationConfig`（该字段为 Imagen 独立接口专属），嵌套写法会干扰模型内部 `google:image_gen` 工具调用
- **修复分镜生成 `max_tokens` 超限 400 错误**：移除 `episodeStoryboardService.js` 中写死的 `32768`，由 AI 配置的 `settings.max_tokens` 控制或由模型使用默认值
- **修复分镜生成静默失败**：`onGenerateStoryboard` 轮询超时时间从 6 分钟延长至 15 分钟；正确检查 `pollRes.status` 只在 `completed` 时显示成功提示；超时/失败给出明确提示
- **修复 HTTP 500 错误信息不清晰**：`request.js` Axios 拦截器将后端具体错误信息写回 `error.message`，消除「Request failed with status code 500」的模糊提示
- **图床上传重试机制**：`uploadToImageProxy` 上传失败时自动重试最多 3 次，每次均打印尝试序号和耗时

### 架构

- 确认 `desktop/backend-app` 为构建时由 `copy-backend.js` 自动从 `backend-node` 生成，无需手动同步，日常只需维护 `backend-node`

---

## [1.1.9] - 2026-02-xx

### 新增

- **厂商锁定模式**：`config.yaml` 新增 `vendor_lock` 配置项，启用后强制使用指定 AI 厂商配置，用户仅可修改 API Key 和默认模型，无法新增/删除配置；打包的 exe 每次启动自动同步锁定策略
- **全页面 UI 美化**：四个页面（首页/剧集管理/制作页/AI配置）统一升级为极光渐变背景 + 毛玻璃 Header + 玻璃拟态卡片；Header 改为 `sticky` 吸顶
- **品牌标识双行 Logo**：左上角改为「本地短剧助手 / LocalMiniDrama」双行设计，紫色渐变文字
- **面包屑导航**：剧集管理页和制作页 Header 新增 `›` 分隔符 + 项目名标签；返回按钮移至项目名右侧
- **NanoBanana 图片厂商**：新增 NanoBanana 作为独立图片生成厂商，支持 nano-banana-2 / nano-banana-pro / nano-banana 三个模型
- **AI 配置导出 / 导入**：一键导出全部 AI 配置为 JSON 文件，换机或团队共享配置直接导入
- **端点字段可配置**：图片、分镜、视频类型配置均可手动填写「提交端点」和「查询端点」

### 修复

- **角色提取优化**：移除错误的固定数量限制，改为提取剧本中所有有名字的角色；去除无实际用途的 `personality` 字段，加强中文输出约束，速度提升约 40%
- **分镜截断修复**：`max_tokens` 从 8192 提升至 32768，新增 `repairTruncatedJsonArray` 智能修复截断 JSON
- **分镜参考图优化**：角色图和场景参考图优先读取本地文件并转为 Base64 传给图片 API
- **doubao-seedream 参数修正**：参考图字段名由 `imageUrls` 修正为官方规范 `image`，自动移除 `n` 参数并关闭水印

---

## [1.1.8] - 2026-02-xx

### 新增

- **提示词高级设置**：AI 配置页新增「高级设置（提示词）」Tab，支持自定义 9 个核心提示词，修改后立即生效；JSON 输出格式部分加锁保护；随时一键恢复默认
- **AI 厂商自定义选项**：厂商下拉菜单底部新增「自定义」选项

### 修复

- **多项 UI/UX 优化**：Aurora 渐变背景、玻璃拟态卡片、双行 Logo；DramaDetail / FilmCreate / AiConfig 页面风格统一
- **提示词持久化**：自定义提示词通过 SQLite 持久存储（`prompt_overrides` 表），后端内存缓存加速读取

---

## [1.1.6] - 2026-01-xx

### 新增

- **工程导出/导入**：完整打包工程为 ZIP（含图片、视频、文字、配置），换机或分享一包搞定
- **画面比例设置**：新建项目时选定比例（16:9 / 9:16 / 1:1 / 4:3 等），后续生成全程自动适配
- **视频参数扩展**：视频生成支持 `resolution`、`seed`、`camera_fixed`、`watermark` 等参数
- **视频合并进度展示**：合成完整剧集视频时，前端实时展示合并进度

### 修复

- **图片生成去水印**：火山引擎图片生成默认传入 `watermark: false`
- **导出 ZIP 修复**：修复导出文件只有 9 字节的问题
- **导入数据关联修复**：导入时正确创建 `episode_characters`，修复导入后看不到角色/场景/道具的问题

---

## [1.1.4] - 2026-01-xx

### 新增

- **剧集管理页**：新增独立的剧集管理页面（`/drama/:id`），统一管理剧集信息、本剧资源库与分集列表
- **资源库分层**：本剧资源库（按剧过滤）与全局素材库严格隔离
- **素材库导入**：在剧集管理页可一键从全局素材库导入角色/场景/道具
- **明暗主题切换**：支持暗色/浅色模式，偏好持久保存

---

## [1.1.x] - 早期版本

- 一键生成流水线：自动跳过已有内容，失败自动重试最多 3 次
- 实时进度展示：流水线执行中实时显示步骤与错误日志
- 视频/图片提示词编辑：每个分镜可单独查看和修改提示词
- AI 配置优化：支持多种服务商连接测试

---

## [1.0.x] - 2026-01-xx

- 项目立项与基础架构搭建（Vue 3 + Node.js + Electron）
- 剧本生成、角色/场景/道具提取
- 分镜生成与图片/视频生成核心流程
- SQLite 数据持久化
- Windows exe 打包
