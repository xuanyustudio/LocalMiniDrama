# PROJECT_STATUS.md

交接日期：2026-08-29  
产品版本基线：LocalMiniDrama **1.2.8**  
工作分支：`feat/grok-first`  
上游仓库：https://github.com/xuanyustudio/LocalMiniDrama  
Fork：https://github.com/zhjbddd/LocalMiniDrama  
PR：https://github.com/xuanyustudio/LocalMiniDrama/pull/43

本文件用于下一任继续执行，不要从零重写。详细计划见：

- `AGENTS.md` — 目标与约束
- `docs/GROK_IMPLEMENTATION_PLAN.md` — 架构与官方接口差异
- `docs/GROK_TASKS.md` — 阶段拆分（0–6 已完成）

---

## 当前目标

在**保留现有架构和全部 AI 供应商**的前提下，把 LocalMiniDrama 增量改造成以 **xAI Grok Imagine Video 1.5** 为主要视频生成器的本地 AI 漫剧生产系统。

目标工作流：

故事 → 分集剧本 → 结构化分镜 → 人物/场景素材 → 首帧确认 → Grok 视频生成 → 镜头筛选 → TTS/字幕 → FFmpeg 合成 → 9:16 MP4 导出。

技术栈不变：Vue 3 + Node.js/Express + SQLite + Electron + FFmpeg。纯 JavaScript。

Grok 目标态：

| 项 | 值 |
|----|----|
| Provider | `xai` |
| Base URL | `https://api.x.ai` |
| 模型 | `grok-imagine-video-1.5` |
| 草稿默认 | 720p、9:16、6 秒、`generate_audio=false` |
| 最终镜头 | T2V/I2V 可选 1080p；R2V 最高 720p |

三种模式互斥：T2V=`prompt`；I2V=`prompt`+`image`；R2V=`prompt`+`reference_images`。

`XAI_API_KEY` 只由后端读环境变量（或启动时从本机 `.env` 填入 `process.env`）。禁止写入前端、日志、导出包、Git。

---

## 已完成内容

`docs/GROK_TASKS.md` 阶段 0–6 已落地，另加桌面端本机 `.env` 加载。

| 阶段 | Commit | 内容 |
|------|--------|------|
| 0 调研 | 含在 `607ff51` | `AGENTS.md`、`docs/GROK_IMPLEMENTATION_PLAN.md`、`docs/GROK_TASKS.md` |
| 1 适配器 | `607ff51` | Imagine 1.5 请求体、T2V/I2V/R2V、Mock poll |
| 2 任务/下载 | `c91e297` | `request_id`、本地下载、过期/审核失败 |
| 3 Key 隔离 | `73e42ab` | 环境变量、日志脱敏、AI 配置页无 Key 框 |
| 4 队列 | `a81ba3d` | `queued`、并发、重启恢复、有限重试 |
| 5 UI 默认 | `d7393b7` | 新建项目 9:16/720p/6s，制作页三种模式 |
| 6 文档 | `7b499f4` | README / changelog / quickstart |
| 桌面 Key | `1f442ee` | 用户目录 `.env` → `process.env.XAI_API_KEY` |

功能要点：

- 官方异步：`POST /v1/videos/generations` → 存 `provider_task_id`（官方 `request_id`）→ `GET /v1/videos/{id}` → `pending/done/failed/expired`
- 成功立即下载 `vidgen.x.ai` 临时 URL；下载失败则任务失败（不以远端 URL 当完成）
- 单镜重生插入新的 `video_generations` 行；`resume-poll` 复用已有 `request_id`
- Seedance / Kling / Agnes / Gemini / Vidu / MiniMax 仍在

---

## 关键技术决策

1. **增量适配，不重写。** 新逻辑挂在现有 `videoClient` 的 `xai` 协议上，其它供应商路径不动。
2. **`grok-imagine-*` 与 `grok-video-3` 分体。** 旧代码用 `/grok/ && /video/` 判断，会把 `grok-imagine-video-1.5` 误判成中转体 `images[]` + `size: "720P"`。现规则：名字含 `imagine` 走官方 Imagine 体。
3. **互斥在适配层做。** 首帧 URL 与 `reference_urls` 里同一张图视为 I2V；只有**额外不同图**才拒绝。这样制作页经典「首帧也放进 refs」仍能锁帧。
4. **Key 不进 SQLite。** xAI 创建/更新配置时把 `api_key` 写成空串；请求头只用 `process.env.XAI_API_KEY`。进程环境为空时，才从本机 `.env` 填入环境变量（桌面：`%APPDATA%\localminidrama-desktop\.env`）。
5. **队列不引入 Redis/Bull。** 用 `video_generations.status=queued` + `retry_count` + `pipeline_video_concurrency`。启动时：有 `request_id` 的 processing 继续 poll；没有的重新入队。对应 `async_tasks` 不一律标失败。
6. **不改用户已有 YAML 画幅。** `config.yaml` 里 `default_video_ratio` 仍可能是 `16:9`；**新项目**以界面 metadata 默认 9:16 为准。
7. **测试一律 Mock。** 未经允许不打真实 `api.x.ai`。
8. **推送走 fork。** 本机 GitHub 身份是 `zhjbddd`，对 `xuanyustudio/LocalMiniDrama` 无写权限。代码推到 `zhjbddd/LocalMiniDrama`，再向上游开 PR。

