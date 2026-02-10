# LocalMiniDrama 后端 (Node.js)

纯 **JavaScript** 后端，与 Go 版 **接口一致**，便于一键切换。

## 环境

- Node.js >= 18

## 安装与运行

```bash
cd backend-node
npm install
cp configs/config.example.yaml configs/config.yaml
# 按需修改 config.yaml（端口建议与 Go 一致 5678，便于前端不改配置）
npm run migrate   # 首次运行：初始化数据库表
npm start         # 启动服务
# 或开发时热重载：
npm run dev
```

## 一键异动（从 Go 切到 Node）

1. **同一端口**：在 `configs/config.yaml` 里把 `server.port` 设为与 Go 相同（如 5679），前端无需改任何代码。
2. **停 Go、启 Node**：
   ```bash
   # 停掉 Go 服务后
   cd backend-node && npm start
   ```
3. **前端开发**：若用 Vite 代理，`vite.config.ts` 里 `proxy['/api'].target` 已是 `http://localhost:5679`，无需改；直接启动 Node 在 5678 即可。
4. **数据库**：Node 使用独立 DB 路径（如 `./data/drama_generator.db`）。若要用 Go 已有数据，把 `config.yaml` 里 `database.path` 指到 Go 的 db 文件（如 `../data/drama.db`），然后只跑一次 `npm run migrate`（若表已存在会跳过或报字段已存在，可忽略重复迁移）。
## 接口与 Go 对齐情况

- **已完整实现**：剧本 CRUD、分页、统计、大纲/角色/集数/进度保存、道具 CRUD 与关联、任务查询、AI 配置 CRUD、设置语言、剧集 finalize/download、分镜列表与生成任务、静态文件 `/static`。
- **桩实现（返回 200/201，可后续替换）**：角色库、角色图片上传/生成、场景/图片/视频/资源/音频等写操作与部分列表，返回空数组或 `task_id`，前端可正常调接口不报错。

响应格式与 Go 一致：`success`、`data`、`error`、`timestamp`；分页为 `items` + `pagination`。

## 目录结构

```
src/
  config/     # 配置加载 (YAML)
  db/         # SQLite 连接与迁移
  services/   # 业务逻辑 (drama, task, prop, aiConfig, episodeStoryboard 等)
  routes/     # 路由 (drama, task, settings, aiConfig, prop, stub)
  response.js # 统一响应
  logger.js   # 日志
  app.js      # Express 应用
  server.js   # 入口
migrations/   # SQL 迁移 (01_init, 02_local_path, 03_async_tasks_frame_prompts)
configs/      # 配置文件
```
