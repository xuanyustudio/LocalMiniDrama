const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const STUDIO_TEXT_KEY_REF = 'env:STUDIO_TEXT_API_KEY';
const FREE_MODEL = 'glm-4.7-flash';

function resolveStudioTextKey(config, model, requestUrl) {
  const value = config.api_key || '';
  if (value !== STUDIO_TEXT_KEY_REF) return value;

  let url;
  try { url = new URL(requestUrl); } catch { throw new Error('智谱文字模型地址无效'); }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'open.bigmodel.cn' ||
      (url.port && url.port !== '443') || url.username || url.password) {
    throw new Error('本地密钥只能用于智谱官方 HTTPS 地址');
  }
  if (String(model || '').trim().toLowerCase() !== FREE_MODEL) {
    throw new Error('本地密钥仅配置为使用免费模型 glm-4.7-flash');
  }
  let env;
  try {
    env = parseEnv(fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('尚未在 backend-node/.env 中配置 STUDIO_TEXT_API_KEY');
    throw new Error('无法读取 backend-node/.env，请检查文件编码和权限');
  }
  const key = String(env.STUDIO_TEXT_API_KEY || '').trim();
  if (!key) throw new Error('尚未在 backend-node/.env 中配置 STUDIO_TEXT_API_KEY');
  return key;
}

function applyStudioTextOptions(config, body) {
  if (config.api_key !== STUDIO_TEXT_KEY_REF) return body;
  return { ...body, thinking: { type: 'disabled' } };
}

function redactStudioTextError(error, key, isEnvKey) {
  if (!isEnvKey || !key) return error;
  const message = String(error?.message || error);
  return new Error(message.split(key).join('[已隐藏]'));
}

module.exports = { STUDIO_TEXT_KEY_REF, resolveStudioTextKey, applyStudioTextOptions, redactStudioTextError };
