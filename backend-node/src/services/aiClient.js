// 与 Go pkg/ai + application/services/ai_service 对齐：读取 ai_service_configs，调用 OpenAI 兼容的 chat completions
const aiConfigService = require('./aiConfigService');
const https = require('https');
const http = require('http');

/**
 * 用 SSE 流式输出（stream: true）请求 OpenAI 兼容接口。
 * 流式模式下 socket 每收到一个 token 就重置静默计时器，只要模型在生成就不会超时，
 * 彻底解决分镜等长耗时任务的 "fetch failed / timeout" 问题。
 * silenceTimeoutMs：连续多少毫秒无任何数据才判定超时（默认 60 秒）。
 */
function postJSONStream(url, headers, body, silenceTimeoutMs = 60000, onProgress = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    // 强制开启流式输出
    const streamBody = { ...body, stream: true };
    const bodyStr = JSON.stringify(streamBody);
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      ...headers,
    };
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: reqHeaders,
    };

    let silenceTimer = null;
    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        req.destroy();
        reject(new Error(`AI stream silence timeout after ${silenceTimeoutMs}ms`));
      }, silenceTimeoutMs);
    };

    const req = mod.request(options, (res) => {
      const statusCode = res.statusCode;
      // 非 2xx 时先读完整 body 再报错（可能是 JSON 错误信息）
      if (statusCode < 200 || statusCode >= 300) {
        const errChunks = [];
        res.on('data', (c) => errChunks.push(c));
        res.on('end', () => {
          clearTimeout(silenceTimer);
          reject(new Error(`HTTP ${statusCode}: ${Buffer.concat(errChunks).toString('utf-8').slice(0, 200)}`));
        });
        return;
      }

      let accumulated = '';
      let sseBuffer = '';
      let firstToken = true;
      resetSilenceTimer();

      res.on('data', (chunk) => {
        resetSilenceTimer();
        sseBuffer += chunk.toString('utf-8');
        // 按行解析 SSE
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop(); // 保留不完整的最后一行
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const evt = JSON.parse(data);
            const delta = evt.choices?.[0]?.delta?.content;
            if (delta) {
              if (firstToken) {
                firstToken = false;
                if (onProgress) onProgress(0, 'first_token', '');
              }
              accumulated += delta;
              if (onProgress) onProgress(accumulated.length, null, accumulated);
            }
          } catch (_) { /* 忽略无法解析的行 */ }
        }
      });

      res.on('end', () => {
        clearTimeout(silenceTimer);
        resolve({ status: statusCode, body: accumulated });
      });
      res.on('error', (e) => { clearTimeout(silenceTimer); reject(e); });
    });

    req.on('error', (e) => { clearTimeout(silenceTimer); reject(e); });
    resetSilenceTimer(); // 连接建立阶段也需要计时
    req.write(bodyStr);
    req.end();
  });
}

// 使用前端设置的「默认」与「优先级」：listConfigs 已按 is_default DESC, priority DESC 排序
function getDefaultConfig(db, serviceType) {
  const configs = aiConfigService.listConfigs(db, serviceType);
  const active = configs.filter((c) => c.is_active);
  if (active.length === 0) return null;
  const defaultOne = active.find((c) => c.is_default);
  return defaultOne != null ? defaultOne : active[0];
}

function getConfigForModel(db, serviceType, modelName) {
  const configs = aiConfigService.listConfigs(db, serviceType);
  for (const config of configs) {
    if (!config.is_active) continue;
    const models = Array.isArray(config.model) ? config.model : [config.model];
    if (models.includes(modelName)) return config;
  }
  return null;
}

function buildChatUrl(config) {
  const base = (config.base_url || '').replace(/\/$/, '');
  let ep = config.endpoint || '/chat/completions';
  if (!ep.startsWith('/')) ep = '/' + ep;
  return base + ep;
}

function getModelFromConfig(config, preferredModel) {
  const models = Array.isArray(config.model) ? config.model : (config.model != null ? [config.model] : []);
  if (preferredModel && models.includes(preferredModel)) return preferredModel;
  if (config.default_model && models.includes(config.default_model)) return config.default_model;
  return models[0] || 'gpt-3.5-turbo';
}

/**
 * 从 ai_model_map 表查找业务场景对应的模型配置
 * 返回 { config, modelOverride } 或 null（未配置时）
 */
function getConfigFromModelMap(db, sceneKey) {
  try {
    const row = db.prepare('SELECT * FROM ai_model_map WHERE key = ?').get(sceneKey);
    if (!row) return null;
    const configs = aiConfigService.listConfigs(db, row.service_type || 'text');
    let config = null;
    if (row.config_id) {
      config = configs.find((c) => c.id === row.config_id && c.is_active) || null;
    }
    if (!config) {
      config = configs.find((c) => c.is_active && c.is_default) || configs.find((c) => c.is_active) || null;
    }
    return config ? { config, modelOverride: row.model_override || null } : null;
  } catch (_) {
    return null;
  }
}

