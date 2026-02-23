# LocalMiniDrama

> 本地运行的 AI 短剧 & 漫剧生成工具 —— 下载即用，无需科学上网，完全开源。

![version](https://img.shields.io/badge/version-1.1.4-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![stack](https://img.shields.io/badge/stack-Vue3%20%2B%20Node.js%20%2B%20Electron-informational)

**中文 | [English](README.en.md) | [作者故事 & 碎碎念](README.story.md)**

市面上的 AI 短剧工具不少，但真正能**本地离线运行、开箱即用、不担心素材外泄**的几乎没有。本项目用纯 JavaScript 从零搭建，接入你自己的 AI API（或云端 API），打开就能生成属于自己的 AI 短剧。

---

## 📸 界面截图

<img src="项目截图/武侠.png" alt="项目列表页" width="600" />
<img src="项目截图/武侠分镜.png" alt="分镜编辑页" width="600" />
<img src="项目截图/3.png" alt="画面生成" width="400" />
<img src="项目截图/4.png" alt="预览效果" width="400" />
<img src="项目截图/5.png" alt="生成结果" width="400" />

---

## ✨ 核心功能

### 完整创作流程

| 步骤 | 功能 | 说明 |
|:----:|------|------|
| 1 | 故事生成 | 输入梗概 + 风格，AI 自动生成剧本 |
| 2 | 剧本编辑 | 编辑剧本文本、分集管理 |
| 3 | 角色生成 | AI 生成角色列表，逐个生成形象图 |
| 4 | 场景生成 | 从剧本提取场景，生成场景图 |
| 5 | 道具生成 | 从剧本提取/手动添加道具，生成道具图 |
| 6 | 分镜生成 | 根据当前集自动生成分镜脚本 |
| 7 | 分镜图/视频生成 | 逐镜生成图片与视频片段 |
| 8 | 合成视频 | 所有分镜视频合成为完整剧集 |

### 一键流水线

- **一键生成视频**：角色图 → 场景图 → 分镜脚本 → 分镜图 → 分镜视频 → 合成，全自动执行
- **补全并生成**：智能跳过已有内容，只补全缺失的部分，最后自动合成
- **失败重试**：每步自动重试 3 次，3 次后记录错误继续下一项，不中断流程
- **实时进度**：执行过程中显示当前步骤与完整错误日志

### 剧集与资源管理

- **剧集管理页**：独立管理剧集信息（标题/风格/比例）、本剧角色/场景/道具库、分集列表（新增/删除/剧本预览）
- **素材库**：全局角色/场景/道具库，跨剧集复用；本剧资源库与素材库相互独立，互不干扰
- **从素材库导入**：一键将全局素材导入当前剧集资源库

### 分镜编辑

- **图片提示词**：查看并编辑每个分镜的图片生成提示词，修改后可重新生成
- **视频提示词**：支持手工编辑全文，也可展开组成面板逐字段编辑（场景/时长/角色动作/氛围/运镜/景别等），自动重新拼装
- **图片管理**：AI 生成、手动上传、拖拽上传，支持随时替换

### AI 配置

- 支持图片生成、视频生成、文本生成三类模型独立配置
- 兼容阿里云 DashScope、火山引擎 Volcengine、本地部署模型等多种 API
- 可视化管理，保存即生效，支持连接测试

### 界面体验

- 支持**暗色模式**（默认）与**白天模式**切换，偏好持久保存
- 所有页面顶部均有主题切换按钮

---

## 🚀 快速开始

### 方式一：直接下载 exe（推荐普通用户）

前往 [Releases](../../releases) 下载最新版安装包（`LocalMiniDrama Setup x.x.x.exe`）或便携版（`LocalMiniDrama x.x.x.exe`），双击运行即可。

首次运行会在 `%APPDATA%\LocalMiniDrama\backend\configs\config.yaml` 生成配置文件，在软件「AI 配置」页填入你的 API Key 后即可开始使用。

### 方式二：开发模式运行

> 需要 Node.js >= 18

**1. 启动后端**

```bash
cd backend-node
npm install
cp configs/config.example.yaml configs/config.yaml
# 编辑 config.yaml，填入 AI 模型 API 地址与密钥
npm run migrate   # 首次运行，初始化数据库
npm start         # 默认端口 5679
```

**2. 启动前端**

```bash
cd frontweb
npm install
npm run dev       # 默认端口 3013，自动代理到后端 5679
```

浏览器访问 `http://localhost:3013` 即可。

**3. 打包为 Windows exe（可选）**

```bash
cd desktop
npm install
npm run dist      # 生成安装包与便携版 exe

# 国内网络（Electron 下载慢时）使用镜像：
npm run dist:cn
```

详见 [desktop/README.md](desktop/README.md)。

---

## 🏗 项目架构

```
LocalMiniDrama/
├── backend-node/          # Node.js 后端（Express + SQLite）
│   ├── src/
│   │   ├── config/        # 配置加载（YAML）
│   │   ├── db/            # SQLite 连接与迁移
│   │   ├── services/      # 业务逻辑
│   │   └── routes/        # API 路由
│   └── configs/           # 配置文件（config.yaml）
├── frontweb/              # Vue 3 前端（Vite + Element Plus）
│   └── src/
│       ├── views/
│       │   ├── FilmList.vue      # 首页：项目列表、素材库
│       │   ├── DramaDetail.vue   # 剧集管理：信息/分集/资源库
│       │   └── FilmCreate.vue    # 制作页：剧本/角色/分镜/生成
│       ├── api/                  # 后端 API 封装
│       ├── composables/          # 通用逻辑（主题切换等）
│       ├── stores/               # Pinia 状态管理
│       └── styles/               # 全局样式（主题变量）
├── desktop/               # Electron 桌面壳（打包 exe）
└── README.md
```

### 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 + Vite + Element Plus + Pinia + Axios |
| 后端 | Node.js + Express + SQLite (better-sqlite3) |
| 桌面 | Electron 28 + electron-builder |
| 语言 | 纯 JavaScript（无 TypeScript） |

---

## 📋 版本历史

### v1.1.4（当前）

- **剧集管理页**：新增独立的剧集管理页面，统一管理剧集信息、本剧资源库与分集列表
- **资源库分层**：本剧资源库（按剧过滤）与全局素材库严格隔离，修复了不同剧集资源互相可见的 Bug
- **素材库导入**：在剧集管理页可一键从全局素材库导入角色/场景/道具
- **分集管理增强**：支持新增/删除分集，显示剧本前 20 字作为预览
- **图片替换修复**：AI 生成图片后手动上传新图可正确替换旧图（修复 local_path 未清除问题）
- **明暗主题切换**：支持暗色/白天模式，偏好持久保存，三个页面均可切换
- **导航改进**：制作页新增「返回剧集」按钮；新建项目后直接进入制作页；分集列表点击可精确跳转对应集

### v1.1.x 历史改进

- **一键生成流水线**：一键生成视频 + 补全并生成，自动跳过已有内容
- **失败重试机制**：每步最多重试 3 次，应对 429 限流等错误
- **实时进度展示**：流水线执行中实时显示步骤与错误日志
- **视频提示词编辑**：手工编辑全文 + 组成字段展开编辑，景别/运镜独立配置
- **图片提示词编辑**：每个分镜可单独查看和修改图片提示词
- **分镜视频错误展示**：生成失败的错误信息直接显示在分镜卡片上并持久化
- **AI 配置优化**：支持多种服务商（DashScope / Volcengine 等）连接测试

---

## 🎯 适合谁

- 想快速制作 AI 短剧 / 漫剧的内容创作者
- 重视隐私、不想把素材上传到云端的用户
- 喜欢折腾、希望自定义生成流程的开发者
- 想入门短剧 / AI 视频赛道、先低成本探索的新手

---

## 🔗 同类工具参考

| 工具 | 特点 |
|------|------|
| **Kino 视界** | 国内活跃的 AI 短剧平台，云端为主，非开源 |
| **Filmaction AI** | AI 自动生成剧情/分镜/配音，SaaS/Web 端，部分付费 |
| **oiioii** | 开源，轻量化 AI 可视化创作，部署灵活 |
| **ChatFire** | AI 驱动剧情生成/对话体短剧，启发了本项目后端设计 |

本项目更聚焦于**本地离线、界面友好、方便二次开发**，欢迎 Issue 推荐更多优秀工具。

---

## 💬 关于作者

一个游戏搬砖工，用自己熟悉的 JavaScript 做了这个开源项目，先做了再说。

想了解项目诞生的完整故事、纠结历程和参考致谢？👉 [作者故事 & 碎碎念](README.story.md)

---

## 📄 License

[MIT](LICENSE)
