const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const {
  loadViduReferenceImageBuffer,
  resolveVolcClassicImage,
} = require('../src/services/videoClient');

const fakeLog = { info: () => {}, warn: () => {}, error: () => {} };
const LOCAL_BASE = 'http://127.0.0.1:5679';

/**
 * 创建临时目录，并在其中放一个 FIFO（ref.png），
 * 用子进程模拟"读取缓慢的本地图"：子进程先打开 FIFO 写端（与读取端会合）、
 * 静默保持 holdMs、再写入 payload 并关闭（EOF）。
 * 若实现用同步读取，事件循环会被阻塞到子进程写入并关闭为止；
 * 异步读取则事件循环始终可用。
 */
function makeSlowLocalImage(dir, filename, payload, holdMs) {
  const fifoPath = path.join(dir, filename);
  const mk = spawnSync('mkfifo', [fifoPath]);
  if (mk.status !== 0) return null;
  const child = spawn(
    'sh',
    ['-c', `exec 3>'${fifoPath}'; sleep ${holdMs / 1000}; printf '${payload}' >&3; exec 3>&-`],
    { stdio: 'ignore' }
  );
  return { fifoPath, child };
}

/**
 * 断言 readFn 在本地文件读取 pending 期间不阻塞事件循环：
 * 50ms 定时器必须在读取完成（子进程 ~250ms 后才写入并关闭写端）之前触发。
 */
async function assertEventLoopResponsiveWhileReading(t, dir, filename, readFn) {
  const ctx = makeSlowLocalImage(dir, filename, 'hello', 250);
  if (!ctx) {
    t.skip('mkfifo unavailable');
    return null;
  }

  let timerFiredAt = 0;
  setTimeout(() => {
    timerFiredAt = Date.now();
  }, 50);

  const pending = readFn(ctx.fifoPath);
  const result = await pending;
  const doneAt = Date.now();

  ctx.child.kill('SIGKILL');
  assert.ok(
    timerFiredAt > 0 && timerFiredAt < doneAt,
    `event loop must stay responsive while the local image read is pending (timerFiredAt=${timerFiredAt}, doneAt=${doneAt})`
  );
  return result;
}

describe('videoClient local image reads do not block the event loop', () => {
  it('resolveVolcClassicImage: slow local image does not block the loop', { skip: process.platform === 'win32' }, async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmd-storage-'));
    try {
      const result = await assertEventLoopResponsiveWhileReading(t, dir, 'ref.png', (fifoPath) =>
        resolveVolcClassicImage(`${LOCAL_BASE}/static/ref.png`, LOCAL_BASE, dir, fakeLog, 1, 'first_frame')
      );
      assert.equal(result, 'data:image/png;base64,' + Buffer.from('hello').toString('base64'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadViduReferenceImageBuffer: slow local image does not block the loop', { skip: process.platform === 'win32' }, async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmd-storage-'));
    try {
      const result = await assertEventLoopResponsiveWhileReading(t, dir, 'ref.png', (fifoPath) =>
        loadViduReferenceImageBuffer(`${LOCAL_BASE}/static/ref.png`, null, dir, fakeLog, 1)
      );
      assert.ok(Buffer.isBuffer(result));
      assert.equal(result.toString(), 'hello');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolveVolcClassicImage: regular local file still resolves to base64 data URL', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmd-storage-'));
    try {
      fs.writeFileSync(path.join(dir, 'ok.png'), 'hello');
      const result = await resolveVolcClassicImage(`${LOCAL_BASE}/static/ok.png`, LOCAL_BASE, dir, fakeLog, 1, 'first_frame');
      assert.equal(result, 'data:image/png;base64,' + Buffer.from('hello').toString('base64'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolveVolcClassicImage: missing local file falls back to the original URL', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmd-storage-'));
    try {
      const result = await resolveVolcClassicImage(`${LOCAL_BASE}/static/missing.png`, LOCAL_BASE, dir, fakeLog, 1, 'first_frame');
      assert.equal(result, `${LOCAL_BASE}/static/missing.png`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loadViduReferenceImageBuffer: missing local file falls back to fetch (returns null without server)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmd-storage-'));
    try {
      const result = await loadViduReferenceImageBuffer(`${LOCAL_BASE}/static/missing.png`, null, dir, fakeLog, 1);
      assert.equal(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
