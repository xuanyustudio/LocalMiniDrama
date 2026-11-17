/**
 * 助手抽屉的异步任务轮询器（从 components/AgentDrawer.vue 抽离，便于 node --test 直接单测）。
 *
 * 修复 #79：原实现只在任务到达 completed/failed 时清除定时器，请求报错、返回空、
 * 任务一直 processing 都会按 3 秒一次的频率无限轮询下去。这里保持同样的轮询节奏与
 * 「拿到终态即返回」的语义，但增加整体时限：到时仍未拿到终态就停止轮询，并回调
 * status: 'timeout'，由调用方决定如何向用户呈现。
 */

export const TASK_WATCH_INTERVAL_MS = 3000

// 整体轮询上限。分镜/角色/场景出图（含批量）正常数分钟内完成；后端重启时会把遗留的
// pending/processing 任务统一标为 failed（taskService.failOrphanedAsyncTasksOnStartup），
// 但进程内卡死的 AI 调用或被清理的任务记录不会到终态。超过时限就停止查询，
// 避免抽屉开着时对本地后端保持每 3 秒一次的无上限请求。
export const TASK_WATCH_MAX_DURATION_MS = 15 * 60 * 1000

export function createTaskWatcher({
  getTask,
  intervalMs = TASK_WATCH_INTERVAL_MS,
  maxDurationMs = TASK_WATCH_MAX_DURATION_MS,
  now = () => Date.now(),
  setInterval: setTimer = (fn, ms) => setInterval(fn, ms),
  clearInterval: clearTimer = (timer) => clearInterval(timer),
} = {}) {
  const timers = new Set()

  function stop(timer) {
    clearTimer(timer)
    timers.delete(timer)
  }

  /**
   * 开始监视一个任务。getTask(taskId) 返回接口响应（兼容 { data } 包裹与裸任务对象）；
   * 拿到终态或超过整体时限时回调一次 onTerminal({ status, task }) 并自动停止轮询。
   */
  function watch(taskId, onTerminal) {
    const startedAt = now()
    const timer = setTimer(async () => {
      let data = null
      try {
        const task = await getTask(taskId)
        data = task?.data ?? task
      } catch (_) {
        /* 瞬时错误下一轮再查，整体时限兜底 */
      }
      if (data && (data.status === 'completed' || data.status === 'failed')) {
        stop(timer)
        onTerminal({ status: data.status, task: data })
        return
      }
      if (now() - startedAt >= maxDurationMs) {
        stop(timer)
        onTerminal({ status: 'timeout' })
      }
    }, intervalMs)
    timers.add(timer)
    return timer
  }

  /** 清掉全部未结束的监视（组件卸载时调用）。 */
  function stopAll() {
    for (const timer of timers) clearTimer(timer)
    timers.clear()
  }

  return { watch, stopAll, size: () => timers.size }
}
