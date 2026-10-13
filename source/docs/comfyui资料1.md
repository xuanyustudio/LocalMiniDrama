```markdown
文件 欧先生提供@全力以赴提供

# ComfyUI OpenAI API Proxy

基于 Rust 构建的高性能反向代理，将标准 OpenAI 图像/视频生成 API 调用无缝转换为 ComfyUI 后端请求。支持多后端健康检查、智能负载均衡、WebSocket 双通道、指数退避完全抖动、令牌桶限流、幂等键缓存、请求级响应缓存以及 OpenTelemetry 可观测性，为生成服务提供生产级可靠性。

## 概述

`comfyui-openai-api` 是 OpenAI API 兼容客户端与 ComfyUI 工作流引擎之间的桥梁，核心职责：

- **接收** 标准 OpenAI 格式的图像/视频生成请求
- **转换** 请求参数为 ComfyUI 工作流注入格式
- **路由** 根据配置策略将请求分发至健康的 ComfyUI 后端
- **管理** 异步任务生命周期，支持状态持久化与查询
- **交付** 符合 OpenAI API 规范的响应（Base64 编码图像/视频）

在 **LocalMiniDrama**（本地 AI 短剧全流程创作工具）等项目生态中，本代理承载着底层生成引擎的统一 API 基座角色，为从剧本到成片的完整链路提供稳定、可扩展的推理调度能力。

## 核心特性

### API 兼容性
- **OpenAI 图像生成** —— `POST /v1/images/generations`，同步返回 Base64 图像
- **视频生成扩展** —— `POST /v1/videos/generations`，异步返回 `task_id`，通过 `GET /v1/tasks/{task_id}` 查询结果
- **任务生命周期管理** —— 查询、列出、删除任务（`GET /v1/tasks`、`GET /v1/tasks/{task_id}`、`DELETE /v1/tasks/{task_id}`）
- **模型列表** —— `GET /v1/models` 返回所有可用工作流（模型）
- **后端状态查询** —— `GET /v1/backends` 查看各后端健康状态
- **健康检查** —— `GET /v1/health` 存活探针
- **视频子系统状态** —— `GET /v1/videos/health`
- **Prometheus 指标** —— `GET /v1/metrics`
- **API 帮助文档** —— `GET /v1/help`

### 多后端管理
- 支持配置多个 ComfyUI 后端节点，按名称 (`?backend=xxx`) 显式指定或自动选择
- **定期健康检查**：通过请求每个后端的 `/system_stats`，连续失败达阈值自动摘除，恢复后自动加入
- **负载均衡策略**：轮询（Round Robin）、最少连接数（Least Connections）、随机（Random），可在配置文件中切换

### 前置条件
- Rust 1.70+
- ComfyUI 后端（需启用 `--api` 模式）


### 运行

./target/release/comfyui-openai-api



## API 端点详解

所有端点均以 `/v1` 为前缀。以下是完整列表：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/models` | GET | 列出所有可用模型（工作流文件名） |
| `/v1/health` | GET | 简单存活检查 |
| `/v1/backends` | GET | 查看所有后端健康状态 |
| `/v1/images/generations` | POST | 图像生成，同步返回 |
| `/v1/videos/generations` | POST | 视频生成，异步返回 `task_id` |
| `/v1/tasks` | GET | 列出所有任务状态 |
| `/v1/tasks/{task_id}` | GET / DELETE | 查询或删除单个任务 |
| `/v1/videos/health` | GET | 视频生成子系统状态 |
| `/v1/metrics` | GET | Prometheus 指标导出 |
| `/v1/help` | GET | API 帮助文档（JSON） |

### 1. 图像生成 `POST /v1/images/generations`

**请求示例**
```bash
curl -X POST 'http://localhost:8080/v1/images/generations?backend=backend-a' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "sdxl-workflow",
    "prompt": "a cat wearing a hat, masterpiece",
    "negative_prompt": "low quality, blurry",
    "size": "1024x1024",
    "n": 1,
    "seed": 42,
    "reference_images": [
      {"name": "ref1", "data": "data:image/png;base64,iVBOR..."}
    ]
  }'
```

**请求参数（Body）**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 工作流文件名（不含 `.json`） |
| `prompt` | string | 否 | 正向提示词 |
| `negative_prompt` | string | 否 | 负向提示词 |
| `size` | string | 否 | 尺寸，如 `"1024x1024"`（可被配置文件覆盖） |
| `seed` | integer | 否 | 随机种子 |
| `n` | integer | 否 | 生成数量（批次大小） |
| `reference_images` | array | 否 | 参考图数组 `[{name, data}]` |
| `image` | array | 否 | Base64 图片字符串数组（等效于 `reference_images`） |

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `backend` | string | 否 | 指定后端名称，未指定时自动使用负载均衡策略 |

