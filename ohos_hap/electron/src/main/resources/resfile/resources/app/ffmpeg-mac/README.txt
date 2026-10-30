将 macOS 版 ffmpeg 可执行文件放在本目录：
  ffmpeg-mac/ffmpeg
  ffmpeg-mac/ffprobe   （可选，建议一并放入）

推荐使用 evermeet.cx 的静态构建版本，解压后放入此目录，注意需要有可执行权限：
  chmod +x ffmpeg ffprobe

构建 dmg 后，这两个文件会随安装包分发；用户首次启动时自动复制到：
  ~/Library/Application Support/localminidrama-desktop/backend/tools/ffmpeg/