---

## 修改过的核心文件

### 后端

| 文件 | 作用 |
|------|------|
| `backend-node/src/services/videoClient.js` | Grok 1.5 适配、poll 四态、`XAI_API_KEY` |
| `backend-node/src/services/videoService.js` | 下载、失败态、队列 pump、重试、xAI 保留首帧 |
| `backend-node/src/routes/videos.js` | `generate_audio`、创建时 `queued` + `enqueueVideoGeneration` |
| `backend-node/src/db/migrate.js` | `generate_audio`、`retry_count` |
| `backend-node/src/services/taskService.js` | 重启时保留仍在跑的视频 `async_tasks` |
| `backend-node/src/services/aiConfigService.js` | xAI 不入库 Key |
| `backend-node/src/routes/aiConfig.js` | xAI 创建配置不要求 `api_key` |
| `backend-node/src/logger.js` | Key / Bearer 脱敏 |
| `backend-node/src/config/loadXaiEnv.js` | 从本机 `.env` 填环境变量 |
| `backend-node/src/app.js` | 启动时加载 Key；恢复视频任务 |

### 前端 / 桌面

| 文件 | 作用 |
|------|------|
| `frontweb/src/utils/grokVideoMode.js` | 模式互斥、R2V 降 720p、默认 9:16/720p/6s |
| `frontweb/src/views/FilmCreate.vue` | 生成模式选择、1080p 在 R2V 禁用 |
| `frontweb/src/views/FilmList.vue` | 新建项目默认 9:16 |
| `frontweb/src/stores/film.js` | 默认分辨率 720p |
| `frontweb/src/utils/canvasWorkflow.js` | 画布默认画幅/分辨率 |
| `frontweb/src/composables/useCanvasWorkflowRunner.js` | 仅 xAI 走互斥整理 |
| `frontweb/src/components/AIConfigContent.vue` | 模型列表 1.5；无 Key 输入 |
| `desktop/main.js` | 从 userData `.env` 加载 Key |

### 测试 / 文档

- `backend-node/test/xaiVideo.test.js`
- `backend-node/test/xaiVideoService.test.js`
- `backend-node/test/xaiKeyIsolation.test.js`
- `backend-node/test/xaiVideoQueue.test.js`
- `backend-node/test/videoResumePoll.test.js`（扩展）
- `frontweb/test/grokVideoMode.test.js`
- `README.md`、`CHANGELOG.md`、`docs/configuration.md`、`docs/quickstart.md`、`.env.example`、`.gitignore`

---

## 测试与验证结果

均在 **Mock** 下完成，未调用真实 xAI API。

| 命令 | 最近结果 |
|------|----------|
| `cd backend-node && node --test test/*.test.js` | **101 pass / 0 fail** |
| `cd frontweb && node --test test/*.test.js` | **18 pass / 0 fail** |
| `cd frontweb && npm run build` | 成功（既有 chunk >500kB 警告） |
| 前端 dist 搜索真实 `xai-…` Key | 无；仅有环境变量名 `XAI_API_KEY` 文案 |

基线环境：Windows，Node v24.16.0，npm 11.13.0。仓库路径 `C:\Users\a4113\LocalMiniDrama`。

---

## 已知问题