**响应格式**
```json
{
  "created": 1704067200,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUg..."
    }
  ]
}
```

### 2. 视频生成 `POST /v1/videos/generations`

**请求示例**
```bash
curl -X POST 'http://localhost:8080/v1/videos/generations?backend=backend-b' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "video-workflow",
    "content": [
      {"type": "text", "text": "a dog running in the park"},
      {"type": "image_url", "image_url": {"url": "https://example.com/ref.png"}, "role": "reference_image"}
    ],
    "duration": 5,
    "resolution": "720p"
  }'
```

**请求参数（Body）**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 视频工作流文件名 |
| `content` | array | 是 | 内容数组，每项可为 `{"type":"text", "text":"..."}` 或 `{"type":"image_url", "image_url":{"url":"..."}, "role":"reference_image"}` |
| `duration` | integer | 否 | 时长（秒），默认 5 |
| `resolution` | string | 否 | `"720p"` 或 `"1080p"` |
| `ratio` | string | 否 | 宽高比，如 `"16:9"` |
| `local_prompts` | string | 否 | 多镜头提示词，格式 `[起始-结束]\n描述` |
| `global_prompt` | string | 否 | 全局提示词 |
| `guide_strengths` | array | 否 | 引导强度数组 |

**响应格式**
```json
{
  "task_id": "vid-1715432100123-789"
}
```

### 3. 任务查询 `GET /v1/tasks/{task_id}`

```bash
curl http://localhost:8080/v1/tasks/vid-1715432100123-789
```

响应示例（处理中）：
```json
{
  "status": "processing"
}
```

响应示例（已完成）：
```json
{
  "status": "completed",
  "video_url": "http://backend-b:8000/view?filename=video.mp4&subfolder=&type=output",
  "b64_json": "..."
}
```

响应示例（失败）：
```json
{
  "status": "failed",
  "error": "ComfyUI node error: ..."
}
```

### 4. 列出所有任务 `GET /v1/tasks`

```bash
curl http://localhost:8080/v1/tasks
```

返回：
```json
{
  "tasks": [
    {
      "task_id": "vid-1715432100123-789",
      "status": "completed"
    },
    {
      "task_id": "img-1715432100456-123",
      "status": "processing"
    }
  ]
}
```

### 5. 删除任务 `DELETE /v1/tasks/{task_id}`

```bash
curl -X DELETE http://localhost:8080/v1/tasks/img-1715432100456-123
```
成功时返回 HTTP `204 No Content`。

### 6. 其他端点

- **列出模型** `GET /v1/models`
```bash
curl http://localhost:8080/v1/models
```
响应：
```json
{
  "object": "list",
  "data": [
    { "id": "sdxl-workflow", "object": "model", "owned_by": "comfyui-openai-api" },
    { "id": "video-workflow", "object": "model", "owned_by": "comfyui-openai-api" }
  ]
}
```

- **后端健康状态** `GET /v1/backends`
```json
{
  "backends": [
    { "name": "backend-a", "healthy": true },
    { "name": "backend-b", "healthy": false }
  ]
}
```

- **存活探针** `GET /v1/health`：返回 `OK`

- **Prometheus 指标** `GET /v1/metrics`：返回标准 Prometheus 文本格式指标。


### 完整配置项详解

```yaml
# 日志级别：trace, debug, info, warn, error
log_level: "info"

# 代理服务绑定地址和端口
server:
  host: "0.0.0.0"
  port: 8080

# 多后端列表，至少需要一个后端
comfyui_backends:
  - name: "backend-a"        # 唯一名称，用于通过 ?backend= 选择
    host: "127.0.0.1"        # ComfyUI 地址
    port: 8000               # ComfyUI 端口
    default: true            # 是否默认后端（用于 WebSocket 连接）
  - name: "backend-b"
    host: "192.168.1.100"
    port: 8188
    default: false

# 代理内部设置
comfyui_backend:
  client_id: "comfyui-api"         # WebSocket 客户端 ID
  workflows_folder: "./workflows"  # 工作流 JSON 存放目录
  use_ws: true                     # 是否启用 WebSocket 连接默认后端
  input_dir: "./cache"             # 图片缓存目录，保存上传的参考图

# 路由与运行时配置
routing:
  timeout_seconds: 3600            # ComfyUI 任务总超时（秒）
  max_payload_size_mb: 500         # 请求体最大大小（MB）
  Image_Width: 1280                # 图像默认宽度（可被请求中的 size 覆盖）
  Image_Height: 704                # 图像默认高度
  video_Width: 1024                # 视频默认宽度
  video_Height: 576                # 视频默认高度
  fps: 24                          # 默认帧率
  free_model_before_video: true    # 生成视频前是否调用 ComfyUI /free 释放显存

  # 负载均衡策略，可选值：RoundRobin, LeastConnections, Random
  lb_strategy: "RoundRobin"

  # 令牌桶限流（可选，注释或删除则限流不生效）
  rate_limit:
    max_tokens: 60       # 桶容量
    refill_rate: 1.0     # 每秒补充令牌数

  # 请求级响应缓存（可选，注释或删除则缓存不生效）
  response_cache:
    ttl_secs: 600        # 缓存有效期（秒）
    max_entries: 500     # LRU 最大条目数

  # 是否启用幂等键检查（Idempotency-Key 头）
  enable_idempotency: true

  # 优雅关闭最长等待时间（秒），超时后强制退出
  graceful_shutdown_timeout_secs: 30

  # 健康检查间隔（秒）与连续失败阈值
  health_check_interval_secs: 15
  health_check_fail_threshold: 3
```

