const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyDeepSeekChatOptions,
  isDeepSeekOfficialConfig,
} = require('../src/services/deepseekConfig');

function baseBody(model) {
  return {
    model,
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 0.7,
    max_tokens: 5,
  };
}

test('detects official DeepSeek configs by provider or base URL', () => {
  assert.equal(isDeepSeekOfficialConfig({ provider: 'deepseek' }), true);
  assert.equal(isDeepSeekOfficialConfig({ base_url: 'https://api.deepseek.com' }), true);
  assert.equal(isDeepSeekOfficialConfig({ provider: 'xy', base_url: 'https://api.302.ai/v1' }), false);
});

test('maps deprecated deepseek-chat to deepseek-v4-flash non-thinking mode', () => {
  const body = applyDeepSeekChatOptions(
    { provider: 'deepseek', base_url: 'https://api.deepseek.com' },
    baseBody('deepseek-chat')
  );

  assert.equal(body.model, 'deepseek-v4-flash');
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.reasoning_effort, undefined);
  assert.equal(body.temperature, 0.7);
});

test('maps deprecated deepseek-reasoner to deepseek-v4-flash thinking mode', () => {
  const body = applyDeepSeekChatOptions(
    { provider: 'deepseek', base_url: 'https://api.deepseek.com' },
    baseBody('deepseek-reasoner')
  );

  assert.equal(body.model, 'deepseek-v4-flash');
  assert.deepEqual(body.thinking, { type: 'enabled' });
  assert.equal(body.temperature, undefined);
});

test('applies explicit DeepSeek thinking settings for V4 models', () => {
  const body = applyDeepSeekChatOptions(
    {
      provider: 'deepseek',
      base_url: 'https://api.deepseek.com',
      settings: JSON.stringify({
        deepseek_thinking: 'enabled',
        deepseek_reasoning_effort: 'max',
      }),
    },
    baseBody('deepseek-v4-pro')
  );

  assert.equal(body.model, 'deepseek-v4-pro');
  assert.deepEqual(body.thinking, { type: 'enabled' });
  assert.equal(body.reasoning_effort, 'max');
  assert.equal(body.temperature, undefined);
});
