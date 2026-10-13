---
name: local-mini-drama
version: 1.1.0
description: LocalMiniDrama 本地短剧助手 — 通过自然语言控制短剧项目全流程：创建剧本、生成角色/场景/道具、生成分镜、批量出图、出视频、合成完整剧集、支持小说导入和工程导入导出
trigger: "生成短剧|创建短剧|制作短剧|短剧创作|生成分镜|生成视频|生成图片|生成角色|生成场景|生成道具|导出工程|导入工程|导入小说|合成视频|短剧项目|短剧助手|帮我写剧本|写一个短剧|我要拍短剧|生成本集|继续制作|查看项目|查看剧本|查看分镜|角色库|场景库|道具库|AI配置|配置密钥|配置API"
config:
  base_url:
    type: string
    description: LocalMiniDrama 后端地址，如 http://localhost:5679 或 http://你的服务器IP:5679
    default: "http://localhost:5679"
  default_aspect_ratio:
    type: string
    description: 默认画面比例
    default: "16:9"
  default_video_duration:
    type: number
    description: 默认单个视频片段时长（秒）
    default: 5
tools: [http, memory]
requiredContext:
  - drama_id
  - episode_id
author: xuanyustudio
homepage: https://github.com/xuanyustudio/LocalMiniDrama
---

# LocalMiniDrama 本地短剧助手

通过自然语言控制 LocalMiniDrama 后端，完成从零到短剧成片的全流程 AI 生成。

## 核心概念

- **Drama（剧集）**：一个短剧项目，包含多集（Episode）
- **Episode（集数）**：单集内容，包含剧本（story）和分镜（Storyboard）
- **Storyboard（分镜）**：单个镜头，含台词、动作、画面描述、图片、视频
- **Character（角色）**：剧集中的角色，支持全局角色库复用
- **Scene（场景）**：剧集中的场景，支持全局场景库
- **Prop（道具）**：剧集中的道具，支持全局道具库

## 触发条件

用户想要创建、管理、生成短剧相关内容时使用此技能。

---

## ⚡ 快速开始

### 1. 获取后端地址

```js
const baseUrl = config.base_url || "http://localhost:5679";
```

### 2. 列出已有项目（判断是否需要新建）

```
GET {baseUrl}/api/v1/dramas?page=1&page_size=20
```

### 3. 创建新剧集项目

```
POST {baseUrl}/api/v1/dramas
Content-Type: application/json

{
  "title": "少年修仙传",
  "style": "古风仙侠",
  "type": "short_drama",
  "metadata": {
    "aspect_ratio": "16:9",
    "video_duration": 5
  }
}
```

> `metadata.aspect_ratio` 支持 `16:9`（横屏）、`9:16`（竖屏）、`1:1`（方形）

### 4. 生成剧本（支持流式）

**流式（推荐）**：实时接收 AI 生成的剧本内容
```
POST {baseUrl}/api/v1/generation/story/stream
Content-Type: application/json

{
  "premise": "一个少年意外获得上古修仙传承...",
  "style": "古风仙侠",
  "episode_count": 3,
  "genre": "仙侠"
}
```

**非流式**：等待完整结果后一次性返回
```
POST {baseUrl}/api/v1/generation/story
Content-Type: application/json

{
  "premise": "...",
  "style": "古风仙侠",
  "episode_count": 3
}
```

流式响应格式（SSE）：
- `{ "type": "start" }` — 开始
- `{ "type": "progress", "text": "已生成的文字..." }` — 增量文本
- `{ "type": "done", "result": { "episodes": [...] } }` — 完成，附结构化集数
- `{ "type": "error", "message": "..." }` — 错误

**将生成的剧本保存到项目集数**：
> 字段名：`script_content`（不是 `content`），`title`（集标题），`episode_number`

```
PUT {baseUrl}/api/v1/dramas/{drama_id}/episodes
Content-Type: application/json

{
  "episodes": [
    {
      "episode_number": 1,
      "title": "山涧奇遇，石中传承",
      "script_content": "第一集剧本完整正文..."
    }
  ]
}
```

---

## 📋 项目管理

