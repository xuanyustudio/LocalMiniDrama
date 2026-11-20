const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const aiConfigs = require('../src/services/aiConfigService');
const aiClient = require('../src/services/aiClient');
const { detectChaptersByRules, importNovel } = require('../src/services/novelImportService');

test('skips a site disclaimer before the first chapter but preserves a story prologue', () => {
  const chapter = '第一章 要案\n天刚亮，警车开往山村，调查人员准备查看刚发生的案件。';
  const disclaimer = '声明：本书为网站用户上传，本站仅提供文件存储服务。\n';
  assert.equal(detectChaptersByRules(disclaimer + chapter)[0].title, '第一章 要案');
  const prologue = '多年前，老兵离开家乡，他的信一直保存在抽屉里，直到今天才被找到。\n';
  assert.equal(detectChaptersByRules(prologue + chapter)[0].title, '序章');
});

test('novel import uses Ollama chat and rejects a truncated draft', async (t) => {
  const model = 'qwen2.5:3b';
  t.mock.method(aiConfigs, 'listConfigs', () => [{
    is_active: true, is_default: true, base_url: 'http://localhost:11434/v1/', model: [model],
  }]);
  const log = { info() {}, warn() {} };
  const options = {
    text: '第一章 要案\n天刚亮，警车开往山村，调查人员准备查看刚发生的案件。',
    title: '测试', maxChapters: 1, aiSummarize: true,
  };
  let doneReason = 'stop';
  const requests = [];
  t.mock.method(http, 'request', (address, onResponse) => {
    const req = new EventEmitter();
    req.write = (data) => requests.push({ address, body: JSON.parse(data) });
    req.end = () => {
      const response = new PassThrough();
      response.statusCode = 200;
      onResponse(response);
      response.end(JSON.stringify({ done_reason: doneReason, message: { content: '场景：山村。\n动作：警车抵达村口。' } }));
    };
    return req;
  });
  const result = await importNovel(null, log, options);
  assert.match(result.chapters[0].script, /警车抵达村口/);
  assert.equal(requests[0].address.path, '/api/chat');
  assert.equal(requests[0].address.hostname, 'localhost');
  assert.equal(requests[0].body.model, model);
  doneReason = 'length';
  await assert.rejects(importNovel(null, log, options), /生成的剧本没有写完/);
});

test('rewrites the actual first chapter and reports model failure', async () => {
  const original = aiClient.generateText;
  const log = { warn() {} };
  const options = {
    text: '声明：本书为网站用户上传，本站仅提供文件存储服务。\n第一章 要案\n天刚亮，警车开往山村，调查人员准备查看刚发生的案件。',
    title: '测试', maxChapters: 1, aiSummarize: true,
  };
  try {
    let prompt;
    aiClient.generateText = async (_db, _log, _type, input) => { prompt = input; return '第一场：调查人员到达山村。'; };
    const result = await importNovel(null, log, options);
    assert.equal(result.chapters[0].title, '第一章 要案');
    assert.match(prompt, /警车开往山村/);
    assert.doesNotMatch(prompt, /本站仅提供/);
    assert.match(result.chapters[0].script, /调查人员/);
    aiClient.generateText = async () => { throw new Error('连接失败'); };
    await assert.rejects(importNovel(null, log, options), /改写失败.*连接失败/);
    aiClient.generateText = async () => Array(4).fill('唐倩：重复出现的动作描述。').join('\n');
    await assert.rejects(importNovel(null, log, options), /生成内容出现大量重复/);
  } finally {
    aiClient.generateText = original;
  }
});
