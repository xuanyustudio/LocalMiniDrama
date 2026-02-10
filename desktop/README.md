# LocalMiniDrama 桌面客户端

基于 Electron 的本地桌面应用，内嵌 backend-node 与 frontweb，打包为 Windows exe 后可直接运行。

## 开发运行

1. 确保已构建前端（否则窗口内会显示“请先构建前端”的提示页）：
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

## 打包为 exe

在 `desktop` 目录下执行：

```bash
cd desktop
npm install
npm run dist
```

**国内网络**：若从 GitHub 下载 Electron 或 winCodeSign 超时，可使用国内镜像打包（会走 npmmirror）：

```bash
npm run dist:cn
```

本目录下的 `.npmrc` 已配置 `registry=https://registry.npmmirror.com`，`npm install` 会使用国内源；打包时的 Electron 与 electron-builder 二进制通过 `dist:cn` 使用 npmmirror 镜像。

产物在 `desktop/release/` 下：

- **NSIS 安装包**：`release/LocalMiniDrama Setup x.x.x.exe`
- **便携版**：`release/LocalMiniDrama x.x.x.exe`（单文件，无需安装）

首次运行安装版或便携版时，会在用户数据目录（如 `%APPDATA%/localminidrama-desktop`）下生成 `backend/`，其中包含 `configs/config.yaml`（从 example 复制）和 `data/`（数据库与存储），可按需修改配置。

## 脚本说明

| 脚本 | 说明 |
|------|------|
| `npm start` | 启动 Electron，开发模式 |
| `npm run build:front` | 仅构建前端（frontweb） |
| `npm run copy-front` | 将 frontweb/dist 复制到 desktop/frontweb-dist（打包用） |
| `npm run pack` | 构建前端 + 复制 + 打出未压缩目录（便于调试打包结果） |
| `npm run dist` | 构建前端 + 复制 + 打出 Windows 安装包与便携 exe |
| `npm run dist:cn` | 同上，使用国内镜像（Electron、electron-builder 二进制） |

## 依赖

- Node.js >= 18
- 本仓库中的 `backend-node`（打包前通过 `prepare-backend` 复制到 `backend-app`）
- 前端需先执行 `frontweb` 的 `npm run build`，再打包或开发运行
