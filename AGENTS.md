# AGENTS.md

LocalMiniDrama（本地短剧助手）增量改造说明。本文件约束后续所有阶段的实现方式。

当前产品版本：`1.2.8`。不要从零重写，不要删除现有 AI 供应商。

## 项目目标

在保留现有架构和功能的基础上，把 LocalMiniDrama 增量改造成以 **xAI Grok Imagine Video 1.5** 为主要视频生成器的本地 AI 漫剧生产系统。

目标工作流：

故事 → 分集剧本 → 结构化分镜 → 人物/场景素材 → 首帧确认 → Grok 视频生成 → 镜头筛选 → TTS/字幕 → FFmpeg 合成 → 9:16 MP4 导出。

## 保留的技术栈

- Vue 3 前端（`frontweb/`，Vite，端口 3013）
- Node.js / Express 后端（`backend-node/`，端口 5679）
- SQLite（`better-sqlite3`，`backend-node/data/`）
- Electron 桌面端（`desktop/`）
- FFmpeg 视频合成（`backend-node/tools/ffmpeg/`）

纯 JavaScript，无 TypeScript。不要引入无关的新框架或大规模重命名。

## Grok 视频配置（目标态）

| 项 | 值 |
|----|----|
| Provider | `xai` |
| Base URL | `https://api.x.ai` |
| 默认模型 | `grok-imagine-video-1.5` |
| 草稿默认 | 720p、9:16、6 秒 |
| 最终镜头 | 可选 1080p |
| 默认音频 | `generate_audio=false` |

三种生成模式（同一请求只能选一种）：

1. 文生视频：`prompt`
2. 图生视频：`prompt` + `image`（锁定首帧）
3. 参考图视频：`prompt` + `reference_images`（不锁定首帧）

硬约束：

- `image` 与 `reference_images` 不能同时提交。
- 参考图视频最高只能选择 720p。
- 异步流程：`POST /v1/videos/generations` → 保存 `request_id` → `GET /v1/videos/{request_id}` 轮询 `pending` / `done` / `failed` / `expired` → 成功后立即把临时视频地址下载到本地。

任务队列与持久化目标：

- 失败重试
- 应用重启后恢复
- 并发数量限制
- 保留镜头历史版本
- 单镜头重新生成

## API Key 规则

`XAI_API_KEY` 只能由后端从环境变量读取。

禁止：

- 写入前端
- 写入日志
- 写入项目导出包
- 提交到 Git

现有其他供应商仍走 `ai_service_configs`（前端 AI 配置页）。xAI 视频 Key 不得走同一条前端写入路径。

## 工作规则

1. 先阅读和理解代码，再修改。
2. 禁止无关重构和大规模改名。
3. 每次只执行一个阶段。
4. 修改前先列出计划修改的文件。
5. 修改后必须运行相关测试和构建。
6. 展示修改摘要和测试结果，等待确认后再进入下一阶段。
7. 未经明确允许，不调用真实 xAI API。测试优先使用 Mock。
8. 不自动提交 Git，先让人查看 diff。

计划与任务拆分：

- `docs/GROK_IMPLEMENTATION_PLAN.md`
- `docs/GROK_TASKS.md`

## 仓库结构

三个子项目共享一个仓库，无 monorepo 工具。

| 服务 | 目录 | 端口 | 启动 |
|------|------|------|------|
| Backend (Express + SQLite) | `backend-node/` | 5679 | `npm run dev` |
| Frontend (Vite + Vue 3) | `frontweb/` | 3013 | `npm run dev` |
| Desktop (Electron) | `desktop/` | — | `npm start`（先 copy-backend） |

前端通过 Vite 把 `/api` 和 `/static` 代理到后端。

## 测试与构建

```bash
# 后端（Node.js 内置测试运行器）
cd backend-node && node --test test/*.test.js

# 前端
cd frontweb && node --test test/*.test.js

# 前端构建
cd frontweb && npm run build
```

本仓库没有配置 ESLint。

后端开发：`npm run dev`（`node --watch`）。数据库在启动时自动 `ensureColumns()`；新增 SQL 迁移文件后需要 `npm run migrate`。配置文件：`backend-node/configs/config.yaml`。

后端在存在 `frontweb/dist/` 时会在 5679 同时托管前端。开发时用 Vite 3013。

## 关键文件

| 职责 | 路径 |
|------|------|
| 视频协议与 xAI 适配 | `backend-node/src/services/videoClient.js` |
| 视频任务、轮询、本地下载 | `backend-node/src/services/videoService.js` |
| 视频 HTTP 接口 | `backend-node/src/routes/videos.js` |
| 异步任务表 | `backend-node/src/services/taskService.js` |
| FFmpeg 合成 | `backend-node/src/services/videoMergeService.js` |
| TTS | `backend-node/src/services/ttsService.js` |
| AI 配置 | `backend-node/src/services/aiConfigService.js` |
| 前端 AI 配置 UI | `frontweb/src/components/AIConfigContent.vue` |
| 制作页生视频 | `frontweb/src/views/FilmCreate.vue` |

阶段 0 结论：现有 xAI 适配基于旧 `grok-imagine-video`，与官方 Imagine Video 1.5 仍有多处差异。详见实现计划。
