# MIGU 私有网关（HAI）接入文档

> 适用范围：LocalMiniDrama 后端 `backend-node`（生图 / 生视频）+ 前端 `frontweb`（AI 配置页）。
> 底层实现集中在 `backend-node/src/utils/haiGateway.js`，生图走 `imageClient.js`，生视频走 `videoClient.js`。

## 1. 网关概览

| 项 | 值 |
|---|---|
| 协议名（AI 配置 · 接口规范） | `hai` |
| 厂商预设名 | `migu`（MIGU · 私有化 HAI 网关） |
| 默认网关地址 | `http://36.138.206.92:60788/mgpu-node3-prod/hai/api/v1` |
| 鉴权方式 | 请求头 `x-api-key`（**所有接口都要带**，包括下载产物） |
| Key 注入 | 环境变量 `HAI_API_KEY` 优先，其次 AI 配置里填的 Key |
| 地址注入 | 环境变量 `HAI_API_BASE` 优先，其次 AI 配置里的 BaseURL，最后内置默认 |

> 注意：网上流传的「生产环境免鉴权 / 新地址」版本接口文档**不可信**，以本文为准——地址和 key 均保持原方式。

### 接口清单（4 个）

```
① 上传图片   POST {base}/upload/image      multipart 字段 file → { filename }
② 上传音频   POST {base}/upload/file       multipart 字段 file → { filename }（音色驱动用）
③ 提交任务   POST {base}/generate          { input: { request_id, modifier, modifications } }
④ 轮询结果   GET  {base}/result/{request_id} → { status, message, output: [{ media_type, download_url }] }
```

- 鉴权：①②③④ 全部带 `x-api-key`
- 产物下载：`GET {scheme://host:port}{download_url}`（download_url 是相对路径，要拼网关源站），同样带 `x-api-key`
- 轮询终态：`status = completed` 成功；`failed` / `error`（网关返回 HTTP 500/502）失败；`cancelled`（HTTP 499）取消——**这三种必须终止轮询**，非终态错误才继续轮询

### Modifier（模型路由）

| modifier | 用途 | 关键 modifications |
|---|---|---|
| `MinimaxH3ImageEdit` | 文生图 / 参考图生图 | `prompt`、`ref_images[]`、`width/height`（纯文生图） |
| `VideoMinimaxH3I2v` | 首帧图生视频 / 纯文生视频 | `prompt`、`first_frame`、`last_frame`（均可选） |
| `VideoMinimaxH3R2v` | 多模态参考 + 音频驱动 | `ref_images[]`(≤9)、`ref_audios[]`(≤3)、无 first_frame 字段 |

**I2V/R2V 自动路由规则**（`buildHaiVideoRequest`）：

- 有参考图 **或** 有音色音频 → 强制 R2V（I2V 不支持 `ref_audios`）
- 仅首帧 / 纯文生视频 → I2V（首帧精确控制）
- 环境变量 `HAI_VIDEO_MODIFIER=VideoMinimaxH3R2v|VideoMinimaxH3I2v` 可强制覆盖

## 2. 文生图 / 分镜图（MinimaxH3ImageEdit）

请求要点：

1. 参考图（本地路径 / localhost / 公网 URL 统一转 Buffer）先 `POST /upload/image`，得 `filename` 填进 `ref_images[]`；带参考图时 prompt 自动加一致性前缀（禁止抄参考图版式），可用 `HAI_IMAGE_REF_PROMPT` 覆盖或置空关闭
2. **纯文生图**：宽高必须**向下取整到 32 的倍数**（VAE 下采样要求，720 → 704）；部分网关版本强制要求 width——网关报错含 width 时按 `HAI_IMAGE_MEGAPIXELS` 兜 16:9 画布**重试一次**（实测坑位，勿指望一次成功）
3. 产物下载后可用 ffmpeg 按 `HAI_IMAGE_CROP_WATERMARK_PX` 裁底部水印（默认不裁，裁失败保留原图）

默认参数：`HAI_IMAGE_MEGAPIXELS=4`（≈4K 画布）、`HAI_IMAGE_STEPS=6`、轮询 6s、超时 600s。

## 3. 生视频（I2V / R2V）

### 通用参数

| 字段 | 规则 |
|---|---|
| `duration_seconds` | 整数秒，**钳制 5–15**（网关下限 5，太短直接拒绝），向上取整、宁长勿短 |
| `aspect_ratio` | 枚举大小写敏感，共 7 个：`SQUARE` / `PORTRAIT_2_3` / `PORTRAIT_3_4` / `PORTRAIT_9_16` / `LANDSCAPE_3_2` / `LANDSCAPE_4_3` / `LANDSCAPE_16_9` |
| `megapixels` | 默认 1（`HAI_VIDEO_MEGAPIXELS`） |
| `enable_lightning_lora` | 加速档，默认开（`HAI_LIGHTNING_LORA=0` 关闭；关后生成明显变慢，但运动节奏更自然） |
| `watermark` | 视频水印，默认关（`HAI_WATERMARK`） |

### I2V（首帧链路）

- `first_frame` / `last_frame`：单 filename 字符串，均可省略（省略即纯文生视频）
- prompt 纯文本，无特殊格式要求

### R2V（多模态参考 + 音频驱动）

