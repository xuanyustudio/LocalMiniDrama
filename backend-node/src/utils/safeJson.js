// 与 Go pkg/utils/json_parser.go SafeParseAIJSON 对齐：去除 markdown、提取 JSON、解析
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

function safeParseAIJSON(aiResponse, v) {
  if (!aiResponse || typeof aiResponse !== 'string') {
    throw new Error('AI返回内容为空');
  }
  let cleaned = aiResponse.trim()
    .replace(/^```json\s*/gm, '')
    .replace(/^```\s*/gm, '')
    .replace(/```\s*$/gm, '')
    .trim();
  const jsonStr = extractJsonCandidate(cleaned);
  if (!jsonStr) {
    throw new Error('响应中未找到有效的JSON对象或数组');
  }
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
    throw new Error('JSON解析失败: ' + err.message);
  }
}

module.exports = { safeParseAIJSON, extractJsonCandidate };
