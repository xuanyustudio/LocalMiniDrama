// 与 Go pkg/utils/json_parser.go SafeParseAIJSON 对齐：去除 markdown、提取 JSON、解析
let _jsonrepair = null;
try { _jsonrepair = require('jsonrepair').jsonrepair; } catch (_) {}
function extractJsonCandidate(text) {
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') {
      start = i;
      break;
    }
  }
  if (start === -1) return '';
  const stack = [];
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/**
 * 当 AI 输出因 max_tokens 截断导致 JSON 数组不完整时，
 * 尝试从中抢救出已完成的顶层数组元素，重新拼成合法 JSON 数组。
 * 仅处理顶层为数组（[...{...}...]）的情况。
 */
function repairTruncatedJsonArray(str) {
  const trimmed = str.trimStart();
  if (!trimmed.startsWith('[')) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let lastCompletePos = -1;

  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{' || c === '[') {
      depth++;
    } else if (c === '}' || c === ']') {
      depth--;
      // depth === 1 意味着刚刚关闭了一个顶层数组元素（对象）
      if (depth === 1) lastCompletePos = i + 1;
      // depth === 0 意味着整个数组已正常关闭
      if (depth === 0) return trimmed.slice(0, i + 1);
    }
  }

  if (lastCompletePos === -1) return null;
  return trimmed.slice(0, lastCompletePos) + ']';
}

/**
 * 激进截断修复：当 repairTruncatedJsonArray 找不到任何完整顶层元素时使用。
 * 场景：截断恰好发生在第一个（或唯一一个）对象内部，深度追踪器无法记录到任何完整边界。
 * 策略：找到字符串里最后一个 } 的位置，强制截断并补上 ]，
 *       让后续 JSON.parse / jsonrepair 在更干净的输入上再做一次尝试。
 * 返回 null 表示无法构造候选串。
 */
function repairByLastBrace(str) {
  const trimmed = str.trimStart();
  if (!trimmed.startsWith('[')) return null;
  const lastBrace = trimmed.lastIndexOf('}');
  if (lastBrace === -1) return null;
  // 截断到最后一个 }，去掉紧随其后可能存在的尾随逗号，再补上 ]
  const cut = trimmed.slice(0, lastBrace + 1).trimEnd().replace(/,\s*$/, '');
  return cut + ']';
}

/**
 * 当 AI 返回包装对象（如 {"storyboards":[...]}）而非裸数组时，
 * 提取第一个非字符串内的 [ 之后的内容作为内部数组候选串，供截断修复使用。
 * 返回 null 表示未找到内部数组。
 */
function extractWrappedArrayStr(str) {
  const trimmed = str.trimStart();
  if (trimmed.startsWith('[')) return null; // 已经是数组，无需处理
  let inString = false;
  let escape = false;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '[') return trimmed.slice(i); // 找到第一个非字符串内的 [
  }
  return null;
}

/**
 * 清除 JSON 字符串中非法的原始控制字符（0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F）。
 * JSON 规范要求控制字符必须用 \uXXXX 转义，AI 有时会直接输出原始字节（如退格符 \b / 0x08）。
 * 保留 0x09(\t)、0x0A(\n)、0x0D(\r)，它们在 JSON 中常见且合法。
 */
function sanitizeControlChars(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * 将 JSON 字符串值内部的原始换行符转义为 \n / \r。
 * 中文 AI 模型常见问题：对话/描述字段里直接输出换行字节，导致 JSON.parse 报
 * "Unterminated string" 或 "Bad control character"。
 * 此函数通过字符级状态机精确定位字符串内部并替换，不影响 JSON 结构字符。
 */
function escapeNewlinesInStrings(str) {
  let result = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inString) {
      if (escape) { escape = false; result += c; continue; }
      if (c === '\\') { escape = true; result += c; continue; }
      if (c === '"') { inString = false; result += c; continue; }
      if (c === '\n') { result += '\\n'; continue; }
      if (c === '\r') { result += '\\r'; continue; }
      if (c === '\t') { result += '\\t'; continue; }
      result += c;
    } else {
      if (c === '"') inString = true;
      result += c;
    }
  }
  return result;
}