1. **上游 push 403。** `git push origin feat/grok-first` 会报 `Permission to xuanyustudio/LocalMiniDrama.git denied to zhjbddd`。正确推送：`git push zhjbddd feat/grok-first`。PR 已开：#43。
2. **Git LFS 配额用尽。** 工作区里 `example_drama/衣服设计天才302.zip` 和 `项目截图/1.mp4` 等显示删除，`git restore` 失败：`This repository exceeded its LFS budget`。与 Grok 改造无关，**不要提交这些删除**。
3. **经典首帧+尾帧对 Grok 会互斥失败。** 制作页若把**不同的**尾帧也放进 `reference_image_urls`，适配层按官方规则拒绝（`image` 与额外 refs 不能同时有）。仅首帧、或 refs 与首帧同一 URL，仍走 I2V。其它供应商画布路径 `applyExclusive: false`，不受影响。
4. **YAML 默认画幅仍可能是 16:9。** 不要为了漫剧去改用户已有 `config.yaml`。新项目看 UI metadata。
5. **桌面 exe 读 Key。** 系统环境变量需重启软件；或把 `XAI_API_KEY=...` 写入 `%APPDATA%\localminidrama-desktop\.env`。SuperGrok 网页订阅不是 API Key。
6. **Electron 开发必须用 `desktop/backend-app`。** `desktop/main.js` 注释：不能直接 require `backend-node` 的 native 模块（ABI）。改后端后需跑 `desktop` 的 `copy-backend` / `npm start` 才会进打包副本。
7. **真实 Grok 生成未在本机联调。** 只有 Mock。下一阶段若要打真实 API，需明确授权并准备配额。

---

## 尝试过但失败的方案

| 尝试 | 结果 | 结论 |
|------|------|------|
| `git push origin feat/grok-first` 推到 `xuanyustudio/LocalMiniDrama` | 403，账号是 `zhjbddd` | 推 fork `zhjbddd`，再开上游 PR |
| GitHub MCP `fork_repository` | 403 Resource not accessible by integration | 改用本机 `gh repo fork`（已成功） |
| `git restore` 示例 zip / 截图 mp4 | LFS budget exceeded | 忽略，勿提交这些删除 |
| 旧判定 `isXaiGrokVideoStyleModel = /grok/ && /video/` | `grok-imagine-video-1.5` 误走 `images[]`+`size` | 含 `imagine` 的模型走官方体 |
| 有参考图就清空 `image_url`/`first_frame_url`（其它 Omni 供应商逻辑） | Grok 经典首帧变成 R2V，不锁帧 | xAI 协议不清空首帧，由适配层互斥 |
| 把 xAI Key 和其它供应商一样存 `ai_service_configs` | 违反「Key 不进前端/库/导出/Git」 | 只读环境变量 |

---

## 下一步开发顺序

按优先级做，每次仍只做一个可验收切片；未授权不打真实 xAI。

1. **跟进 PR #43**  
   用有权限的账号在 GitHub 上审、补 CI、合并。本地更新：`git push zhjbddd feat/grok-first`。不要 `git push origin`，除非改用 `xuanyustudio` 登录（`gh auth login`）。

2. **真实 API 冒烟（需明确允许 + `XAI_API_KEY`）**  
   各跑一条 T2V / I2V / R2V：确认 `request_id`、poll、本地下载、9:16 文件。覆盖 `expired`、缺 Key、R2V+1080p 降级。不要把 Key 写进仓库或 issue。

3. **Grok 首帧+尾帧策略**  
   官方无尾帧字段。可选：有尾帧时忽略尾帧并警告后走 I2V，或 UI 在 xAI 下禁用尾帧。当前是硬拒绝混用。

4. **Electron 打包冒烟**  
   `desktop` 里 `copy-backend` 后确认 `loadXaiEnv.js` 进了 `backend-app`。用 userData `.env` 启动 exe，确认能生视频且日志无 Key。

5. **队列产品化（可选）**  
   前端展示 `queued`；设置页是否暴露重试次数 `pipeline_video_retry`（后端已读，UI 未必有）。

6. **LFS 资产（可选、与 Grok 无关）**  
   上游补 LFS 配额后再 restore 示例工程/演示 mp4。当前工作区删除不要提交。

7. **不要做的**  
   不要删 Seedance/Kling/Agnes；不要把 Key 写入 `config.yaml`；不要引入 TS/Redis；不要从零重写视频管线。

---

## 本地怎么跑

```powershell
cd C:\Users\a4113\LocalMiniDrama
$env:XAI_API_KEY = "xai-..."   # 或写到 %APPDATA%\localminidrama-desktop\.env

cd backend-node
npm install
npm run migrate
npm run dev                    # :5679

# 另开终端
cd C:\Users\a4113\LocalMiniDrama\frontweb
npm install
npm run dev                    # :3013，代理 /api /static
```

测试：

```powershell
cd backend-node; node --test test/*.test.js
cd frontweb; node --test test/*.test.js; npm run build
```

AI 配置：服务商 **xAI Grok Imagine**，模型 `grok-imagine-video-1.5`，页面不填 Key。
