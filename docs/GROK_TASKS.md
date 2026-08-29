# Grok 改造任务（可独立验收）

每次只做一阶段。阶段结束必须：列出改动文件、跑相关测试/构建、汇报结果、等人确认后再进入下一阶段。未经允许不调用真实 xAI API。不自动 git commit。

---

## 阶段 0 — 调研与基线（本阶段）

验收：

- [x] 阅读 README、前后端 `package.json`、数据库初始化、视频服务、路由、FFmpeg
- [x] 梳理数据流和目录结构
- [x] 对照官方 Imagine Video 1.5 接口差异
- [x] 创建/更新 `AGENTS.md`
- [x] 创建 `docs/GROK_IMPLEMENTATION_PLAN.md`
- [x] 创建本文件
- [x] 运行现有安装、测试、构建并记录基线
- [x] 停止，不开始阶段 1

不改业务代码。

---

## 阶段 1 — xAI 1.5 适配层 + Mock 测试

目标：只改 `videoClient` 的 xAI 分支，让请求体/轮询与官方 1.5 一致。其他供应商零行为变化。

计划修改文件（实施时以当时列表为准）：

- `backend-node/src/services/videoClient.js`
- `backend-node/test/xaiVideo.test.js`（新建）
- 必要时 export 内部 helper，避免为测而大拆文件

验收：

- [x] Mock `POST /v1/videos/generations`：T2V 只有 `prompt`；I2V 有 `image` 无 `reference_images`；R2V 有 `reference_images` 无 `image`
- [x] 默认模型 `grok-imagine-video-1.5`，默认 `generate_audio=false`，草稿缺省 720p / 9:16 / 6s（仅 xAI 路径）
- [x] `grok-imagine-video-1.5` **不会** 再走 `images[]` + `size: "720P"`
- [x] R2V 选 1080p 时降为 720p 或拒绝
- [x] `image` + `reference_images` 同时出现时本地拒绝，不发请求
- [x] Mock poll：`pending` 继续、`done` 取 `video.url`、`failed` / `expired` 结束
- [x] `node --test test/*.test.js` 全绿，含原 Agnes / MiniMax / resume-poll

禁止：真实网络、改 UI、改 Key 存储。

---

## 阶段 2 — 任务状态机接到 1.5 轮询

目标：`videoService` / `routes/videos.js` 正确保存 `request_id`，成功立即本地下载，首帧走 I2V。

计划修改文件：

- `backend-node/src/services/videoService.js`
- `backend-node/src/routes/videos.js`
- `backend-node/test/videoResumePoll.test.js`（扩展）
- `backend-node/test/xaiVideo.test.js` 或新建 `xaiVideoService.test.js`

验收：

- [x] `provider_task_id` 存官方 `request_id`
- [x] I2V：`first_frame_url` / 分镜首帧 → `image`，不附带 `reference_images`
- [x] R2V：仅 `reference_image_urls`，无 `image`
- [x] `done` 后 `downloadVideoToLocal`，`local_path` 有值；远端 URL 不作为长期依赖
- [x] `expired` 记失败，文案可区分
- [x] `respect_moderation === false` 记失败
- [x] 单镜再生成仍插入新 `video_generations` 行（历史保留）
- [x] 现有 `resume-poll` 对 xAI `request_id` 仍可用
- [x] 测试全绿

禁止：真实 API、改前端默认画幅。

---

## 阶段 3 — `XAI_API_KEY` 隔离

目标：xAI Key 只来自环境变量。

计划修改文件：

- `backend-node/src/services/videoClient.js`（xAI 鉴权）
- `backend-node/src/services/aiConfigService.js`（必要时）
- `backend-node/src/logger.js`（脱敏）
- `backend-node/src/routes/aiConfig.js`
- `frontweb/src/components/AIConfigContent.vue`
- `.gitignore`（`.env`、`.env.*`）
- 可选：`backend-node/src/config/index.js` 只读 env，不写文件
- `backend-node/test/` Key 脱敏与「不读前端 Key」用例

验收：