### 获取项目详情
```
GET {baseUrl}/api/v1/dramas/{drama_id}
```

### 更新项目信息
```
PUT {baseUrl}/api/v1/dramas/{drama_id}
Content-Type: application/json

{
  "title": "新标题",
  "style": "都市言情",
  "metadata": { "aspect_ratio": "9:16" }
}
```

### 删除项目（软删除）
```
DELETE {baseUrl}/api/v1/dramas/{drama_id}
```

### 获取项目统计
```
GET {baseUrl}/api/v1/dramas/stats
```

---

## 👤 角色管理

### 获取项目角色列表
```
GET {baseUrl}/api/v1/dramas/{drama_id}/characters
```

### AI 提取剧本角色（异步任务）
```
POST {baseUrl}/api/v1/generation/characters
Content-Type: application/json

{
  "drama_id": "项目ID"
}
```
→ 返回 `{ "task_id": "...", "status": "pending" }`，用 `GET /api/v1/tasks/{task_id}` 轮询

### 手动保存角色
```
PUT {baseUrl}/api/v1/dramas/{drama_id}/characters
Content-Type: application/json

{
  "characters": [
    { "name": "李逍遥", "description": "少年，侠客", "appearance": "白衣少年，剑眉星目" },
    { "name": "赵灵儿", "description": "仙女", "appearance": "青衣少女" }
  ]
}
```

### 生成角色形象图（AI）
```
POST {baseUrl}/api/v1/characters/{character_id}/generate-image
Content-Type: application/json

{
  "prompt_override": "古风仙侠，白衣少年，剑眉星目..."
}
```

### 生成角色四视图
```
POST {baseUrl}/api/v1/characters/{character_id}/generate-four-view-image
```

### 从图片提取角色描述
```
POST {baseUrl}/api/v1/characters/{character_id}/extract-from-image
Content-Type: application/json

{
  "image_url": "/static/storage/..."
}
```

### 全局角色库
```
GET  {baseUrl}/api/v1/character-library
POST {baseUrl}/api/v1/character-library   # 新建角色
PUT  {baseUrl}/api/v1/character-library/{id}
DELETE {baseUrl}/api/v1/character-library/{id}
```

---

## 🏠 场景管理

### 获取项目场景
```
GET {baseUrl}/api/v1/dramas/{drama_id}/scenes
```

### 提取场景（从集数剧本）
```
POST {baseUrl}/api/v1/episodes/{episode_id}/extract-backgrounds
```

### 生成场景图
```
POST {baseUrl}/api/v1/scenes/{scene_id}/generate-image
```

### 全局场景库
```
GET  {baseUrl}/api/v1/scene-library
POST {baseUrl}/api/v1/scene-library
PUT  {baseUrl}/api/v1/scene-library/{id}
DELETE {baseUrl}/api/v1/scene-library/{id}
```

---

## 🎬 道具管理

### 获取项目道具
```
GET {baseUrl}/api/v1/dramas/{drama_id}/props
```

### 提取道具
```
POST {baseUrl}/api/v1/episodes/{episode_id}/extract-props
```

### 生成道具图
```
POST {baseUrl}/api/v1/props/{prop_id}/generate
```

### 全局道具库
```
GET  {baseUrl}/api/v1/prop-library
POST {baseUrl}/api/v1/prop-library
PUT  {baseUrl}/api/v1/prop-library/{id}
DELETE {baseUrl}/api/v1/prop-library/{id}
```

---

## 🎥 分镜管理

### 生成分镜（异步任务）
```
POST {baseUrl}/api/v1/episodes/{episode_id}/storyboards
Content-Type: application/json

{
  "model": "qwen-plus",          // 可选，AI 模型名称
  "style": "古风仙侠",            // 可选，覆盖项目风格
  "storyboard_count": 8,         // 可选，分镜数量（默认自动）
  "video_duration": 5,            // 可选，单个视频秒数
  "aspect_ratio": "16:9",        // 可选，覆盖比例
  "include_narration": false      // 是否含旁白
}
```
→ 返回 `{ "task_id": "...", "status": "pending" }`

### 获取集数分镜列表
```
GET {baseUrl}/api/v1/episodes/{episode_id}/storyboards
```

