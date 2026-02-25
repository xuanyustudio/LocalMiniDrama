# 快速开始 / 开发指南

**导航：[项目主页](../README.md) | [English](en.md) | [AI 配置](configuration.md) | [版本历史](changelog.md)**

---

## 目录

- [运行方式一：下载 exe（推荐普通用户）](#运行方式一下载-exe推荐普通用户)
- [运行方式二：开发模式（推荐开发者）](#运行方式二开发模式推荐开发者)
  - [环境要求](#环境要求)
  - [启动后端](#1-启动后端)
  - [启动前端](#2-启动前端)
  - [一键启动脚本](#3-一键启动脚本)
- [打包为 Windows exe](#打包为-windows-exe)
- [配置文件说明](#配置文件说明)
- [数据库与数据目录](#数据库与数据目录)
- [常见问题 FAQ](#常见问题-faq)

---

## 运行方式一：下载 exe（推荐普通用户）

1. 前往 **[Releases](../../releases)** 页面下载最新版本：
   - `LocalMiniDrama Setup x.x.x.exe` — NSIS 安装包（推荐，可选安装路径）
   - `LocalMiniDrama x.x.x.exe` — 免安装便携版，解压即用

2. 双击运行，软件会自动启动内置后端服务。

3. 首次运行会在以下路径生成配置文件：
   ```
   %APPDATA%\LocalMiniDrama\backend\configs\config.yaml
   ```

4. 点击软件右上角「AI 配置」，填入你的 AI API Key，即可开始使用。

> 💡 不知道去哪里申请 API Key？请看 → [AI 配置指南](configuration.md)

---

## 运行方式二：开发模式（推荐开发者）

### 环境要求

| 依赖 | 版本要求 |
|------|----------|
| Node.js | >= 18 |
| npm | 随 Node.js 附带 |
| Git | 任意版本 |

---

### 1. 启动后端

```bash
cd backend-node

# 安装依赖
npm install

# 复制配置文件模板
cp configs/config.example.yaml configs/config.yaml
# Windows PowerShell:
# copy configs\config.example.yaml configs\config.yaml

# 编辑 config.yaml，填入你的 AI API 地址与密钥（见配置指南）

# 首次运行：初始化数据库
npm run migrate

# 启动服务（默认端口 5679）
npm start

# 开发模式（热重载）
npm run dev
```

后端启动成功后，终端会输出：
```
Server started on port 5679
```

---

### 2. 启动前端

**新开一个终端窗口：**

```bash
cd frontweb

# 安装依赖
npm install

# 启动开发服务器（默认端口 3013，自动代理到后端 5679）
npm run dev
```

浏览器访问 `http://localhost:3013` 即可看到界面。

---

### 3. 一键启动脚本

在项目根目录提供了一键启动脚本，**同时启动后端和前端**：

**Windows（双击运行）：**
```
run_dev.bat
```

**PowerShell：**
```powershell
.\run_dev.ps1
```

脚本会分别在两个窗口中启动后端（端口 5679）和前端（端口 3013），并自动打开浏览器。

---

## 打包为 Windows exe

> 打包前请先确保已完成后端和前端的 `npm install`。

```bash
cd desktop

# 安装 Electron 相关依赖
npm install

# 打包（生成 NSIS 安装包 + 便携版 exe）
npm run dist

# 国内网络 Electron 下载慢时，使用镜像加速：
npm run dist:cn
```

打包产物位于 `desktop/release/` 目录：
- `LocalMiniDrama Setup x.x.x.exe` — NSIS 安装包
- `LocalMiniDrama x.x.x.exe` — 便携版

**打包原理：**
1. 构建前端静态文件
2. 复制后端代码与前端产物到 `desktop/` 
3. electron-builder 打包为 Windows exe

---

## 配置文件说明

配置文件位于 `backend-node/configs/config.yaml`（开发模式）或 `%APPDATA%\LocalMiniDrama\backend\configs\config.yaml`（exe 模式）。

主要配置项：

```yaml
server:
  port: 5679          # 后端端口

database:
  path: ./data/drama_generator.db   # SQLite 数据库路径

storage:
  local_path: ./data/storage        # 生成图片/视频的本地存储目录

language: zh          # 界面及提示词语言（zh / en）

style:
  default_style: realistic           # 默认画风
  default_image_ratio: "16:9"        # 默认图片比例
  default_video_ratio: "16:9"        # 默认视频比例
```

AI 服务配置通过软件内「AI 配置」页面管理，无需手动编辑 YAML。  
详细说明请见 → [AI 配置指南](configuration.md)

---

## 数据库与数据目录

| 路径 | 说明 |
|------|------|
| `backend-node/data/drama_generator.db` | SQLite 数据库（开发模式） |
| `backend-node/data/storage/` | 生成的图片和视频文件 |
| `%APPDATA%\LocalMiniDrama\` | exe 模式下的所有数据 |

> ⚠️ 升级版本前建议备份 `data/` 目录；数据库会在启动时自动执行迁移脚本，一般无需手动操作。

---

## 常见问题 FAQ

### Q: 后端启动报错 `Cannot find module 'better-sqlite3'`

```bash
cd backend-node
npm install
```

如果仍然报错，可能是 Node.js 版本不兼容，请升级到 >= 18。

---

### Q: 前端报错 `Failed to fetch` 或 API 请求 404

确认后端已正常启动（终端显示 `Server started on port 5679`），且前端代理配置指向正确端口。  
检查 `frontweb/vite.config.js` 中的 `proxy` 配置，确保 target 为 `http://localhost:5679`。

---

### Q: 打包 exe 时 Electron 下载失败

使用国内镜像：
```bash
cd desktop
npm run dist:cn
```

或手动设置环境变量后再运行：
```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm run dist
```

---

### Q: 生成的图片/视频保存在哪里？

开发模式：`backend-node/data/storage/`  
exe 模式：`%APPDATA%\LocalMiniDrama\backend\data\storage\`

目录结构：
```
storage/
├── images/        # 分镜生成的图片
├── characters/    # 角色图片
├── scenes/        # 场景图片
├── videos/        # 生成的视频片段
└── merged/        # 合成后的完整视频
```

---

### Q: 如何备份/迁移项目数据？

**方法一（推荐）**：在软件首页点击项目卡片上的「导出」按钮，下载 ZIP 格式的工程文件，在新机器上导入即可。

**方法二**：直接备份整个 `data/` 目录，将其复制到新机器的相同位置。

---

### Q: 支持 Mac / Linux 吗？

目前仅测试了 Windows。后端（Node.js）理论上跨平台，前端（Vue 3）完全跨平台，但桌面版（Electron）打包仅配置了 Windows 目标。  
欢迎提 PR 添加 Mac / Linux 打包支持。

---

[← 返回项目主页](../README.md)
