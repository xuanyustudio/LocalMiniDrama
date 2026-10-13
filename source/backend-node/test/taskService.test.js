const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const taskService = require('../src/services/taskService');

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE async_tasks (
      id TEXT PRIMARY KEY,
      type TEXT,
      status TEXT,
      progress INTEGER DEFAULT 0,
      message TEXT,
      error TEXT,
      result TEXT,
      resource_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      completed_at TEXT,
      deleted_at TEXT
    );
  `);
  return db;
}

describe('taskService.failOrphanedAsyncTasksOnStartup', () => {
  it('marks pending and processing tasks as failed on startup', () => {
    const db = createTestDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO async_tasks (id, type, status, progress, message, resource_id, created_at, updated_at)
       VALUES (?, ?, ?, 0, '', ?, ?, ?)`
    ).run('task-pending', 'background_extraction', 'pending', '42', now, now);
    db.prepare(
      `INSERT INTO async_tasks (id, type, status, progress, message, resource_id, created_at, updated_at)
       VALUES (?, ?, ?, 0, '', ?, ?, ?)`
    ).run('task-processing', 'background_extraction', 'processing', '42', now, now);
    db.prepare(
      `INSERT INTO async_tasks (id, type, status, progress, message, resource_id, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, 100, '', ?, ?, ?, ?)`
    ).run('task-done', 'background_extraction', 'completed', '42', now, now, now);

    const count = taskService.failOrphanedAsyncTasksOnStartup(db, { warn() {}, info() {} });
    assert.equal(count, 2);

    const pending = taskService.getTask(db, 'task-pending');
    const processing = taskService.getTask(db, 'task-processing');
    const done = taskService.getTask(db, 'task-done');

    assert.equal(pending.status, 'failed');
    assert.equal(processing.status, 'failed');
    assert.equal(pending.error, taskService.ORPHAN_ASYNC_TASK_MSG);
    assert.equal(done.status, 'completed');
  });

  it('cancelTask marks active task as failed', () => {
    const db = createTestDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO async_tasks (id, type, status, progress, message, resource_id, created_at, updated_at)
       VALUES (?, ?, ?, 0, '', ?, ?, ?)`
    ).run('task-active', 'background_extraction', 'processing', '42', now, now);

    const result = taskService.cancelTask(db, { info() {} }, 'task-active');
    assert.equal(result.ok, true);
    const task = taskService.getTask(db, 'task-active');
    assert.equal(task.status, 'failed');
    assert.equal(task.error, taskService.USER_CANCEL_TASK_MSG);
  });
});