### 获取单条分镜详情
```
GET {baseUrl}/api/v1/storyboards/{storyboard_id}
```

### 更新分镜
```
PUT {baseUrl}/api/v1/storyboards/{storyboard_id}
Content-Type: application/json

{
  "dialogue": "调整后的台词",
  "action": "调整后的动作",
  "image_prompt": "调整后的画面描述"
}
```

### 删除分镜
```
DELETE {baseUrl}/api/v1/storyboards/{storyboard_id}
```

### 新增分镜（在指定位置前插入）
```
POST {baseUrl}/api/v1/storyboards/{storyboard_id}/insert-before
```

### 批量推断摄影参数（毫秒级，无需 AI）
```
POST {baseUrl}/api/v1/storyboards/batch-infer-params
Content-Type: application/json

{
  "episode_id": "集数ID",
  "overwrite": false   // 是否覆盖已有参数
}
```

### 优化分镜画面描述（AI）
```
POST {baseUrl}/api/v1/storyboards/{storyboard_id}/polish-prompt
```

### 生成分镜首/尾帧提示词
```
POST {baseUrl}/api/v1/storyboards/{storyboard_id}/frame-prompt
Content-Type: application/json

{
  "frame_type": "first",   // "first" | "last" | "key"
  "panel_count": 3,
  "model": "qwen-plus"
}
```

### 分镜图片超分（2x）
```
POST {baseUrl}/api/v1/storyboards/{storyboard_id}/upscale
```

---

## 🖼️ 图片生成

### 批量生成图片（推荐）
```
POST {baseUrl}/api/v1/images/episode/{episode_id}/batch
Content-Type: application/json

{
  "types": ["image"]          // 或 ["image", "video"] 同时出图和视频
}
```

### 查询图片任务
```
GET {baseUrl}/api/v1/images/{image_gen_id}
```

### 获取分镜关联的图片
```
GET {baseUrl}/api/v1/storyboards/{storyboard_id}/images
```

### 手动上传图片覆盖分镜
```
POST {baseUrl}/api/v1/storyboards/{storyboard_id}/upload
Content-Type: multipart/form-data

file: <图片文件>
```

---

## 🎞️ 视频生成

### 批量生成视频
```
POST {baseUrl}/api/v1/videos/episode/{episode_id}/batch
Content-Type: application/json

{
  "types": ["video"]
}
```

### 查询视频任务
```
GET {baseUrl}/api/v1/videos/{video_gen_id}
```

### 查询合并进度
```
GET {baseUrl}/api/v1/episodes/{episode_id}/merge-status
```

---

## ✂️ 视频合成

### 触发合成
```
POST {baseUrl}/api/v1/video-merges
Content-Type: application/json

{
  "episode_id": "集数ID",
  "merge_type": "concatenate"   // 串联所有分镜视频
}
```

### 查询合成任务
```
GET {baseUrl}/api/v1/video-merges/{merge_id}
```

### 获取最终视频下载
```
GET {baseUrl}/api/v1/episodes/{episode_id}/download
```

---

## ⏳ 异步任务查询

所有生成类任务（角色、分镜、图片、视频）均为异步，**必须轮询查询状态**：

```
GET {baseUrl}/api/v1/tasks/{task_id}
```

任务状态响应：
```json
{
  "task_id": "...",
  "status": "pending" | "processing" | "completed" | "failed",
  "progress": 65,
  "result": { ... },
  "error": "失败原因（失败时）"
}
```

**轮询策略**：
- 初始等待：500ms
- pending/processing：每 2s 查询一次
- 超过 60 次（2 分钟）视为超时，提示用户后台继续

---

## 📖 工程导入导出

### 导出工程 ZIP
```
GET {baseUrl}/api/v1/dramas/{drama_id}/export
```
→ 返回 ZIP 文件下载

### 导入工程 ZIP
```
POST {baseUrl}/api/v1/dramas/import
Content-Type: multipart/form-data

file: <xxx.zip>
```

### 从小说文本导入（自动拆章生成剧集结构）
```
POST {baseUrl}/api/v1/dramas/import-novel
Content-Type: multipart/form-data
（或者 JSON body）

text: <小说全文>
title: "小说标题"
max_chapters: 20
ai_summarize: true   // 是否用 AI 压缩章节
```