async function generateText(db, log, serviceType, userPrompt, systemPrompt, options = {}) {
  const { model: preferredModel, temperature = 0.7, json_mode = false, min_max_tokens = null, streamCallback = null, scene_key = null } = options;

  // F2: 若传入 scene_key，优先从 ai_model_map 查找对应的模型路由配置
  let config = null;
  let routedModelOverride = null;
  if (scene_key) {
    const mapped = getConfigFromModelMap(db, scene_key);
    if (mapped) {
      config = mapped.config;
      routedModelOverride = mapped.modelOverride;
      log.info('AI generateText: scene_key routing', { scene_key, config_id: config.id, model_override: routedModelOverride });
    }
  }

  if (!config) {
    config = preferredModel
      ? getConfigForModel(db, serviceType, preferredModel)
      : getDefaultConfig(db, serviceType);
  }
  if (!config && preferredModel === undefined) {
    // 兜底：如果前端传了 undefined，且没找到默认，尝试重新找一下（可能 serviceType 传值问题，或者数据库问题）
    config = getDefaultConfig(db, 'text');
  }
  if (!config) {
    throw new Error(`未配置文本模型，请在「AI 配置」中添加 ${serviceType} 类型 且已启用的配置`);
  }
  // scene_key 路由的模型覆盖优先级 > preferredModel
  const effectivePreferredModel = routedModelOverride || preferredModel;
  const model = getModelFromConfig(config, effectivePreferredModel);
  const url = buildChatUrl(config);

  // 解析 settings 里的 max_tokens 上限（用户在 AI 配置里可设置 {"max_tokens": 8192}）
  let settingsMaxTokens = null;
  try {
    if (config.settings) {
      const s = typeof config.settings === 'string' ? JSON.parse(config.settings) : config.settings;
      if (s && typeof s.max_tokens === 'number' && s.max_tokens > 0) settingsMaxTokens = s.max_tokens;
    }
  } catch (_) {}

  // 最终 max_tokens：优先取调用方传入值，但不超过 settings 里的上限；
  // 若调用方未传，则使用 settings 值（有的话）；两者都没有则不传（让模型用自己默认值）。
  // min_max_tokens：调用方可声明一个最低需求量，确保多集生成等场景不被用户的小上限截断，
  // 此时 finalMaxTokens = max(min_max_tokens, settingsMaxTokens ?? min_max_tokens)。
  let finalMaxTokens = null;
  if (options.max_tokens != null) {
    finalMaxTokens = Number(options.max_tokens);
    if (settingsMaxTokens != null && finalMaxTokens > settingsMaxTokens) {
      log.warn('AI generateText: max_tokens 超过配置上限，已截断', {
        requested: finalMaxTokens, capped_to: settingsMaxTokens, model,
      });
      finalMaxTokens = settingsMaxTokens;
    }
  } else if (settingsMaxTokens != null) {
    finalMaxTokens = settingsMaxTokens;
  }
  // 确保不低于调用方声明的最低需求
  if (min_max_tokens != null) {
    const minVal = Number(min_max_tokens);
    if (finalMaxTokens == null || finalMaxTokens < minVal) {
      if (finalMaxTokens != null) {
        log.warn('AI generateText: max_tokens 低于任务最低需求，已提升', {
          was: finalMaxTokens, raised_to: minVal, model,
        });
      }
      finalMaxTokens = minVal;
    }
  }

  const body = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: userPrompt },
    ],
    temperature: Number(temperature),
    ...(finalMaxTokens != null ? { max_tokens: finalMaxTokens } : {}),
    ...(json_mode ? { response_format: { type: 'json_object' } } : {}),
  };
  const startMs = Date.now();
  log.info('AI generateText request', { url: url.slice(0, 60), model, max_tokens: finalMaxTokens ?? '(model default)', json_mode, stream: true });
  const res = await postJSONStream(url, { Authorization: 'Bearer ' + (config.api_key || '') }, body, 60000, (receivedLen, event, accumulated) => {
    if (event === 'first_token') {
      log.info('AI stream first token', { model, ttft_ms: Date.now() - startMs });
    } else if (receivedLen > 0 && receivedLen % 500 < 20) {
      // 每积累约 500 字符记录一次进度
      log.info('AI stream progress', { model, received_chars: receivedLen, elapsed_ms: Date.now() - startMs });
    }
    // 调用者提供的流式回调（如分镜增量解析），传入当前已积累的完整文本
    if (streamCallback && accumulated) streamCallback(accumulated);
  });
  // 流式模式下 res.body 已是拼接好的完整文本内容（非 JSON）
  const content = res.body;
  const elapsedMs = Date.now() - startMs;
  if (!content) {
    throw new Error('AI 返回内容为空');
  }
  log.info('AI raw response received', { model, text_length: content.length, elapsed_ms: elapsedMs, text_preview: content.slice(0, 200) });
  return content;
}

module.exports = {
  getDefaultConfig,
  getConfigForModel,
  getConfigFromModelMap,
  generateText,
};