/**
 * 修复 AI 常见 JSON 缺陷：字符串值缺少开始引号（有结尾引号但无开始引号）。
 * 场景：AI 输出 "key": 中文文字"  →  应为 "key": "中文文字"
 * 仅处理值的第一个字符不是合法 JSON 值起始字符（" { [ 数字 - t f n）的情况。
 */
function fixUnquotedStringValues(str) {
  // 匹配模式：冒号-空格 + 非JSON合法值起始字符 + 任意内容(不含引号/换行/括号) + 结尾引号
  // 结尾引号后必须紧跟 , } ] 或换行，确保这确实是个值边界
  return str.replace(
    /(:\s*)([^"\s{[\-\d+tfn\r\n][^",\r\n[\]{}]*?)("(?=\s*[,}\]\r\n]))/g,
    '$1"$2$3'
  );
}

/**
 * @param {string} aiResponse
 * @param {object|Array} v - 默认值类型（用于判断期望返回类型）
 * @param {object} [log] - 可选 logger，有 warn/info 方法；不传则用 console.warn
 * @param {object} [outMeta] - 可选输出元数据对象，解析后会写入 { truncated: boolean }
 */
function safeParseAIJSON(aiResponse, v, log, outMeta) {
  const _warn = (msg, extra) => {
    if (log && typeof log.warn === 'function') {
      log.warn(msg, extra);
    } else {
      console.warn('[safeParseAIJSON]', msg, extra || '');
    }
  };

  if (!_jsonrepair) {
    _warn('jsonrepair 未加载，截断修复降级为纯结构修复', {});
  }

  if (!aiResponse || typeof aiResponse !== 'string') {
    throw new Error('AI返回内容为空');
  }
  let cleaned = sanitizeControlChars(aiResponse).trim()
    .replace(/^```json\s*/gm, '')
    .replace(/^```\s*/gm, '')
    .replace(/```\s*$/gm, '')
    .trim();
  // 预处理：转义字符串值内部的原始换行/制表符（中文模型常见，会导致 "Unterminated string"）
  cleaned = escapeNewlinesInStrings(cleaned);
  const jsonStr = extractJsonCandidate(cleaned);
  if (!jsonStr) {
    throw new Error('响应中未找到有效的JSON对象或数组');
  }

  // 优先尝试完整解析（正常路径，无破损）
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(v)) {
      v.length = 0;
      v.push(...(Array.isArray(parsed) ? parsed : []));
    } else if (v && typeof v === 'object') {
      Object.assign(v, parsed);
    }
    return parsed;
  } catch (err) {
    _warn('AI JSON 破损，尝试修复', { original_error: err.message, text_length: jsonStr.length, text_head: jsonStr.slice(0, 120000) });

    // 策略 0：AI 将数组包进对象（如 {"storyboards":[...]}），且因截断导致外层对象不完整。
    // 提取内部数组候选串，后续所有截断修复策略对它重新执行一遍。
    const innerArrayStr = extractWrappedArrayStr(jsonStr);
    if (innerArrayStr) {
      // 0a：内部数组截断修复
      const innerRepaired = repairTruncatedJsonArray(innerArrayStr);
      if (innerRepaired && innerRepaired !== innerArrayStr) {
        try {
          const parsed = JSON.parse(innerRepaired);
          const items = Array.isArray(parsed) ? parsed : extractFirstArray(parsed);
          if (items && items.length > 0) {
            _warn('AI JSON 修复成功（策略0a：解包对象+截断修复）', { rescued_items: items.length, original_len: jsonStr.length });
            if (outMeta) outMeta.truncated = true;
            if (Array.isArray(v)) { v.length = 0; v.push(...items); }
            return items;
          }
        } catch (_) {}
        // 0b：解包 + 截断修复 + jsonrepair
        if (_jsonrepair) {
          try {
            const fixed = _jsonrepair(innerRepaired);
            const parsed = JSON.parse(fixed);
            const items = Array.isArray(parsed) ? parsed : extractFirstArray(parsed);
            if (items && items.length > 0) {
              _warn('AI JSON 修复成功（策略0b：解包对象+截断修复+jsonrepair）', { rescued_items: items.length });
              if (outMeta) outMeta.truncated = true;
              if (Array.isArray(v)) { v.length = 0; v.push(...items); }
              return items;
            }
          } catch (_) {}
        }
      }
      // 0c：激进截断（切到最后一个 }）
      const innerRough = repairByLastBrace(innerArrayStr);
      if (innerRough && innerRough !== innerArrayStr) {
        try {
          const parsed = JSON.parse(innerRough);
          const items = Array.isArray(parsed) ? parsed : extractFirstArray(parsed);
          if (items && items.length > 0) {
            _warn('AI JSON 修复成功（策略0c：解包对象+激进截断）', { rescued_items: items.length });
            if (outMeta) outMeta.truncated = true;
            if (Array.isArray(v)) { v.length = 0; v.push(...items); }
            return items;
          }
        } catch (_) {}
        // 0d：激进截断 + jsonrepair
        if (_jsonrepair) {
          try {
            const fixed = _jsonrepair(innerRough);
            const parsed = JSON.parse(fixed);
            const items = Array.isArray(parsed) ? parsed : extractFirstArray(parsed);
            if (items && items.length > 0) {
              _warn('AI JSON 修复成功（策略0d：解包对象+激进截断+jsonrepair）', { rescued_items: items.length });
              if (outMeta) outMeta.truncated = true;
              if (Array.isArray(v)) { v.length = 0; v.push(...items); }
              return items;
            }
          } catch (_) {}
        }
      }
    }

    // 修复策略 1：截断数组修复（应对 max_tokens 截断场景）
    // 通过深度追踪找到已完整闭合的顶层元素，截断后补 ]
    const repaired = repairTruncatedJsonArray(jsonStr);
    if (repaired && repaired !== jsonStr) {
      // 策略 1a：直接解析截断修复结果
      try {
        const parsed = JSON.parse(repaired);
        _warn('AI JSON 修复成功（策略1a：截断修复）', {
          rescued_items: Array.isArray(parsed) ? parsed.length : 1,
          original_len: jsonStr.length,
          repaired_len: repaired.length,
        });
        if (outMeta) outMeta.truncated = true;
        if (Array.isArray(v)) {
          v.length = 0;
          v.push(...(Array.isArray(parsed) ? parsed : []));
        } else if (v && typeof v === 'object') {
          Object.assign(v, parsed);
        }
        return parsed;
      } catch (_) {}

      // 策略 1b：截断结果本身有小问题（如末尾字段含非法字符），再用 jsonrepair 做最终修复
      if (_jsonrepair) {
        try {
          const fixed = _jsonrepair(repaired);
          const parsed = JSON.parse(fixed);
          _warn('AI JSON 修复成功（策略1b：截断修复 + jsonrepair）', {
            rescued_items: Array.isArray(parsed) ? parsed.length : 1,
            original_len: jsonStr.length,
            repaired_len: repaired.length,
            fixed_len: fixed.length,
          });
          if (outMeta) outMeta.truncated = true;
          if (Array.isArray(v)) {
            v.length = 0;
            v.push(...(Array.isArray(parsed) ? parsed : []));
          } else if (v && typeof v === 'object') {
            Object.assign(v, parsed);
          }
          return parsed;
        } catch (_) {}
      }
    }

    // 策略 1c/1d：激进截断——repairTruncatedJsonArray 找不到完整顶层元素时
    // （截断恰好发生在第一个对象内部），强制切到最后一个 } 处后补 ]
    const roughCut = repairByLastBrace(jsonStr);
    if (roughCut && roughCut !== jsonStr) {
      // 策略 1c：直接解析粗截断结果
      try {
        const parsed = JSON.parse(roughCut);
        if (Array.isArray(parsed) && parsed.length > 0) {
          _warn('AI JSON 修复成功（策略1c：激进截断修复）', {
            rescued_items: parsed.length,
            original_len: jsonStr.length,
            roughcut_len: roughCut.length,
          });
          if (outMeta) outMeta.truncated = true;
          if (Array.isArray(v)) {
            v.length = 0;
            v.push(...parsed);
          } else if (v && typeof v === 'object') {
            Object.assign(v, parsed);
          }
          return parsed;
        }
      } catch (_) {}

      // 策略 1d：粗截断结果仍有小问题，交给 jsonrepair 做最终修复
      if (_jsonrepair) {
        try {
          const fixed = _jsonrepair(roughCut);
          const parsed = JSON.parse(fixed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            _warn('AI JSON 修复成功（策略1d：激进截断修复 + jsonrepair）', {
              rescued_items: parsed.length,
              original_len: jsonStr.length,
              roughcut_len: roughCut.length,
              fixed_len: fixed.length,
            });
            if (outMeta) outMeta.truncated = true;
            if (Array.isArray(v)) {
              v.length = 0;
              v.push(...parsed);
            } else if (v && typeof v === 'object') {
              Object.assign(v, parsed);
            }
            return parsed;
          }
        } catch (_) {}
      }
    }

    // 修复策略 2：jsonrepair 深度修复（对完整破损字符串全量修复）
    if (_jsonrepair) {
      // 策略 2a：直接 jsonrepair
      try {
        const fixed = _jsonrepair(jsonStr);
        const parsed = JSON.parse(fixed);
        _warn('AI JSON 修复成功（jsonrepair）', {
          rescued_items: Array.isArray(parsed) ? parsed.length : 1,
          original_len: jsonStr.length,
          fixed_len: fixed.length,
        });
        if (Array.isArray(v)) {
          v.length = 0;
          v.push(...(Array.isArray(parsed) ? parsed : []));
        } else if (v && typeof v === 'object') {
          Object.assign(v, parsed);
        }
        return parsed;
      } catch (_) {}

      // 策略 2b：预处理"有结尾引号但缺开始引号"的裸值，再交给 jsonrepair
      // 场景：AI 生成 "key": 中文值"  而非  "key": "中文值"
      try {
        const preFixed = fixUnquotedStringValues(jsonStr);
        if (preFixed !== jsonStr) {
          const fixed2 = _jsonrepair(preFixed);
          const parsed = JSON.parse(fixed2);
          _warn('AI JSON 修复成功（预处理裸值 + jsonrepair）', {
            rescued_items: Array.isArray(parsed) ? parsed.length : 1,
            original_len: jsonStr.length,
            fixed_len: fixed2.length,
          });
          if (Array.isArray(v)) {
            v.length = 0;
            v.push(...(Array.isArray(parsed) ? parsed : []));
          } else if (v && typeof v === 'object') {
            Object.assign(v, parsed);
          }
          return parsed;
        }
      } catch (_) {}
    }

    throw new Error('JSON解析失败: ' + err.message);
  }
}

/**
 * 从 safeParseAIJSON 的解析结果中提取数组。
 * 兼容三种常见 AI 返回格式：
 *   1. 直接数组 [...]
 *   2. 包装对象 {"scenes":[...]} / {"data":[...]} / {"  ":[...]} （任意 key，包括空白 key）
 *   3. 返回 null 表示找不到
 */
function extractFirstArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
  }
  return null;
}

module.exports = { safeParseAIJSON, extractJsonCandidate, repairTruncatedJsonArray, repairByLastBrace, extractFirstArray, escapeNewlinesInStrings, extractWrappedArrayStr, _jsonrepair };