- [x] xAI 请求 `Authorization: Bearer` 来自 `process.env.XAI_API_KEY`
- [x] 前端 xAI 配置无 Key 输入，也不把 Key 发给后端
- [x] 日志 JSON 不含 Key 明文
- [x] `dramaExportService` 导出包不含 Key（回归）
- [x] `.gitignore` 覆盖 `.env`
- [x] 缺 Key 时返回明确错误，不 fallback 到 SQLite 里的用户 Key
- [x] 其他供应商仍用 `ai_service_configs.api_key`
- [x] 测试全绿；`frontweb` 构建通过

禁止：把 Key 写入 `config.yaml`、SQLite、前端 store。

---

## 阶段 4 — 队列、并发、重启恢复、重试

目标：在现有表上做持久化队列，不引入 Bull/Redis。

计划修改文件：

- `backend-node/src/services/videoService.js`
- `backend-node/src/services/taskService.js`
- `backend-node/src/app.js`（启动恢复）
- `backend-node/src/routes/settings.js`（沿用 `pipeline_video_concurrency`）
- 可能的迁移 SQL（若需 `retry_count` / `queued` 状态）
- `backend-node/test/` 队列与恢复用例

验收：

- [x] 超出并发的任务保持 queued，不立刻 POST 上游
- [x] 并发上限读 `pipeline_video_concurrency`
- [x] 进程重启：有 `request_id` 的 processing 恢复 poll；queued 重新入队；无 `request_id` 的 processing 可重试或明确失败
- [x] 有 `request_id` 的任务，对应 `async_tasks` **不得**再被启动逻辑一律标失败
- [x] 失败可配置有限次重试（新 request）；用户「继续查询」不新开任务
- [x] 测试全绿

禁止：真实 API、改分镜 UI 布局。

---

## 阶段 5 — 漫剧工作流默认值与 UI

目标：默认走 Grok 1.5 漫剧参数，三种模式可选，不拆掉其他供应商。

计划修改文件：

- `frontweb/src/components/AIConfigContent.vue`（模型列表 `grok-imagine-video-1.5`）
- `frontweb/src/views/FilmCreate.vue`
- `frontweb/src/stores/film.js`（默认分辨率 720p）
- `frontweb/src/composables/useCanvasWorkflowRunner.js`
- `frontweb/src/utils/canvasWorkflow.js`
- `backend-node/configs/config.yaml` 的默认画幅仅作文档说明，避免强行改用户已有工程
- `docs/configuration.md`（xAI 配置段）
- 前端测试

验收：

- [x] 新建漫剧默认 9:16；草稿默认 720p / 6 秒
- [x] 最终镜头可选 1080p；当前模式为 R2V 时 1080p 不可选
- [x] 三种模式在制作页可区分；互斥规则前后端一致
- [x] 首帧确认后默认 I2V
- [x] 历史镜头条带 + 单镜重生仍可用
- [x] 合成仍是 FFmpeg 9:16 MP4
- [x] 前端测试 + `npm run build` 通过
- [x] 后端回归测试通过

禁止：删除 Seedance / Kling / Agnes 等配置项。

---

## 阶段 6 — 收尾与文档

目标：文档、安全检查、全量测试。

计划修改文件：

- `README.md`（AI 服务商表增加 xAI Grok Imagine Video 1.5）
- `docs/configuration.md`
- `docs/quickstart.md`（`XAI_API_KEY`）
- `CHANGELOG.md`
- 查漏：日志、导出、gitignore

验收：

- [x] README / 配置文档与真实行为一致
- [x] `backend-node` 全量测试绿
- [x] `frontweb` 测试绿 + build 成功
- [x] 全文搜索确认 xAI Key 不出现在前端包、导出逻辑、示例配置
- [x] 给出 diff 清单，等待人工提交

---

## 依赖关系

```
0 调研  →  1 适配层 Mock  →  2 任务/下载/首帧
                              ↓
                         3 Key 隔离
                              ↓
                         4 队列/恢复
                              ↓
                         5 UI/默认工作流
                              ↓
                         6 文档收尾
```

1 不依赖 UI。3 可在 2 之后立即做。4 依赖 2 的 `request_id` 语义。5 依赖 1–3，避免 UI 先发错误请求体。
