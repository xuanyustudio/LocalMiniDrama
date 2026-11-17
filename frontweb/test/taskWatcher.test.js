import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createTaskWatcher,
  TASK_WATCH_INTERVAL_MS,
  TASK_WATCH_MAX_DURATION_MS,
} from '../src/utils/taskWatcher.js'

// 手工时钟：advance 推进到目标时刻，途中到点的定时器逐个触发并等待其异步回调结束，
// 使「轮询 → 终态/超时 → 清定时器」按真实次序发生。
function makeClock() {
  let now = 0
  let seq = 0
  const timers = new Map()
  const nextFire = new Map()
  const clock = {
    now: () => now,
    setInterval: (fn, ms) => {
      const id = ++seq
      timers.set(id, { fn, ms })
      nextFire.set(id, now + ms)
      return id
    },
    clearInterval: (id) => {
      timers.delete(id)
      nextFire.delete(id)
    },
    advance: async (ms) => {
      const target = now + ms
      for (;;) {
        let due = null
        for (const [id, fireAt] of nextFire) {
          if (fireAt <= target && (!due || fireAt < due.fireAt)) due = { id, fireAt }
        }
        if (!due) break
        now = due.fireAt
        const timer = timers.get(due.id)
        if (!timer) break
        nextFire.set(due.id, due.fireAt + timer.ms)
        await timer.fn()
      }
      now = target
    },
  }
  return clock
}

function makeWatcher(clock, getTask, overrides = {}) {
  return createTaskWatcher({
    getTask,
    now: clock.now,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    ...overrides,
  })
}

test('轮询间隔与整体上限常量', () => {
  assert.equal(TASK_WATCH_INTERVAL_MS, 3000)
  assert.equal(TASK_WATCH_MAX_DURATION_MS, 15 * 60 * 1000)
})

test('任务到 completed 终态后停止轮询并回调任务数据', async () => {
  const clock = makeClock()
  let polls = 0
  const responses = [
    { status: 'processing' },
    { status: 'processing' },
    { status: 'completed', result: JSON.stringify({ image_url: 'a.png', count: 2 }) },
  ]
  const watcher = makeWatcher(clock, async () => ({
    data: responses[Math.min(polls++, responses.length - 1)],
  }))
  const seen = []
  watcher.watch('t1', (event) => seen.push(event))

  await clock.advance(TASK_WATCH_INTERVAL_MS * 3)
  assert.equal(polls, 3)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].status, 'completed')
  assert.ok(String(seen[0].task.result).includes('image_url'))
  assert.equal(watcher.size(), 0)

  const after = polls
  await clock.advance(TASK_WATCH_INTERVAL_MS * 5)
  assert.equal(polls, after)
  assert.equal(seen.length, 1)
})

test('任务到 failed 终态后停止轮询并回调错误', async () => {
  const clock = makeClock()
  let polls = 0
  const watcher = makeWatcher(clock, async () => ({
    data: polls++ === 0 ? { status: 'processing' } : { status: 'failed', error: 'boom' },
  }))
  const seen = []
  watcher.watch('t1', (event) => seen.push(event))

  await clock.advance(TASK_WATCH_INTERVAL_MS * 2)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].status, 'failed')
  assert.equal(seen[0].task.error, 'boom')
  assert.equal(watcher.size(), 0)
})

test('兼容未包裹 data 的裸任务响应', async () => {
  const clock = makeClock()
  let polls = 0
  const watcher = makeWatcher(clock, async () => {
    polls += 1
    return { status: 'completed', result: '{}' }
  })
  const seen = []
  watcher.watch('t1', (event) => seen.push(event))

  await clock.advance(TASK_WATCH_INTERVAL_MS)
  assert.equal(polls, 1)
  assert.equal(seen[0].status, 'completed')
})

test('一直 processing：按整体上限停止轮询并回调 timeout（#79 回归）', async () => {
  const clock = makeClock()
  let polls = 0
  const watcher = makeWatcher(clock, async () => {
    polls += 1
    return { status: 'processing' }
  })
  const seen = []
  watcher.watch('t1', (event) => seen.push(event))

  // 上限内保持每 3 秒一次轮询，不提前放弃
  await clock.advance(TASK_WATCH_MAX_DURATION_MS - TASK_WATCH_INTERVAL_MS)
  assert.equal(seen.length, 0)
  assert.equal(polls, (TASK_WATCH_MAX_DURATION_MS - TASK_WATCH_INTERVAL_MS) / TASK_WATCH_INTERVAL_MS)

  // 到达上限：停止轮询并回调一次 timeout
  await clock.advance(TASK_WATCH_INTERVAL_MS)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].status, 'timeout')
  assert.equal(watcher.size(), 0)

  // 之后不再发请求
  const after = polls
  await clock.advance(TASK_WATCH_INTERVAL_MS * 10)
  assert.equal(polls, after)
  assert.equal(seen.length, 1)
})

test('接口持续报错同样受整体上限约束（#79 回归）', async () => {
  const clock = makeClock()
  let polls = 0
  const watcher = makeWatcher(clock, async () => {
    polls += 1
    throw new Error('boom')
  })
  const seen = []
  watcher.watch('t1', (event) => seen.push(event))

  await clock.advance(TASK_WATCH_MAX_DURATION_MS + TASK_WATCH_INTERVAL_MS)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].status, 'timeout')
  assert.equal(polls, TASK_WATCH_MAX_DURATION_MS / TASK_WATCH_INTERVAL_MS)
  assert.equal(watcher.size(), 0)

  const after = polls
  await clock.advance(TASK_WATCH_INTERVAL_MS * 10)
  assert.equal(polls, after)
})

test('返回空同样受整体上限约束（#79 回归）', async () => {
  const clock = makeClock()
  let polls = 0
  const watcher = makeWatcher(clock, async () => {
    polls += 1
    return null
  })
  const seen = []
  watcher.watch('t1', (event) => seen.push(event))

  await clock.advance(TASK_WATCH_MAX_DURATION_MS + TASK_WATCH_INTERVAL_MS)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].status, 'timeout')
  assert.equal(polls, TASK_WATCH_MAX_DURATION_MS / TASK_WATCH_INTERVAL_MS)
})

test('到时限那一轮拿到终态则按终态回调，不误报 timeout', async () => {
  const clock = makeClock()
  let polls = 0
  const responses = Array.from({ length: TASK_WATCH_MAX_DURATION_MS / TASK_WATCH_INTERVAL_MS - 1 }, () => ({
    status: 'processing',
  }))
  responses.push({ status: 'completed', result: '{}' })
  const watcher = makeWatcher(clock, async () => ({
    data: responses[Math.min(polls++, responses.length - 1)],
  }))
  const seen = []
  watcher.watch('t1', (event) => seen.push(event))

  await clock.advance(TASK_WATCH_MAX_DURATION_MS)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].status, 'completed')
  assert.equal(watcher.size(), 0)
})

test('stopAll 清掉全部未结束的监视（组件卸载路径）', async () => {
  const clock = makeClock()
  let polls = 0
  const watcher = makeWatcher(clock, async () => {
    polls += 1
    return { status: 'processing' }
  })
  const seen = []
  watcher.watch('t1', (event) => seen.push(event))
  watcher.watch('t2', (event) => seen.push(event))
  assert.equal(watcher.size(), 2)

  watcher.stopAll()
  assert.equal(watcher.size(), 0)

  await clock.advance(TASK_WATCH_INTERVAL_MS * 3)
  assert.equal(polls, 0)
  assert.equal(seen.length, 0)
})