- `ref_images[]`：最多 9 张，超出截断；首帧如存在会**并入 `ref_images[0]`**（即 `<Picture 1>`），角色/场景参考从 `<Picture 2>` 起
- `ref_audios[]`：最多 3 条，走 `/upload/file` 上传（支持 mp3/wav/m4a/aac/ogg/flac）
- prompt 约定（自动注入前缀）：
  - `<Picture 1>` 为首帧画面，整段视频从该帧开始运动、保持一致性
  - `<Picture N>`（N≥2）只用于人物长相服饰、道具外观与环境色调，**不复制参考图版式**
  - `<Audio 1>` 为说话角色音色：**模型直接生成口型同步语音**，台词写在 prompt 的「」内；口型与语音严格同步
- 全能分镜模式的参考图顺序：场景 → 角色（多张）→ 道具，**不含经典分镜主图**；prompt 用 `@图片1/@图片2` 编号引用（后端会映射为 `<Picture N>`）

### 角色音色（口型同步）注入链路

```
角色资产 seedance2_voice_asset（status=active）→ 按分镜出场角色匹配
→ hai 协议自动注入 voice_reference_url（也可显式传入）
→ POST /upload/file 上传 → ref_audios[0] → <Audio 1> 口型同步指令
```

注意：视频已带人声，**后期合并时不要再开「烧录对白配音」（TTS）**，否则两遍声音。

### 时长与耗时（实测）

- 实际产出略长于请求值（请求 5s → 约 5.17s）；策略宁长勿短，下游拼接按分镜秒数截断，**不要在生成层裁**
- 机器时间随段长非线性增长：5s 段 ≈173s、13s 段 ≈925s；预估公式 `HAI_VIDEO_EST_BASE(105) + 68 × 段长`，超时取 `max(HAI_TIMEOUT_SECONDS(1200), 预估+120)`

## 4. 环境变量总表（不落盘）

| 变量 | 默认 | 说明 |
|---|---|---|
| `HAI_API_BASE` | 内置网关地址 | 换部署时覆盖 |
| `HAI_API_KEY` | AI 配置 Key 兜底 | 鉴权 key（x-api-key） |
| `HAI_IMAGE_POLL_SECONDS` | 6 | 生图轮询间隔 |
| `HAI_IMAGE_TIMEOUT_SECONDS` | 600 | 生图超时 |
| `HAI_IMAGE_MEGAPIXELS` | 4 | 纯文生图画布 |
| `HAI_IMAGE_STEPS` | 6 | 采样步数 |
| `HAI_IMAGE_REF_PROMPT` | 内置一致性前缀 | 置空字符串关闭 |
| `HAI_IMAGE_CROP_WATERMARK_PX` | 0 | 裁底部水印像素 |
| `HAI_IMAGE_MODIFIER` | MinimaxH3ImageEdit | 生图 modifier 覆盖 |
| `HAI_POLL_SECONDS` | 8 | 生视频轮询间隔 |
| `HAI_TIMEOUT_SECONDS` | 1200 | 生视频超时下限 |
| `HAI_VIDEO_MODIFIER` / `HAI_MODIFIER` | 自动路由 | 强制 I2V/R2V |
| `HAI_ASPECT` | 按入参映射 | 强制画幅枚举 |
| `HAI_LIGHTNING_LORA` | 1 | 加速档（0 关闭） |
| `HAI_WATERMARK` | 0 | 视频水印 |
| `HAI_VIDEO_MEGAPIXELS` | 1 | 生视频画布 |
| `HAI_VIDEO_EST_BASE` / `HAI_VIDEO_EST_PER_SECOND` | 105 / 68 | 耗时预估 |
| `FFMPEG_PATH` | 内置查找 | 裁水印用 |

## 5. 前端 AI 配置页配置方法

1. 「文本生成图片 / 分镜图片生成 / 视频生成」三类中，厂商选 **MIGU（私有化 HAI 网关）**
2. 只需填 **Key** 和 **BaseURL**（BaseURL 自动填内置默认地址）；endpoint / query_endpoint 留空（协议自包含：提交 `/generate`，轮询 `/result/{request_id}`）
3. 接口规范下拉选 `hai`；接口地址预览会显示 `/generate` + `/result/{request_id}`
4. 「测试连接」走 `GET {base}/result/test-connectivity`：HTTP 401/403 = Key 无效，其他状态 = Key 有效已联通
5. 视频侧无需勾选「确认支持全能模式」——`hai` 协议已内建在全能多图白名单里

## 6. 视频生成流程（端到端）

```
全能模式：参考图（场景→角色→道具）+ 角色音色
经典模式：分镜主图当首帧（+ 音色）
        ↓
上传 ref_images / ref_audios → POST /generate（request_id + modifier + modifications）
→ 轮询 GET /result/{request_id}（复用现有轮询框架，支持失败继续查询、重启恢复）
→ 按 download_url 拼源站 + x-api-key 下载到本地（下载失败不算成功）
→ ffmpeg 画幅归一化 → 入库 / 合成
```

## 7. 实测坑位清单

1. 鉴权头一律 `x-api-key`，不是 `Authorization: Bearer`——用通用 OpenAI 分支测连接必 401
2. 轮询对 failed 任务返回 HTTP 500/502、cancelled 返回 499，必须识别为终态，否则死循环
3. 纯文生图部分网关版本强制要求 width，需按 megapixels 兜 16:9 重试
4. `duration_seconds` 下限 5；实际产出比请求略长，宁长勿短
5. 上传响应缺 `filename`、任务 completed 但 output 为空 → 按错误处理并原样报响应片段
6. 加速档（lightning LoRA）默认开，运动节奏偏快；要自然节奏设 `HAI_LIGHTNING_LORA=0` 重启后端
7. R2V 有音色时视频自带人声，合并阶段不要叠加 TTS 配音
