#!/bin/bash
# macOS 打包脚本（完整版 + 纯净版 DMG）
# 用法：在 desktop/ 目录下执行 bash dist-mac.sh
# 或先授权：chmod +x dist-mac.sh && ./dist-mac.sh

set -e

# 使用国内镜像加速 Electron 下载
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://cdn.npmmirror.com/binaries/electron-builder-binaries/"

# 禁用 macOS 代码签名（无证书时跳过签名流程）
export CSC_IDENTITY_AUTO_DISCOVERY=false

# 切换到 desktop 目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========== [1/2] 构建完整版（含示例资源）=========="
echo ""

# 准备后端 + 编译前端 + 复制前端产物 + electron-builder 打包
npm run prepare-backend
npm run build:front
npm run copy-front
npx electron-builder --mac --config electron-builder-mac.json

echo ""
echo "========== [2/2] 构建纯净版（不含示例资源）=========="
echo ""

# 前端/后端已准备好，直接再打一次 lite 包
npx electron-builder --mac --config electron-builder-mac-lite.json

echo ""
echo "========== 全部构建完成 =========="
echo "输出目录：release/"
echo "  完整版（Intel）：LocalMiniDrama-x.x.x-mac-x64.dmg"
echo "  完整版（ARM）  ：LocalMiniDrama-x.x.x-mac-arm64.dmg"
echo "  纯净版（Intel）：LocalMiniDrama-Lite-x.x.x-mac-x64.dmg"
echo "  纯净版（ARM）  ：LocalMiniDrama-Lite-x.x.x-mac-arm64.dmg"
echo ""
