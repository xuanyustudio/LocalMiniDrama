#!/usr/bin/env bash
# 一键启动开发环境（后台运行）：后端 (backend-node:5679) + 前端 (frontweb:3013)
# 用法:
#   ./run_dev.sh          后台启动服务
#   ./run_dev.sh stop     停止后台服务
#   ./run_dev.sh status   查看运行状态
# 日志: logs/dev.log，滚动保留最多 5 个文件，单文件最大 50M
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend-node"
FRONTEND_DIR="$ROOT/frontweb"
LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/dev.log"
PID_FILE="$LOG_DIR/run_dev.pids"
MAX_LOG_SIZE=$((50 * 1024 * 1024))
MAX_LOG_FILES=5

# 按大小滚动日志：dev.log -> dev.log.1 -> ... -> dev.log.4（共 5 个文件）
# 采用「复制 + 清空」而非改名，保证已打开追加写句柄的进程继续写入新文件
rotate_logs() {
  [ -f "$LOG_FILE" ] || return 0
  local size
  size=$(wc -c < "$LOG_FILE" | tr -d ' ')
  [ "$size" -lt "$MAX_LOG_SIZE" ] && return 0

  local last=$((MAX_LOG_FILES - 1))
  [ -f "$LOG_FILE.$last" ] && rm -f "$LOG_FILE.$last"
  local i
  for ((i = last - 1; i >= 1; i--)); do
    [ -f "$LOG_FILE.$i" ] && mv -f "$LOG_FILE.$i" "$LOG_FILE.$((i + 1))"
  done
  cp -f "$LOG_FILE" "$LOG_FILE.1" 2>/dev/null || true
  : > "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 日志已滚动，当前文件超过 $((MAX_LOG_SIZE / 1024 / 1024))M" >> "$LOG_FILE"
}

# 结束某个进程组（后台任务以 set -m 启动，pid 即进程组 id）
kill_group() {
  local pid="$1"
  [ -z "$pid" ] && return 0
  kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
}

stop_services() {
  if [ ! -f "$PID_FILE" ]; then
    echo "未找到后台服务记录，可能尚未启动"
    return 0
  fi
  local BACKEND_PID="" FRONTEND_PID="" ROTATOR_PID=""
  read -r BACKEND_PID FRONTEND_PID ROTATOR_PID < "$PID_FILE" || true

  echo "==> 正在停止后台服务..."
  kill_group "$ROTATOR_PID"
  kill_group "$BACKEND_PID"
  kill_group "$FRONTEND_PID"

  local i
  for i in $(seq 1 10); do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  kill -KILL -"$BACKEND_PID" 2>/dev/null || true
  kill -KILL -"$FRONTEND_PID" 2>/dev/null || true

  rm -f "$PID_FILE"
  echo "==> 已停止"
}

show_status() {
  if [ ! -f "$PID_FILE" ]; then
    echo "服务未运行"
    return 0
  fi
  local BACKEND_PID="" FRONTEND_PID="" ROTATOR_PID=""
  read -r BACKEND_PID FRONTEND_PID ROTATOR_PID < "$PID_FILE" || true
  local name pid
  for name in BACKEND FRONTEND; do
    pid="${name}_PID"
    if kill -0 "${!pid}" 2>/dev/null; then
      echo "$name: 运行中 (pid ${!pid})"
    else
      echo "$name: 已停止"
    fi
  done
  echo "日志: $LOG_FILE"
}

start_services() {
  command -v node >/dev/null 2>&1 || { echo "错误: 未找到 node，请先安装 Node.js (>=18)"; exit 1; }
  command -v npm >/dev/null 2>&1 || { echo "错误: 未找到 npm"; exit 1; }

  if [ -f "$PID_FILE" ]; then
    local BACKEND_PID="" FRONTEND_PID="" ROTATOR_PID=""
    read -r BACKEND_PID FRONTEND_PID ROTATOR_PID < "$PID_FILE" || true
    if kill -0 "$BACKEND_PID" 2>/dev/null || kill -0 "$FRONTEND_PID" 2>/dev/null; then
      echo "服务已在后台运行，如需重启请先执行: $0 stop"
      exit 0
    fi
    rm -f "$PID_FILE"
  fi

  for dir in "$BACKEND_DIR" "$FRONTEND_DIR"; do
    if [ ! -d "$dir/node_modules" ]; then
      echo "==> 首次运行，正在安装依赖: $(basename "$dir")"
      (cd "$dir" && npm install)
    fi
  done

  # 释放被占用端口
  free_port() {
    local port="$1"
    local pids
    pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "==> 端口 $port 被占用，正在结束进程: $pids"
      kill $pids 2>/dev/null || true
      sleep 1
    fi
  }
  free_port 5679

  mkdir -p "$LOG_DIR"

  # 开启作业控制，使每个后台任务拥有独立进程组，便于整体停止
  set -m

  {
    echo ""
    echo "==================== $(date '+%Y-%m-%d %H:%M:%S') 启动开发环境 ===================="
  } >> "$LOG_FILE"

  echo "==> 后台启动后端 (http://127.0.0.1:5679)"
  nohup sh -c "cd '$BACKEND_DIR' && exec npm run dev" >> "$LOG_FILE" 2>&1 < /dev/null &
  local backend_pid=$!

  echo "==> 后台启动前端 (http://127.0.0.1:3013)"
  nohup sh -c "cd '$FRONTEND_DIR' && exec npm run dev" >> "$LOG_FILE" 2>&1 < /dev/null &
  local frontend_pid=$!

  # 日志滚动 + 存活监控：服务全部退出后自动清理
  (
    while kill -0 "$backend_pid" 2>/dev/null || kill -0 "$frontend_pid" 2>/dev/null; do
      sleep 5
      rotate_logs
    done
    rm -f "$PID_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 后端与前端均已退出" >> "$LOG_FILE"
  ) &
  local rotator_pid=$!

  echo "$backend_pid $frontend_pid $rotator_pid" > "$PID_FILE"

  echo ""
  echo "服务已在后台启动"
  echo "  后端: http://127.0.0.1:5679"
  echo "  前端: http://127.0.0.1:3013"
  echo "  日志: $LOG_FILE (最多 $MAX_LOG_FILES 个文件，单个上限 $((MAX_LOG_SIZE / 1024 / 1024))M)"
  echo "  查看: tail -f $LOG_FILE"
  echo "  停止: $0 stop"
}

case "${1:-start}" in
  start) start_services ;;
  stop) stop_services ;;
  status) show_status ;;
  *) echo "用法: $0 [start|stop|status]"; exit 1 ;;
esac
