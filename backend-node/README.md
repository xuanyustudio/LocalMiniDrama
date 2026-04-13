# LocalMiniDrama 后端服务

**Node.js + Express + SQLite · 纯 JavaScript · 无 TypeScript**

→ [项目主页](../README.md) | [快速开始](../docs/quickstart.md) | [AI 配置](../docs/configuration.md) | [版本历史](../docs/changelog.md) | [作者故事](../docs/story.md) | [English](../docs/en.md)

**官方仓库：**
[![GitHub](https://img.shields.io/badge/GitHub-xuanyustudio%2FLocalMiniDrama-181717?logo=github)](https://github.com/xuanyustudio/LocalMiniDrama)
[![Gitee](https://img.shields.io/badge/Gitee-bi__shang__a%2Flocalminidrama-C71D23?logo=gitee)](https://gitee.com/bi_shang_a/localminidrama)

> 遇到问题或有功能建议，欢迎在 [GitHub Issues](https://github.com/xuanyustudio/LocalMiniDrama/issues) 或 [Gitee Issues](https://gitee.com/bi_shang_a/localminidrama/issues) 提交反馈。

> **本包版本：** `1.2.6`（与仓库根目录 [CHANGELOG](../CHANGELOG.md)、前端与桌面 `package.json` 对齐）

---

## 目录

- [环境要求](#环境要求)
- [安装与启动](#安装与启动)
- [目录结构](#目录结构)
- [配置文件](#配置文件)
- [API 接口总览](#api-接口总览)
- [数据库说明](#数据库说明)
- [各大平台中转站示例配置](#各大平台中转站示例配置)
- [AI 服务集成](#ai-服务集成)
- [开发说明](#开发说明)

---

## 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | >= 18 |
| npm | 随 Node.js 附带 |

---

## 安装与启动

```bash
cd backend-node

# 安装依赖
npm install

# 复制配置文件
cp configs/config.example.yaml configs/config.yaml
# Windows: copy configs\config.example.yaml configs\config.yaml

# 编辑 config.yaml，填入 AI API 配置（也可通过前端「AI 配置」页面管理）

# 首次运行：初始化数据库表
npm run migrate

# 生产启动（默认端口 5679）
npm start

# 开发模式（nodemon 热重载）
npm run dev
```

启动成功后终端输出：
```
Server started on port 5679
```

---

## 目录结构

```
backend-node/
├── configs/
│   ├── config.example.yaml     # 配置模板（提交到 Git）
│   └── config.yaml             # 实际配置（不提交，自行创建）
├── data/
│   ├── drama_generator.db      # SQLite 数据库
│   └── storage/                # 生成的图片/视频本地文件
│       ├── images/             # 分镜生成图
│       ├── characters/         # 角色图
│       ├── scenes/             # 场景图
│       ├── videos/             # 生成的视频片段
│       └── merged/             # 合成后的完整视频
├── migrations/
│   ├── 01_init.sql             # 初始建表
│   ├── 02_local_path.sql       # 本地路径字段
│   └── 03_async_tasks_frame_prompts.sql
├── src/
│   ├── app.js                  # Express 应用（路由注册、中间件）
│   ├── server.js               # HTTP 服务入口
│   ├── logger.js               # 日志（pino）
│   ├── response.js             # 统一响应格式工具
│   ├── config/
│   │   └── index.js            # YAML 配置加载
│   ├── db/
│   │   ├── index.js            # better-sqlite3 连接
│   │   └── migrate.js          # 启动时自动补列（ensureColumns）
│   ├── routes/
│   │   ├── index.js            # 路由总入口
│   │   ├── drama.js            # 剧本 / 导出 / 导入
│   │   ├── videos.js           # 视频生成任务
│   │   ├── images.js           # 图片生成任务
│   │   ├── tasks.js            # 异步任务查询
│   │   ├── aiConfig.js         # AI 服务商配置 CRUD
│   │   ├── settings.js         # 全局设置
│   │   └── static.js           # 静态文件服务（/static）
│   └── services/
│       ├── dramaService.js             # 剧本 CRUD 与数据组装
│       ├── episodeStoryboardService.js # 分镜生成核心逻辑
│       ├── imageService.js             # 图片生成任务处理
│       ├── videoService.js             # 视频生成任务处理
│       ├── videoMergeService.js        # 视频合并（ffmpeg）
│       ├── videoClient.js              # 视频 API 调用（Volcengine 等）
│       ├── imageClient.js              # 图片 API 调用（DashScope 等）
│       ├── characterGenerationService.js  # 角色提取与生成
│       ├── characterLibraryService.js     # 角色库管理
│       ├── backgroundExtractionService.js # 场景背景提取
│       ├── propExtractionService.js       # 道具提取
│       ├── propImageGenerationService.js  # 道具图片生成
│       ├── framePromptService.js          # 首/尾帧提示词生成
│       ├── dramaExportService.js          # 工程导出为 ZIP
│       ├── dramaImportService.js          # ZIP 工程导入
│       ├── promptI18n.js                  # 多语言提示词模板
│       └── uploadService.js              # 本地文件存储管理
└── tools/                      # 辅助脚本（数据迁移等）
```

---

## 配置文件

`configs/config.yaml` 主要配置项：

```yaml
server:
  port: 5679                      # HTTP 服务端口

database:
  path: ./data/drama_generator.db # SQLite 文件路径

storage:
  local_path: ./data/storage      # 图片/视频本地存储根目录

language: zh                      # 提示词语言（zh / en）

style:
  default_style: realistic         # 默认绘图风格
  default_image_ratio: "16:9"      # 默认图片比例
  default_video_ratio: "16:9"      # 默认视频比例
```

> AI 服务配置（API Key、模型名、端点 URL）通过前端「AI 配置」页面管理，存储于数据库 `ai_service_configs` 表，无需手动编辑 YAML。

---

## 各大平台中转站示例配置

仓库根目录（与 `backend-node` 同级）下的 [`各大平台中转站配置/`](https://github.com/xuanyustudio/LocalMiniDrama/tree/main/%E5%90%84%E5%A4%A7%E5%B9%B3%E5%8F%B0%E4%B8%AD%E8%BD%AC%E7%AB%99%E9%85%8D%E7%BD%AE) 提供多家常见中转站的 **完整 JSON 示例**，可直接对照导入前端「AI 配置」，再改为自己的 Key 与地址。

| 文件 | 说明 |
|------|------|
| `使用说明.txt` | 导入后需将 **每一条** 服务里的 `api_key` 换成自己的 |
| `302ai-302.json` | 302.AI 示例 |
| `云雾ai.json` | 云雾 AI 示例 |
| `向量.json` | 向量平台示例 |
| `飞儿api-ffir.cn.json` | 飞儿 API 示例 |

**示意图（与 JSON 互补）：**

- [官方即梦 2.0 配置](https://github.com/xuanyustudio/LocalMiniDrama/blob/main/%E5%90%84%E5%A4%A7%E5%B9%B3%E5%8F%B0%E4%B8%AD%E8%BD%AC%E7%AB%99%E9%85%8D%E7%BD%AE/%E5%AE%98%E6%96%B9%E5%8D%B3%E6%A2%A62.0%E9%85%8D%E7%BD%AE.png)
- [本地反向代理即梦 Free API 配置](https://github.com/xuanyustudio/LocalMiniDrama/blob/main/%E5%90%84%E5%A4%A7%E5%B9%B3%E5%8F%B0%E4%B8%AD%E8%BD%AC%E7%AB%99%E9%85%8D%E7%BD%AE/%E8%B0%83%E7%94%A8%E6%9C%AC%E5%9C%B0%E5%8F%8D%E5%90%91%E4%BB%A3%E7%90%86%E5%8D%B3%E6%A2%A6freeapi%E7%9A%84%E9%85%8D%E7%BD%AE.png)

若中转商控制台中的商品名（如「即梦 2.0」）与示例里的 **模型 ID**（如 `doubao-seedream-4-0-250828`）表述不一致，以对方实际开放的模型 ID 为准，并在本系统中与 JSON 保持一致。更多面向最终用户的说明见仓库根目录 [项目主页 `index.html`](../index.html) 中的「AI 与各大平台中转站」区块（发布页展示用）。

---

## API 接口总览

所有接口前缀：`/api/v1`

响应统一格式：
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```
错误响应：
```json
{
  "success": false,
  "error": { "code": "INTERNAL_ERROR", "message": "..." },
  "timestamp": "..."
}
```

### 剧集（Drama）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/dramas` | 获取剧集列表（分页） |
| POST | `/dramas` | 创建新剧集 |
| GET | `/dramas/:id` | 获取剧集详情（含集数、角色、场景等） |
| PUT | `/dramas/:id` | 更新剧集信息 |
| DELETE | `/dramas/:id` | 软删除剧集 |
| GET | `/dramas/:id/export` | 导出工程 ZIP |
| POST | `/dramas/import` | 导入工程 ZIP（multipart/form-data，字段名 `file`） |
| GET | `/dramas/stats` | 统计信息 |

### 集数（Episode）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/episodes/:id` | 获取集数详情 |
| PUT | `/episodes/:id` | 更新集数（剧本内容、标题等） |
| POST | `/dramas/:id/episodes` | 新增集数 |
| DELETE | `/episodes/:id` | 删除集数 |

### 分镜（Storyboard）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/episodes/:id/storyboards` | 获取集数所有分镜 |
| POST | `/episodes/:id/generate-storyboard` | 触发分镜生成任务 |
| PUT | `/storyboards/:id` | 更新分镜字段 |

### 图片生成（Image）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/images` | 创建图片生成任务 |
| GET | `/images/:id` | 查询任务状态 |
| GET | `/storyboards/:id/images` | 获取分镜所有图片 |
| POST | `/storyboards/:id/images/upload` | 手动上传图片 |

### 视频生成（Video）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/videos` | 创建视频生成任务 |
| GET | `/videos/:id` | 查询任务状态 |
| POST | `/episodes/:id/merge-video` | 触发视频合并 |
| GET | `/episodes/:id/merge-status` | 查询合并进度 |

### AI 配置（AI Config）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai-configs` | 获取所有 AI 配置 |
| POST | `/ai-configs` | 新增配置 |
| PUT | `/ai-configs/:id` | 修改配置 |
| DELETE | `/ai-configs/:id` | 删除配置 |
| POST | `/ai-configs/:id/test` | 测试连接 |
| POST | `/ai-configs/preset/dashscope` | 一键创建通义预设 |
| POST | `/ai-configs/preset/volcengine` | 一键创建火山预设 |

### 异步任务（Task）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/tasks/:id` | 查询任务状态与进度 |
| GET | `/tasks` | 获取任务列表 |

### 角色与素材库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/dramas/:id/characters` | 获取剧集角色 |
| POST | `/dramas/:id/characters/extract` | 从剧本提取角色（触发任务） |
| POST | `/characters/:id/generate-image` | 生成角色图片 |
| GET | `/dramas/:id/scenes` | 获取剧集场景 |
| POST | `/episodes/:id/extract-backgrounds` | 提取场景背景（触发任务） |
| GET | `/dramas/:id/props` | 获取剧集道具 |
| POST | `/episodes/:id/extract-props` | 从剧本提取道具（触发任务） |
| POST | `/props/:id/generate-image` | 生成道具图片 |

### 静态文件

| 路径 | 说明 |
|------|------|
| `GET /static/*` | 访问 `data/storage/` 下的图片/视频文件 |

---

## 数据库说明

使用 better-sqlite3（同步 API），数据库文件为单个 SQLite 文件。

**主要数据表：**

| 表名 | 说明 |
|------|------|
| `dramas` | 剧集基本信息（标题、类型、风格、metadata） |
| `episodes` | 集数（所属剧集、剧本内容） |
| `storyboards` | 分镜（所属集数、台词、动作、提示词等） |
| `characters` | 角色（所属剧集、外貌描述、图片路径） |
| `episode_characters` | 角色-集数关联表（多对多） |
| `scenes` | 场景（所属剧集/集数、位置、时间、提示词） |
| `props` | 道具（所属剧集/集数、类型、描述） |
| `image_generations` | 图片生成任务记录（状态、本地路径） |
| `video_generations` | 视频生成任务记录（状态、本地路径、参数） |
| `video_merges` | 视频合并任务记录 |
| `ai_service_configs` | AI 服务商配置（API Key、模型、端点） |
| `async_tasks` | 通用异步任务（分镜生成、角色提取等） |
| `character_libraries` | 全局/剧集角色素材库 |
| `scene_libraries` | 全局/剧集场景素材库 |
| `prop_libraries` | 全局/剧集道具素材库 |

**字段约定：**
- `deleted_at IS NULL` — 所有查询均过滤软删除记录
- `metadata TEXT` — JSON 字符串，存储扩展属性（如 `aspect_ratio`、`video_clip_duration`）
- `local_path TEXT` — 相对于 `storage/` 根目录的相对路径

**数据库迁移：**
- `npm run migrate` — 运行 `migrations/` 目录下的 SQL 文件
- 每次服务启动时自动执行 `ensureColumns()`，确保所有列存在（支持旧数据库升级）

---

## AI 服务集成

### 图片生成流程

1. 前端调用 `POST /images` → 创建 `image_generations` 记录（status=pending）
2. `imageService.js` 异步处理：调用配置好的图片 API → 下载图片到本地 → 更新记录（status=completed, local_path）
3. 前端轮询 `GET /images/:id` 直到 status=completed

**支持的图片 API：**
- DashScope（通义万象）：`POST /api/v1/services/aigc/text2image/image-synthesis`
- Volcengine（豆包）：`POST /api/v3/images/generations`（OpenAI 兼容格式）

### 即梦（Seedream）Volcengine 图生图与文生图

- 分镜 **图生图**（`storyboard_image`）与 **文生图**（`image`）中，凡使用 `doubao-seedream-*` 系列模型，均走 `imageClient.js` 的 **Volcengine 图片协议**分支；配置项 **`api_protocol`** 须为 `volcengine`，`base_url`、`endpoint` 需与所用中转站文档一致，勿与纯 OpenAI 兼容条目混用。
- 中转商界面若标注为「即梦 2.0」等名称，请以对方返回的 **模型 ID** 为准（示例中常见 `doubao-seedream-4-0-250828`、`doubao-seedream-4-5-251128` 等），与 [各大平台中转站示例配置](#各大平台中转站示例配置) 中的 JSON 对照修改即可。
- **Seedream 4.5+** 对输出像素有下限（约 1920×1920 等效面积）；`imageClient.js` 会在请求前对过小尺寸做等比放大（`fixSeedreamSize`）。若仍报错，请结合中转站错误信息检查模型与尺寸。

**图片尺寸：** 系统根据项目 `metadata.aspect_ratio` 自动计算符合服务商最低要求的分辨率（最低 3,686,400 像素）。

### 视频生成流程

1. 前端调用 `POST /videos` → 创建 `video_generations` 记录
2. `videoService.js` 异步处理：调用视频 API → 轮询任务状态 → 下载到本地
3. 前端轮询 `GET /videos/:id` 直到 status=completed

**视频参数（Volcengine 经典 Seedance 单链路，示例）：**
```json
{
  "model": "doubao-seedance-1-0-pro-250528",
  "content": [{ "type": "text", "text": "..." }],
  "ratio": "16:9",
  "duration": 5,
  "resolution": "720p",
  "seed": null,
  "camera_fixed": false,
  "watermark": false
}
```

**火山方舟 Seedance 2.0 · 全能 / 多参考图（`volcengine_omni`）：**

- 在前端「AI 配置 → 视频生成」选择接口规范 **`volcengine_omni`**，厂商仍为火山引擎；**Base URL** 一般为 `https://ark.cn-beijing.volces.com/api/v3`；**模型**填控制台接入点（如 `doubao-seedance-2-0-260128`、`doubao-seedance-2-0-fast-260128`）。
- 与制作页分镜 **「全能模式」** 配合：首条为文本提示，其余参考图为场景/角色/道具/分镜主图等，每张 **`role: reference_image`**；方舟侧最多取 **9** 张。
- **Seedance 2.x** 请求时长会在后端吸附到 **4–15 秒**；默认走 `POST /v1/videos/generations`（可用配置 **Endpoint** 覆盖）。实现见 `videoClient.js`（`volcengine_omni` 分支）。

**可灵 Omni（`kling_omni`）** 同样支持分镜全能模式的多图参考与片段描述-only 提交逻辑，配置方式见前端 AI 配置页说明。

### 提示词国际化

`promptI18n.js` 管理所有提示词模板，支持中文（zh）和英文（en）两套模板，通过 `config.yaml` 中的 `language` 字段切换。

---

## 开发说明

### 添加新的 AI 服务商

1. 在 `imageClient.js` 或 `videoClient.js` 中添加新的 `provider` 分支
2. 实现对应的 API 调用逻辑
3. 在前端「AI 配置」页面新增服务商选项（`AIConfigContent.vue`）

### Jimeng AI API（自建即梦 OpenAI 兼容服务）

若使用「视频 → 厂商 **Jimeng AI API（自建即梦免费 API）**」：

1. 自行克隆并启动第三方即梦逆向/兼容服务项目（如 `jimeng-free-api-all`），按对方 README 安装依赖与 Chromium，默认监听端口以对方文档为准（常见 `8000`）。
2. 在本系统 AI 配置中填写 **Base URL**（如 `http://127.0.0.1:8000`）、**API Key** 填即梦 **Session**（多个用英文逗号分隔）。
3. 后端会请求对方 `POST /v1/videos/generations`（可用配置项 **Endpoint** 覆盖路径），Seedance 多图场景需分镜带参考图；返回为同步 `data[0].url`，无需轮询。

字段级对照可参考仓库 [`各大平台中转站配置/调用本地反向代理即梦freeapi的配置.png`](https://github.com/xuanyustudio/LocalMiniDrama/blob/main/%E5%90%84%E5%A4%A7%E5%B9%B3%E5%8F%B0%E4%B8%AD%E8%BD%AC%E7%AB%99%E9%85%8D%E7%BD%AE/%E8%B0%83%E7%94%A8%E6%9C%AC%E5%9C%B0%E5%8F%8D%E5%90%91%E4%BB%A3%E7%90%86%E5%8D%B3%E6%A2%A6freeapi%E7%9A%84%E9%85%8D%E7%BD%AE.png)。该路径为 **OpenAI 兼容的本地即梦代理（视频为主）**，与上文「即梦（Seedream）Volcengine 图生图与文生图」所描述的 **`volcengine` 直连中转图 API** 不是同一套协议，请按实际接入分别配置、勿混用字段。

### 添加新的数据库字段

1. 在 `migrate.js` 的 `ensureColumns()` 中添加新字段定义（类型 + 默认值）
2. 更新对应的 Service 文件中的 INSERT/SELECT 语句

### 日志级别

通过环境变量 `LOG_LEVEL` 控制：
```bash
LOG_LEVEL=debug npm run dev   # 详细日志
LOG_LEVEL=info  npm start     # 生产日志（默认）
```

---

[← 返回项目主页](../README.md)
