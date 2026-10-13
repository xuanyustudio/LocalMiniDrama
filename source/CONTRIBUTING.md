# 贡献指南 / Contributing Guide

感谢你对 LocalMiniDrama 的关注！无论是报告 Bug、提功能建议，还是贡献代码，都非常欢迎。

> Thank you for your interest in LocalMiniDrama! All forms of contribution are welcome — bug reports, feature suggestions, or code.

---

## 目录 / Table of Contents

- [行为准则](#行为准则--code-of-conduct)
- [报告 Bug](#报告-bug--reporting-bugs)
- [功能建议](#功能建议--feature-requests)
- [贡献代码](#贡献代码--contributing-code)
- [开发环境搭建](#开发环境搭建--development-setup)
- [代码风格](#代码风格--code-style)
- [提交规范](#提交规范--commit-convention)

---

## 行为准则 / Code of Conduct

参与本项目即表示你同意遵守 [行为准则](CODE_OF_CONDUCT.md)。  
By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 报告 Bug / Reporting Bugs

1. 先在 [Issues](../../issues) 搜索确认是否已有相同问题
2. 如果没有，点击 [新建 Issue](../../issues/new/choose) 并选择 **Bug 报告** 模板
3. 尽量填写完整的复现步骤、环境信息和截图

---

## 功能建议 / Feature Requests

1. 在 [Issues](../../issues) 中搜索是否已有相似建议
2. 选择 **功能建议** 模板新建 Issue
3. 描述清楚使用场景，有助于我们评估优先级

---

## 贡献代码 / Contributing Code

### 基本流程

```bash
# 1. Fork 本仓库，然后克隆你的 Fork
git clone https://github.com/你的用户名/LocalMiniDrama.git
cd LocalMiniDrama

# 2. 创建功能分支（从 main 分支切出）
git checkout -b feature/your-feature-name
# 或 bugfix/your-bug-description

# 3. 完成开发并提交
git add .
git commit -m "feat: 简短描述改动"

# 4. 推送分支
git push origin feature/your-feature-name

# 5. 在 GitHub 上创建 Pull Request
```

### PR 要求

- 基于 `main` 分支创建
- 一个 PR 只做一件事，避免混合无关改动
- 填写 PR 模板中的各项信息
- 本地测试通过后再提交

---

## 开发环境搭建 / Development Setup

> 需要 Node.js >= 18 / Requires Node.js >= 18

### 启动后端

```bash
cd backend-node
npm install
cp configs/config.example.yaml configs/config.yaml
# 编辑 config.yaml，填入你的 AI API 配置
npm run migrate   # 首次运行，初始化数据库
npm start         # 默认端口 5679
```

### 启动前端

```bash
cd frontweb
npm install
npm run dev       # 默认端口 3013
```

浏览器访问 `http://localhost:3013`

### 一键启动（Windows）

双击根目录的 `run_dev.bat` 可同时启动前端和后端。

### 桌面端开发（Electron）

```bash
cd desktop
npm install
npm start
```

> Electron 开发需要安装 Python 3 和 Visual Studio C++ 生成工具（用于编译 better-sqlite3）。  
> 详见 [快速开始文档](docs/quickstart.md)。

---

## 代码风格 / Code Style

- **语言**：纯 JavaScript，不使用 TypeScript
- **前端**：Vue 3 Composition API + Element Plus，遵循现有组件结构
- **后端**：Express 路由模块化，保持与 `src/routes/` 现有风格一致
- **命名**：变量/函数使用 camelCase，文件名使用 kebab-case
- **注释**：关键逻辑用中文或英文注释均可

---

## 提交规范 / Commit Convention

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>: <简短描述>

[可选正文]
```

常用类型：

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响逻辑） |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `chore` | 构建/依赖/配置变更 |

示例：
```
feat: 新增批量生成分镜功能
fix: 修复导出 ZIP 时视频文件丢失的问题
docs: 更新 AI 配置指南中的火山引擎配置说明
```

---

再次感谢你的贡献！有任何疑问欢迎在 Issue 中提问或加入微信群交流。  
Thanks again for contributing! Feel free to open an issue or join the WeChat group if you have any questions.
