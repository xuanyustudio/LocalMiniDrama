# LocalMiniDrama OpenClaw Skill

让用户通过 OpenClaw（小龙虾）自然语言控制 LocalMiniDrama，完成 AI 短剧从剧本到成片的全流程。

## 版本

`1.1.0` — 完整覆盖后端 API，修复路径前缀，新增角色/场景/道具/AI配置/工程导入导出/小说导入等能力。

## 安装

### 方式一：本地安装

```bash
# 复制到 OpenClaw workspace skills 目录
cp -r ./openclaw-skill ~/.openclaw/workspace/skills/local-mini-drama
```

### 方式二：发布到 SkillHub / ClawHub（后续）

```bash
skillhub publish ./openclaw-skill
```

## 配置

### 云服务器用户

```bash
openclaw skill config local-mini-drama --set base_url=http://你的服务器IP:5679
```

### 本地电脑用户（需内网穿透）

```bash
# 假设你用 cpolar 绑定了 localhost:5679
openclaw skill config local-mini-drama --set base_url=https://xxx.cpolar.io
```

### 可选配置

```bash
# 默认画面比例（16:9 横屏 / 9:16 竖屏 / 1:1 方形）
openclaw skill config local-mini-drama --set default_aspect_ratio=9:16

# 默认单个视频片段时长（秒）
openclaw skill config local-mini-drama --set default_video_duration=5
```

## 使用方法

在 OpenClaw 中对话即可触发：

| 用户输入 | 触发动作 |
|---------|---------|
| "帮我创建一个仙侠短剧" | 创建项目 + 流式生成剧本 |
| "生成一个都市爱情短剧，讲述..." | 完整流程：创建+剧本+角色+分镜+图片+视频 |
| "生成本集分镜" | 为当前集数生成分镜 |
| "批量生成图片" | 批量出图 |
| "批量生成视频" | 批量出视频 |
| "合成这集视频" | 触发视频合成 |
| "这集做好了吗" | 查询合成进度 |
| "给李逍遥生成一张图" | 生成角色形象图 |
| "导出这个工程" | 导出 ZIP |
| "我有篇小说，帮我制作短剧" | 小说导入 + 生成 |
| "配置一下通义千问" | AI 配置管理 |

## API 覆盖范围（v1.1.0）

| 模块 | 覆盖情况 |
|------|---------|
| 剧集（Drama）CRUD | ✅ 完整 |
| 剧本生成（流式/非流式）| ✅ 完整 |
| 角色管理 + 生成 | ✅ 完整 |
| 场景管理 + 生成 | ✅ 完整 |
| 道具管理 + 生成 | ✅ 完整 |
| 分镜生成 + 管理 | ✅ 完整 |
| 图片生成 | ✅ 完整 |
| 视频生成 | ✅ 完整 |
| 视频合成 | ✅ 完整 |
| 工程导入导出 | ✅ 完整 |
| 小说导入 | ✅ 完整 |
| AI 配置管理 | ✅ 完整 |
| 全局设置 | ✅ 完整 |
| 角色库/场景库/道具库 | ✅ 完整 |
| 内容改良（翻译/原创/混剪）| ✅ 完整 |
| 异步任务查询 | ✅ 完整 |

## 文件结构

```
openclaw-skill/
├── SKILL.md       # Skill 主文件（包含 YAML frontmatter 和完整 API 指令）
├── skill.json     # Manifest 清单
├── tools.json     # 工具定义
└── README.md      # 本说明文件
```

## 与 v1.0.0 的主要变化

1. **修复 API 路径**：所有路径补全 `/api/v1` 前缀
2. **新增 trigger 词**：从 5 个扩展到 30+ 个
3. **新增 AI 配置管理**：支持配置/测试/预设 API Key
4. **新增角色/场景/道具库**：全局素材库管理
5. **新增工程导入导出**：ZIP 工程文件
6. **新增小说导入**：从小说文本自动生成剧集结构
7. **新增分镜高级操作**：优化提示词、超分、帧提示词、批量推断摄影参数
8. **新增内容改良**：一键翻译出海、原创化、混剪
9. **完善异步任务轮询策略**：明确轮询间隔和超时处理
10. **新增 skill 配置项**：`default_aspect_ratio`、`default_video_duration`
