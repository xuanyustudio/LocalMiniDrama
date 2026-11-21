const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  const values = parseEnv(fs.readFileSync(envPath, 'utf8'));
  if (!String(values.STUDIO_TEXT_API_KEY || '').trim()) {
    throw new Error('没有检测到密钥，请保存后再运行此工具。');
  }
  const base = 'http://127.0.0.1:5679/api/v1/ai-configs';
  const response = await fetch(`${base}?service_type=text`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`读取工作台配置失败（HTTP ${response.status}）。`);
  const result = await response.json();
  const config = (result.data || []).find((item) =>
    item.api_key === 'env:STUDIO_TEXT_API_KEY' &&
    item.base_url === 'https://open.bigmodel.cn/api/paas/v4' &&
    item.default_model === 'glm-4.7-flash'
  );
  if (!config) throw new Error('未找到智谱免费模型配置，请联系协助修复。');
  const updated = await fetch(`${base}/${config.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_default: true }),
    signal: AbortSignal.timeout(5000),
  });
  if (!updated.ok) throw new Error(`启用模型失败（HTTP ${updated.status}）。`);
  console.log('已选择智谱免费文字模型。返回工作台即可使用。');
}

main().catch((error) => {
  const code = error.cause?.code || error.code || error.name;
  if (code === 'ENOENT') console.error('设置未完成。找不到 backend-node/.env，请先保存密钥。');
  else if (code === 'ECONNREFUSED' || code === 'TimeoutError') console.error(`设置未完成。无法连接本机工作台（${code}）。`);
  else if (error.name === 'SyntaxError') console.error('设置未完成。工作台返回了无法解析的配置。');
  else console.error(`设置未完成。${error.message}`);
  process.exitCode = 1;
});
