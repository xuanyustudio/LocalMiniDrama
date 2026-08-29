# Grok Imagine Video 1.5 增量改造计划

阶段 0 调研结论。不改业务功能，只作为后续阶段的实现依据。

官方文档（2026-08）：

- [Video Generation](https://docs.x.ai/developers/model-capabilities/video/generation)
- [Image-to-Video](https://docs.x.ai/developers/model-capabilities/video/image-to-video)
- [Reference-to-Video](https://docs.x.ai/developers/model-capabilities/video/reference-to-video)
- [REST Videos](https://docs.x.ai/developers/rest-api-reference/inference/videos)

## 1. 现有架构

版本 `1.2.8`。三个子项目，无 monorepo 工具。

```
LocalMiniDrama/
├── backend-node/     Express + SQLite + FFmpeg
├── frontweb/         Vue 3 + Vite + Element Plus + Pinia
├── desktop/          Electron 28 + electron-builder
├── docs/
└── example_drama/
```

| 层 | 技术 | 入口 |
|----|------|------|
| 前端 | Vue 3、Vite 5、Element Plus、Pinia、@vue-flow/core | `frontweb/`，开发端口 3013 |
| 后端 | Node.js ≥18、Express 4、better-sqlite3 | `backend-node/src/server.js`，端口 5679 |
| 桌面 | Electron 28 | `desktop/main.js`，开发时复制 backend 到 `desktop/backend-app` |
| 存储 | SQLite `./data/drama_generator.db` + 本地文件 `./data/storage/` | 启动时 `migrate.js` 补列 |
| 合成 | 捆绑 `backend-node/tools/ffmpeg/ffmpeg.exe` | `videoMergeService.js` |

前端 Vite 代理：`/api`、`/static` → `http://127.0.0.1:5679`。

## 2. 完整数据流

```
用户（制作页 FilmCreate / 画布 DramaCanvas）
  │
  ├─ 故事     POST /api/v1/generation/story
  │             storyGenerationService → aiClient（文本供应商）
  │             → dramas / episodes.script_content
  │
  ├─ 分镜     POST /api/v1/episodes/:id/storyboards
  │             episodeStoryboardService → storyboards
  │
  ├─ 角色/场景/道具图
  │             POST /images 或 characters/scenes/props generate
  │             imageService → imageClient → 本地下载
  │             → image_generations / characters / scenes / props
  │
  ├─ 首帧确认  分镜图 / first_frame_url（image_generations.frame_type）
  │
  ├─ 视频     POST /api/v1/videos
  │             routes/videos.js
  │               创建 async_tasks + video_generations
  │               setImmediate(processVideoGeneration)
  │             videoService.processVideoGeneration
  │               videoClient.callVideoApi（按 api_protocol 分流）
  │               若返回 task_id：pollVideoTask
  │               成功：downloadVideoToLocal + 可选 ffmpeg 画幅归一化
  │               写回 video_generations.local_path、storyboards.video_url
  │
  ├─ 筛选     前端按 storyboard_id 列出 video_generations 历史
  │             用户点选后 PUT storyboards.video_url
  │
  ├─ TTS      POST /api/v1/audio/extract
  │             ttsService → storyboards.audio_local_path / narration_audio_local_path
  │
  └─ 合成     POST /api/v1/video-merges
                videoMergeService.processVideoMerge
                  ffmpeg concat → merged/*.mp4
                  可选 mergedEpisodePostProcess（对白轨 / 旁白 SRT / 水印）
                  更新 episodes.video_url
```

### 2.1 视频任务持久化

| 表 | 作用 |
|----|------|
| `video_generations` | 单镜头生成记录：prompt、model、duration、aspect_ratio、resolution、image_url、first_frame_url、last_frame_url、reference_image_urls、provider_task_id、local_path、status |
| `async_tasks` | 前端轮询进度：`task_id` 挂在 `video_generations.task_id` |
| `storyboards` | 当前选用的主视频 `video_url` / `local_path` |
| `video_merges` | 整集合成任务 |

重启恢复（`app.js` 启动时）：

- `taskService.failOrphanedAsyncTasksOnStartup`：所有 pending/processing 的 `async_tasks` 标失败。
- `videoService.resumeProcessingVideoGenerations`：有 `provider_task_id` 的 processing 视频继续轮询；没有则标失败。

缺口：`async_tasks` 被一律标失败，前端可能显示任务中断，即使底层 `video_generations` 仍在恢复轮询。需要在后续阶段把 Grok 任务的 `async_tasks` 与 `provider_task_id` 对齐，而不是启动时全部失败。

### 2.2 本地目录

工程文件按 `storageLayout`：

```
data/storage/
  projects/{id}_{日期}_{剧名}/
    videos/vg_{id}_{uuid}.mp4
    videos/merged/merged_{ts}.mp4
    images / characters / scenes / ...
  library/...
```

远程临时 URL（xAI 为 `https://vidgen.x.ai/...`）必须在成功后立刻下载。现有 `downloadVideoToLocal` 已做这件事。

### 2.3 并发

- 全局设置 `pipeline_concurrency` / `pipeline_video_concurrency`（默认 3），前端流水线使用。
- 后端 `activeVideoPolls` 只防同一 `videoGenId` 重复 poll，**不是**全局限流。
- `POST /videos` 每次 `setImmediate` 立刻开跑，无队列。

## 3. 现有 xAI 适配

已有代码，不是从零接入：

| 位置 | 现状 |
|------|------|
| `videoClient.inferVideoProtocol` | `xai` / `grok` → `xai` |
| `resolveVideoProtocol` | `api.x.ai` 或模型名含 `grok-imagine` / `grok.*video` 时自动选 `xai` |
| `callXaiVideoApi` | `POST {base}/v1/videos/generations` |
| `buildQueryUrl` | `GET /v1/videos/{taskId}` |
| 前端 AI 配置 | 供应商 `xai`，默认 Base URL `https://api.x.ai`，默认模型 **`grok-imagine-video`**（不是 1.5） |
| Key | 走 `ai_service_configs.api_key`，前端可填 |

轮询走通用分支：`status=done` 可识别；`data.video.url` 可被 `pickProxyVideoUrl` 解析。`expired` **没有**单独处理（`isPollTaskFailed` 不含 `expired`），会一直等到超时。

## 4. 与官方 Imagine Video 1.5 的差异

官方异步契约：

```
POST https://api.x.ai/v1/videos/generations
Authorization: Bearer $XAI_API_KEY
→ { "request_id": "..." }

GET https://api.x.ai/v1/videos/{request_id}
→ status: pending | done | failed | expired
→ done: { video: { url, duration, respect_moderation } }
```

| 项 | 官方 1.5 | 当前代码 | 影响 |
|----|---------|----------|------|
| 默认模型 | `grok-imagine-video-1.5` | `grok-imagine-video` | 未用 1.5 |
| `isXaiGrokVideoStyleModel` | 1.5 请求体是 `resolution` + `image` / `reference_images` | `/grok/.test && /video/.test` 为真时改走 `images[]` + `size: "720P"` | **`grok-imagine-video` 与 `grok-imagine-video-1.5` 都会误判为 grok-video-3 体**，官方字段发错 |
| `generate_audio` | 默认真；漫剧应 `false` | 未发送 | 生成带音轨，和后续 TTS 叠音 |
| 草稿默认 | 目标 720p / 9:16 / 6s | 时长默认 8；前端分辨率默认 **480p**；`config.yaml` 默认画幅 **16:9** | 与漫剧目标不一致 |
| 1080p | T2V / I2V 支持；R2V 上限 720p | `resolveXaiVideoResolution` 只认 480/720，1080 会落到 720p | 最终镜头无法 1080p |
| `image` + `reference_images` | 同时提交 → 400 | 适配器允许主图 + 额外参考图同时存在；制作页经典模式常把首帧同时放进 `image_url` 和 `reference_image_urls` | 官方会拒；或被 `hasOmniRefs` 清掉 `image_url` 后变成 R2V，**首帧不再锁定** |
| R2V 张数 | 最多 7 | `mergeXaiVideoImageUrls` 最多 10；路由写入最多 10 | 超额 400 |
| 首帧来源 | I2V 用 `image.url` | `callXaiVideoApi` 不读 `first_frame_url`；有参考图时 `processVideoGeneration` 还把 `image_url` 置空 | 首帧确认链路对 Grok 失效 |
| 轮询状态 | `pending` / `done` / `failed` / `expired` | 通用 poll 不把 `expired` 当终态 | 过期任务空转至超时 |
| 失败体 | `{ status:"failed", error:{ code, message } }` | 通用 `data.error` 会当失败，但 `expired` 不会 | 错误分类不完整 |
| Key | 环境变量 `XAI_API_KEY` | SQLite + 前端表单 | 违反 Key 规则 |
| 日志 | 不得打印 Key | `logger` 直接 `JSON.stringify` 对象；xAI 请求用 Bearer header，body 日志不含 Key，但配置测试/错误路径可能带 `api_key` | 需统一脱敏 |
| 导出包 | 不得含 Key | `dramaExportService` 只导出剧本与媒体，不含 `ai_service_configs` | 目前安全，后续勿把 env Key 写入 ZIP |
| Git | 不得提交 Key | `.gitignore` 未覆盖 `.env`；`config.yaml` 在仓库内（当前无 Key）；Key 主要在本地 SQLite | 需补 `.env` / `.env.local` ignore |
| 队列 | 目标：并发限制、失败重试、重启恢复 | 无真正队列；重启恢复有半套；重试靠前端再点「生成」或 `resume-poll` | 阶段 4 补齐 |
| Mock | 测试优先 Mock | 无 xAI 单测；`callXaiVideoApi` 未 export | 阶段 1 先补 Mock |

官方还支持 video edit / extend、`reference_audios`、Files API `file_id`。本计划**不纳入**首期，以免扩大范围。

## 5. 推荐增量切面（按阶段，不并行）

原则：先把 1.5 请求体与轮询在 Mock 下做对，再接 Key 隔离，再接队列，最后改默认工作流与 UI。现有 Volcengine / Kling / Agnes / Gemini / Vidu / MiniMax 路径一律不动。

### 适配层（videoClient）

- 修正 `isXaiGrokVideoStyleModel`：仅中转 `grok-video-*` 走 `images/size`；`grok-imagine-video*` 走官方 Imagine 体。
- 显式三种 mode，互斥校验。
- 默认模型 `grok-imagine-video-1.5`。
- 发送 `generate_audio: false`。
- 允许 `resolution: 1080p`，R2V 强制 ≤720p。
- 草稿缺省：duration 6、aspect_ratio 9:16、resolution 720p（仅 xAI 路径，不改其他供应商默认）。
- 轮询识别 `expired`；`done` 时读 `video.url`，`respect_moderation === false` 当失败。
- I2V 优先 `first_frame_url` → `image.url`；有 `image` 时不得带 `reference_images`。

### Key

- 后端 `process.env.XAI_API_KEY`；xAI 协议忽略前端写入的 Key。
- 日志红acted。
- `.gitignore` 增加 `.env`、`.env.*`。
- AI 配置页：xAI 只显示「使用环境变量」，不出现输入框。

### 队列

- 在现有 `video_generations` + `async_tasks` 上加排队状态与 worker，不要新框架。
- 尊重 `pipeline_video_concurrency`。
- 启动恢复时不要把仍有 `provider_task_id` 的 Grok 任务对应 `async_tasks` 标死。
- 失败可重试（新 `request_id`）与 `resume-poll`（复用 `request_id`）分开。

### 工作流 / UI

- 漫剧默认 9:16。
- 分辨率：草稿 720p，最终可选 1080p；R2V 禁用 1080p。
- 首帧确认后再 I2V。
- 历史版本与单镜重生已有，接到 Grok 成功路径即可。

## 6. 测试策略

未经允许不打真实 `api.x.ai`。

- 用 `http.Server` / 注入 fetch mock 覆盖：T2V / I2V / R2V 请求体、互斥 400、R2V 分辨率封顶、poll 四态、成功后下载、Key 不进日志。
- 回归现有 `test/*.test.js`（Agnes、MiniMax H3、resume-poll 等）。
- 前端：模型列表含 `grok-imagine-video-1.5`；xAI 配置不收集 Key。

## 7. 阶段 0 基线（2026-08-29）

环境：Windows，Node `v24.16.0`，npm `11.13.0`。仓库路径 `C:\Users\a4113\LocalMiniDrama`。未调用真实 xAI API。未跑 Electron `dist`。

| 命令 | 结果 |
|------|------|
| `backend-node` `npm install` | 成功（174 packages，约 50s）。警告：未知 npmrc `better_sqlite3_binary_host_mirror`；`multer@1.4.5-lts.2` deprecated |
| `frontweb` `npm install` | 成功（91 packages，13s） |
| `backend-node` `npm run migrate` | 成功。`01_init` 及后续 SQL 执行；部分 `ADD COLUMN` skip already exists；`ensureColumns` 为 `storyboards` / `video_generations` 等补列。库文件 `backend-node/data/drama_generator.db` |
| `cd backend-node && node --test test/*.test.js` | **60 pass / 0 fail**，约 4.7s |
| `cd frontweb && node --test test/*.test.js` | **10 pass / 0 fail**，约 93ms |
| `cd frontweb && npm run build` | 成功，Vite 5.4.21，8.41s。警告：部分 chunk > 500 kB（既有问题，非本阶段引入） |
| `desktop` `npm install` / `electron-builder` | **未跑**。源码开发基线不需要打包 exe；后续若验收桌面端再单独跑 |

现有测试覆盖 Agnes、MiniMax H3、resume-poll、task 重启失败、素材库去重等，**没有** xAI / Grok Imagine 1.5 用例。阶段 1 必须先补 Mock。

捆绑 FFmpeg：`backend-node/tools/ffmpeg/ffmpeg.exe` 存在。

## 8. 非目标（本改造不做）

- 删除或重写现有供应商。
- 引入 TypeScript / 新队列中间件 / 云存储。
- 官方 video edit / extend / 自定义 reference audio 文件。
- 自动 git commit。