---

## 🤖 AI 配置管理

### 获取所有 AI 配置
```
GET {baseUrl}/api/v1/ai-configs
```

### 创建 AI 配置
```
POST {baseUrl}/api/v1/ai-configs
Content-Type: application/json

{
  "name": "通义千问",
  "vendor": "dashscope",
  "api_key": "sk-...",
  "model": "qwen-plus",
  "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1"
}
```

### 测试连接
```
POST {baseUrl}/api/v1/ai-configs/{config_id}/test
```

### 一键预设
```
POST {baseUrl}/api/v1/ai-configs/preset/dashscope   # 通义千问
POST {baseUrl}/api/v1/ai-configs/preset/volcengine   # 豆包/火山引擎
```

### 批量更新密钥
```
PUT {baseUrl}/api/v1/ai-configs/bulk-update-key
Content-Type: application/json

{
  "api_key": "sk-..."
}
```

---

## 💾 全局设置

### 获取/设置语言（提示词语言）
```
GET  {baseUrl}/api/v1/settings/language
PUT  {baseUrl}/api/v1/settings/language   { "language": "zh" | "en" }
```

### 获取/设置生成参数默认值
```
GET  {baseUrl}/api/v1/settings/generation
PUT  {baseUrl}/api/v1/settings/generation
```

### 提示词覆盖
```
GET  {baseUrl}/api/v1/settings/prompts
PUT  {baseUrl}/api/v1/settings/prompts/{key}   { "value": "..." }
DELETE {baseUrl}/api/v1/settings/prompts/{key}
```

---

## 📰 内容改良（一键原创/翻译/混剪）

### 一键翻译出海（配字幕、BGM）
```
POST {baseUrl}/api/v1/globalize/start
Content-Type: multipart/form-data

file: <视频文件>
bgm: <BGM音频>
subtitle_file: <字幕文件>
target_lang: "en"
```

### 一键原创化
```
POST {baseUrl}/api/v1/original/start
```

### 文稿改良
```
POST {baseUrl}/api/v1/rewrite/start
```

### 批量混剪
```
POST {baseUrl}/api/v1/mixcut/start
Content-Type: multipart/form-data

videos: <最多120个视频文件>
```

---

## 🔄 标准工作流（正确顺序）

> ⚠️ **顺序至关重要！必须先提取角色/场景/道具，再生成分镜。**
> 否则分镜中 `characters` 列表为空、`background` 为 null，角色形象和场景无法关联到具体镜头。

### 完整制作流程

**Step 1：创建项目**
```
POST /api/v1/dramas
→ 记下返回的 drama_id
```

**Step 2：生成剧本（流式）**
```
POST /api/v1/generation/story/stream
```
> body 字段：`premise`（梗概）、`style`（风格）、`genre`（类型）、`episode_count`（集数）

**Step 3：保存剧本到集数**
```
PUT /api/v1/dramas/{drama_id}/episodes
```
> 字段名：`script_content`（不是 `content`），`title`（集标题），`episode_number`

**Step 4：提取角色（AI 自动从剧本分析）**
```
POST /api/v1/generation/characters
Content-Type: application/json

{
  "drama_id": "项目ID",
  "episode_id": "集数ID（可选）",
  "outline": "剧本摘要（可选，默认取当前集数剧本内容）",
  "count": 10
}
→ 返回 { "task_id": "..." }，轮询 task 状态，完成后角色自动写入数据库
```

**Step 5：提取场景（AI 自动从剧本分析）**
```
POST /api/v1/images/episode/{episode_id}/backgrounds/extract
→ 返回 { "task_id": "..." }，轮询 task，返回场景列表含 location/time/atmosphere
```

**Step 6：提取道具（AI 自动从剧本分析）**
```
POST /api/v1/episodes/{episode_id}/props/extract
→ 返回 { "task_id": "..." }，轮询 task，返回道具列表
```

