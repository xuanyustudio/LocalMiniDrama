const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createAgentHandlers } = require('../src/routes/agent');
const { createAgentTestDb, seedTwoDramas } = require('./helpers/agentTestDb');

describe('agent sse', () => {
  it('maps known chunks and ignores unknown ones', async () => {
    const { toAgentSseEvent } = await import('../src/mastra/sse.mjs');
    assert.deepEqual(toAgentSseEvent({ type: 'text-delta', textDelta: '你' }), { type: 'text-delta', text: '你' });
    assert.deepEqual(toAgentSseEvent({ type: 'text-delta', payload: { text: '好' } }), { type: 'text-delta', text: '好' });
    assert.equal(toAgentSseEvent({ type: 'unknown' }), null);
  });
});

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    writableEnded: false,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
    write() { return true; },
    end() { this.writableEnded = true; },
  };
}

describe('agent routes', () => {
  it('answers before the assistant is ready and keeps drama checks', async () => {
    const db = createAgentTestDb();
    seedTwoDramas(db);
    const calls = [];
    const runtime = {
      isAgentReady: () => false,
      streamChat: async () => calls.push('stream'),
      resumeApproval: async () => calls.push('resume'),
      getHistory: async () => ({ messages: [], pendingApprovals: [] }),
    };
    const handlers = createAgentHandlers(db, console, runtime);
    const closed = mockRes();
    await handlers.chat({ body: { dramaId: 1, message: '你好' } }, closed);
    assert.equal(closed.statusCode, 503);
    assert.equal(closed.body.error.message, '助手未就绪');
    assert.deepEqual(calls, []);

    const ready = {
      ...runtime,
      isAgentReady: () => true,
    };
    const open = createAgentHandlers(db, console, ready);
    const missing = mockRes();
    await open.chat({ body: { dramaId: 99, message: '你好' } }, missing);
    assert.equal(missing.statusCode, 400);
    assert.equal(missing.body.error.message, '项目不存在');

    const noModel = mockRes();
    await open.chat({ body: { dramaId: 1, message: '你好' } }, noModel);
    assert.equal(noModel.statusCode, 400);
    assert.equal(noModel.body.error.message, '请先在 AI 配置里添加文本模型');

    const declined = mockRes();
    await open.approve({ body: { dramaId: 1, runId: 'other-run', toolCallId: 'call-1' } }, declined);
    assert.equal(declined.statusCode, 404);
    assert.deepEqual(calls, []);

    const historyRuntime = {
      isAgentReady: () => true,
      getHistory: async () => ({ messages: [], pendingApprovals: [{ runId: 'run-1', toolCallId: 'call-1' }] }),
    };
    const listed = mockRes();
    await createAgentHandlers(db, console, historyRuntime).history({ query: { dramaId: '1' } }, listed);
    assert.equal(listed.body.data.pendingApprovals[0].runId, 'run-1');
  });

  it('passes a validated episodeId to resumeApproval on approve/decline', async () => {
    const db = createAgentTestDb();
    seedTwoDramas(db);
    const seen = [];
    const runtime = {
      isAgentReady: async () => true,
      getHistory: async () => ({ messages: [], pendingApprovals: [{ runId: 'run-1', toolCallId: 'call-1' }] }),
      resumeApproval: async (args) => { seen.push(args); },
    };
    const handlers = createAgentHandlers(db, console, runtime);

    const ok = mockRes();
    await handlers.approve({ body: { dramaId: 1, episodeId: 11, runId: 'run-1', toolCallId: 'call-1' } }, ok);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].dramaId, 1);
    assert.equal(seen[0].episodeId, 11);

    const foreign = mockRes();
    await handlers.approve({ body: { dramaId: 1, episodeId: 13, runId: 'run-1', toolCallId: 'call-1' } }, foreign);
    assert.equal(foreign.statusCode, 400);
    assert.equal(foreign.body.error.message, '这一集不属于当前项目');
    assert.equal(seen.length, 1);

    const noEpisode = mockRes();
    await handlers.approve({ body: { dramaId: 1, runId: 'run-1', toolCallId: 'call-1' } }, noEpisode);
    assert.equal(seen.length, 2);
    assert.equal(seen[1].episodeId, null);

    const declined = mockRes();
    await handlers.decline({ body: { dramaId: 1, episodeId: 11, runId: 'run-1', toolCallId: 'call-1' } }, declined);
    assert.equal(seen.length, 3);
    assert.equal(seen[2].episodeId, 11);
  });

  it('ships the short-drama skill and copies the skills folder', () => {
    const skill = fs.readFileSync(path.join(__dirname, '../skills/short-drama/SKILL.md'), 'utf8');
    assert.match(skill, /name: short-drama/);
    for (const name of [
      'get_current_project', 'generate_story', 'save_episode_script', 'generate_characters',
      'update_character', 'generate_scenes', 'update_scene', 'generate_storyboards',
      'update_storyboard', 'generate_image', 'get_task', 'delete_item',
    ]) {
      assert.match(skill, new RegExp(name));
    }
    assert.match(skill, /没有出视频、导入导出、道具、新建或删除整部剧的工具/);
    const copy = fs.readFileSync(path.join(__dirname, '../../desktop/scripts/copy-backend.js'), 'utf8');
    assert.match(copy, /'skills'/);
  });
});
