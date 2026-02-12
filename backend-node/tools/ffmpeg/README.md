# FFmpeg 本地目录

将 ffmpeg 可执行文件放在此目录下，后端会优先使用，**无需配置环境变量**。

## 需要拷贝的文件（Windows）

- `ffmpeg.exe`
- `ffprobe.exe`（若需要探测时长等信息）

从 FFmpeg 官方构建目录的 `bin` 下复制到本目录即可。

## 一键拷贝（可选）

若你的 ffmpeg 在 `D:\Program Files\ffmpeg-8.0.1-essentials_build\bin`，可在 **backend-node** 目录下执行：

```bash
node scripts/copy-ffmpeg.js "D:\Program Files\ffmpeg-8.0.1-essentials_build\bin"
```

会复制 `ffmpeg.exe` 和 `ffprobe.exe` 到本目录。

## 路径优先级

1. 本目录下的 `ffmpeg`（或 Windows 下 `ffmpeg.exe`）
2. 环境变量 `FFMPEG_PATH`（若已设置）
3. 系统 PATH 中的 `ffmpeg`