**Step 7：生成角色形象图（可选，建议在生成分镜前完成）**
```
POST /api/v1/characters/{character_id}/generate-image
→ 角色图生成后关联到角色库，分镜 AI 会自动使用角色形象
```

**Step 8：生成场景图（可选）**
```
POST /api/v1/scenes/{scene_id}/generate-image
```

**Step 9：生成分镜（此时角色已就绪，场景会自动推断）**
```
POST /api/v1/episodes/{episode_id}/storyboards
→ 轮询 task，分镜中 characters 字段会自动填充，background 自动推断
```

**Step 10：批量生成图片**
```
POST /api/v1/images/episode/{episode_id}/batch
→ 轮询图片任务直到完成
```

**Step 11：批量生成视频**
```
POST /api/v1/videos/episode/{episode_id}/batch
→ 轮询视频任务直到完成
```

**Step 12：合成最终视频**
```
POST /api/v1/video-merges
→ 轮询直到 completed
→ GET /api/v1/episodes/{episode_id}/download 获取下载
```

---

### ❌ 错误流程（已废弃）

```
生成剧本 → 保存剧本 → ❌直接生成分镜
```
这种方式会导致分镜中 `characters=[]`、`background=null`，因为分镜 AI 生成时还不知道有哪些角色和场景。

### 快速问答流程（无需新建项目）

**问："我有一个仙侠剧本，帮我制作"**
1. `POST /api/v1/dramas` 创建项目
2. `POST /api/v1/generation/story/stream` 生成剧本
3. 后续同上

**问："给这个角色生成一张图"**
1. `GET /api/v1/dramas/{drama_id}/characters` 获取角色列表
2. `POST /api/v1/characters/{id}/generate-image`

**问："这集视频做好了吗"**
1. `GET /api/v1/episodes/{episode_id}/merge-status` 查合成状态
2. 或 `GET /api/v1/episodes/{episode_id}/storyboards` 查各分镜视频状态

**问："帮我制作这个短剧"**
→ 执行完整制作流程（Step 1–12）

---

## 📝 响应格式规范

所有成功响应：
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-03-31T..."
}
```

所有错误响应：
```json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "错误描述" },
  "timestamp": "..."
}
```

常见错误码：
- `VALIDATION_ERROR`：参数校验失败
- `NOT_FOUND`：资源不存在
- `INTERNAL_ERROR`：服务端错误
- `AI_ERROR`：AI 服务调用失败（检查 API Key 和模型配置）

---

## ⚠️ 注意事项

1. **base_url 必须包含协议头**：`http://` 或 `https://`，末尾不带 `/`
2. **异步任务必须轮询**：不要假设创建任务后立即完成
3. **生图/视频失败优先检查**：
   - AI Config 中图片/视频 API Key 是否配置
   - 账户额度是否充足
4. **竖屏创作**：`metadata.aspect_ratio = "9:16"`，视频 API 参数也要对应
5. **工程文件导入**：仅支持从 `LocalMiniDrama` 导出的 ZIP 格式
6. **小说导入**：建议单次不超过 30 章，超长文本先让用户分段

---

## 常见对话模板

| 用户意图 | 推荐操作 |
|---------|---------|
| "帮我创建一个仙侠短剧" | 创建项目 → 生成剧本（流式）→ 保存剧本 → 提取角色/场景/道具 → 生成分镜 |
| "帮我制作这个短剧" | 执行完整制作流程 Step 1–12 |
| "生成本集分镜" | 确认已有角色/场景/道具 → POST storyboards |
| "这集做好了吗" | GET merge-status |
| "给李逍遥生成一张图" | 获取角色 → POST generate-image |
| "我上传了图片，给我提取角色" | POST extract-from-image |
| "把这个工程导出" | GET export |
| "我有篇小说，帮我制作短剧" | POST import-novel → 生成剧本 → 后续流程 |
| "配置一下通义千问" | POST preset/dashscope 或 POST ai-configs |
| "增加一个分镜" | POST insert-before |
| "优化一下这个分镜的描述" | POST polish-prompt |

> **⚠️ 重要提醒**：每次执行"生成分镜"之前，必须先确认已完成"提取角色/场景/道具"。未提取就生成分镜，会导致分镜中 characters=[]、background=null。