## 架构与请求流程

### 架构概览

```
┌──────────────────────────────────────┐
│         OpenAI 兼容客户端            │
│   (Python, JS, curl, LocalMiniDrama) │
└────────────────┬─────────────────────┘
                 │ HTTP POST /v1/images/generations
                 ▼
┌──────────────────────────────────────┐
│        comfyui-openai-api            │
│  ┌──────────┐ ┌────────────────┐     │
│  │ 限流器   │ │ 幂等键检查     │     │
│  └──────────┘ └────────────────┘     │
│  ┌──────────┐ ┌────────────────┐     │
│  │ 工作流   │ │ 后端池 & LB    │     │
│  │ 注入器   │ │ + 健康检查     │     │
│  └──────────┘ └────────────────┘     │
│  ┌──────────────────────────────┐    │
│  │ WebSocket / HTTP 轮询        │    │
│  │ (全抖动退避)                 │    │
│  └──────────────────────────────┘    │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│  ComfyUI 后端 A (健康)               │
│  ComfyUI 后端 B (健康)               │
│  ComfyUI 后端 C (不健康，已摘除)     │
└──────────────────────────────────────┘
```

## 与 LocalMiniDrama 的生态协同

- **统一生成接口**：`LocalMiniDrama` 通过标准 OpenAI API 调用本代理，无需关心底层 ComfyUI 工作流细节。
- **批量分镜生成**：逐镜生成流程可借助多后端负载均衡实现并行加速。
- **角色一致性**：通过 `X-Consistent-Role` 头与种子追踪器联动，保持同一角色多分镜外貌一致。
- **视频模型支持**：内置豆包 Seedance、通义万相、Vidu 等工作流注入兼容，覆盖短剧制作的多模型需求。

## 故障排查

| 现象 | 可能原因 | 排查方法 |
|------|---------|---------|
| 502 Bad Gateway | ComfyUI 后端不可达 | 检查 `comfyui_backends` 配置中 host/port 是否正确，确认 ComfyUI 已启动 `--api` |
| 404 Workflow not found | `model` 参数对应的工作流文件不存在 | 确认 `workflows_folder` 目录下存在 `{model}.json` 文件 |
| 400 Invalid request | 请求体格式错误或 Base64 解码失败 | 检查 JSON 格式，验证 Base64 编码有效性 |
| 504 Timeout | 生成时间超过 `timeout_seconds` | 增大超时值或检查 ComfyUI 日志中的节点错误信息 |
| 429 Too Many Requests | 触发令牌桶限流 | 调整 `rate_limit` 配置或降低请求频率 |
| 后端被摘除 | 健康检查连续失败 | 检查 ComfyUI `/system_stats` 是否正常返回，网络连通性 |

## 版本历史

### v0.3.0
- 🏗️ 模块化架构重构，拆分 handlers/backend/transport/middleware/cache/workflows
- 🔄 多后端健康检查与负载均衡（RoundRobin / LeastConnections / Random）
- 🔒 令牌桶限流中间件
- 🆔 幂等键支持
- 💾 请求级 LRU 响应缓存
- 📡 OpenTelemetry 分布式追踪
- 🧹 优雅关闭与任务排水
- 🌱 角色种子稳定性追踪器
- 📋 新增 `/v1/models`、`/v1/backends`、`/v1/tasks` 列表与删除等端点

### v0.2.0
- 视频生成支持
- 多后端手动路由
- 任务持久化（tasks.json）
- PromptRelayEncode / LTXVAddGuideMulti 节点注入

### v0.1.0
- 初始版本，OpenAI 图像生成兼容

## 贡献指南

欢迎通过 Issue 和 Pull Request 参与贡献。请遵循以下准则：

- 为新增的公共函数和模块添加文档注释
- 面向用户的功能改动需同步更新配置示例和 API 文档（即本 README 与 /v1/help 端点）
- 针对多种工作流配置进行测试
- 遵循现有代码风格和模块组织方式