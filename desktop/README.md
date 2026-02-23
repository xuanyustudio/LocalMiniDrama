# LocalMiniDrama 桌面客户端

基于 Electron 的本地桌面应用，内嵌 `backend-node` 与 `frontweb`，打包为 Windows exe 后可直接运行。当前版本：**v1.1.4**

---

## 主要功能（v1.1.4）

| 模块 | 功能 |
|------|------|
| 首页（项目列表） | 创建/打开剧集项目；素材库（角色/场景/道具全局复用）；AI 配置；明暗主题切换 |
| 剧集管理页 | 管理剧集信息（标题/风格/比例）；分集列表（新增/删除/预览剧本）；本剧资源库（角色/场景/道具按剧过滤）；从素材库导入资源 |
| 制作页（分集） | 剧本编辑、角色/场景/道具 AI 生成与图片管理；分镜脚本生成与逐镜编辑（图片提示词、视频提示词） |
| 一键流水线 | **一键生成视频**：全流程自动执行；**补全并生成**：仅生成缺失内容，自动跳过已有 |
| 图片/视频生成 | 支持 DashScope、Volcengine 等多种 API；生成失败自动重试 3 次；错误信息持久显示 |
| 合成视频 | 将所有分镜视频合成为完整剧集 |
| 主题 | 支持暗色模式（默认）与白天模式，偏好持久保存 |

---

## 开发运行

1. 确保已构建前端（否则窗口内会显示「请先构建前端」提示）：
   ```bash
   cd ../frontweb && npm install && npm run build
   ```
2. 安装依赖并启动 Electron：
   ```bash
   cd desktop
   npm install
   npm start
   ```

开发时后端工作目录为 `backend-node/`，配置与数据使用仓库内路径。

---

## 打包为 exe

在 `desktop` 目录下执行：

```bash
cd desktop
npm install
npm run dist
```

**国内网络**：若从 GitHub 下载 Electron 或 winCodeSign 超时，使用国内镜像：

```bash
npm run dist:cn
```

本目录下的 `.npmrc` 已配置 `registry=https://registry.npmmirror.com`，`npm install` 会使用国内源；`dist:cn` 脚本会将 Electron 与 electron-builder 的二进制下载也切换到 npmmirror 镜像。

产物在 `desktop/release/` 下：

| 文件 | 说明 |
|------|------|
| `LocalMiniDrama Setup x.x.x.exe` | NSIS 安装包（有安装引导，可选安装目录） |
| `LocalMiniDrama x.x.x.exe` | 便携版（单文件，无需安装，双击即用） |

首次运行时，会在用户数据目录（如 `%APPDATA%/LocalMiniDrama`）下生成 `backend/`，包含 `configs/config.yaml`（从 example 复制）和 `data/`（数据库与文件存储），按需修改配置即可。

---

## 脚本说明

| 脚本 | 说明 |
|------|------|
| `npm start` | 启动 Electron（开发模式） |
| `npm run build:front` | 仅构建前端（frontweb） |
| `npm run copy-front` | 将 frontweb/dist 复制到 desktop/frontweb-dist（打包前置步骤） |
| `npm run pack` | 构建前端 + 复制 + 打出未压缩目录（便于检查打包内容） |
| `npm run dist` | 构建前端 + 复制 + 打出 Windows 安装包与便携 exe |
| `npm run dist:cn` | 同上，使用国内镜像（Electron、electron-builder 二进制） |
| `npm run prepare-backend` | 将 backend-node 复制到 backend-app（打包前置步骤） |

---

## 打包后如何看日志 / 调试

### 1. 查看后端日志文件（推荐）

双击运行 exe 时，后端日志会自动写入：

```
%APPDATA%\LocalMiniDrama\backend\logs\app.log
```

用记事本或 VS Code 打开后，点击「AI 生成角色」等按钮，查看是否有对应请求行、报错信息，便于判断是请求未发出、AI 超时还是配置有误。

### 2. 从命令行运行（实时日志）

```powershell
& "D:\path\to\release\LocalMiniDrama 1.1.4.exe"
```

日志会直接打印在终端，操作软件时可实时看到所有输出。

### 3. 打开前端开发者工具

```powershell
$env:LOCALMINIDRAMA_DEVTOOLS=1
& "D:\path\to\release\LocalMiniDrama 1.1.4.exe"
```

在 Network 面板查看各 API 请求（如 `POST /api/v1/generation/characters`）是否正常发出和返回。

### 4. 确认配置与网络

配置文件位于：

```
%APPDATA%\LocalMiniDrama\backend\configs\config.yaml
```

AI 相关配置需在软件「AI 配置」弹窗中填写并保存（会写入上述 yaml 文件）；本机网络需能访问对应 API（如 dashscope、volcengine 等）。

---

## 依赖

- Node.js >= 18
- 本仓库中的 `backend-node`（打包时通过 `prepare-backend` 复制到 `backend-app`）
- 前端需先在 `frontweb` 目录执行 `npm run build`，再打包或开发运行
