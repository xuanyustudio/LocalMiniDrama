const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createAgentTestDb, seedTwoDramas } = require('./helpers/agentTestDb');

// 本地假 OpenAI 兼容端点：按调用次序回放脚本，不需要真实 AI key。
// 次序：删除分镜（挂起等审批）→ 恢复运行后再调一次需要集的工具 → 收尾文本。
function startModelMock() {
  const modelCalls = [];
  const chunk = (delta, finish) => ({ id: 'c1', object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: finish }] });
  const toolCall = (id, name, args) => chunk(
    { tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] },
    null
  );
  const script = [
    [toolCall('call-1', 'delete_item', { type: 'storyboard', id: 1 }), chunk({}, 'tool_calls')],
    [toolCall('call-2', 'save_episode_script', { title: '第二集', script: 'RESTORED-SCRIPT' }), chunk({}, 'tool_calls')],
    [chunk({ content: '处理完成' }, null), chunk({}, 'stop')],
  ];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const idx = modelCalls.length;
      modelCalls.push(req.url);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      for (const part of script[Math.min(idx, script.length - 1)]) res.write(`data: ${JSON.stringify(part)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  return { server, modelCalls };
}

describe('agent approval scope', () => {
  it('restores the episode scope of the run resumed by approve', async () => {
    const mastra = await import('../src/mastra/index.mjs');
    const { server, modelCalls } = startModelMock();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmd-approval-'));
    try {
      const db = createAgentTestDb();
      seedTwoDramas(db);
      db.prepare(
        `INSERT INTO ai_service_configs (service_type, base_url, api_key, model, is_default, is_active)
         VALUES ('text', ?, 'test-key', 'mock-model', 1, 1)`
      ).run(`http://127.0.0.1:${server.address().port}/v1`);

      await mastra.initAgent({ db, log: { warn() {} }, config: {}, dataDir });
      assert.equal(mastra.isAgentReady(), true);

      const chatEvents = [];
      await mastra.streamChat({
        dramaId: 1,
        episodeId: 11,
        message: '请删除分镜1',
        writeEvent: (event) => chatEvents.push(event),
      });
      const approval = chatEvents.find((event) => event.type === 'tool-call-approval');
      assert.ok(approval, 'delete_item 应挂起等待审批');
      assert.equal(approval.toolName, 'delete_item');
      assert.ok(approval.runId, '审批事件应带 runId');
      assert.ok(approval.toolCallId, '审批事件应带 toolCallId');

      const resumeEvents = [];
      await mastra.resumeApproval({
        dramaId: 1,
        episodeId: 11,
        runId: approval.runId,
        toolCallId: approval.toolCallId,
        approved: true,
        writeEvent: (event) => resumeEvents.push(event),
      });

      const deleted = db.prepare('SELECT deleted_at FROM storyboards WHERE id = 1').get();
      assert.ok(deleted.deleted_at, '批准后 delete_item 应已执行');

      // 恢复的运行里模型再调一次需要“当前集”的工具：作用域必须还在第 11 集
      const probe = resumeEvents.find(
        (event) => event.type === 'tool-result' && event.toolName === 'save_episode_script'
      );
      assert.ok(probe, '恢复的运行应执行 save_episode_script');
      assert.equal(probe.ok, true);
      const episode11 = db.prepare('SELECT script_content FROM episodes WHERE id = 11').get();
      const episode12 = db.prepare('SELECT script_content FROM episodes WHERE id = 12').get();
      assert.equal(episode11.script_content, 'RESTORED-SCRIPT');
      assert.equal(episode12.script_content, '甲二剧本');
      assert.equal(modelCalls.length, 3);
    } finally {
      server.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
