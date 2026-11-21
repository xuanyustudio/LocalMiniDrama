/**
 * 小说/长文章节导入服务
 * 从文本识别章节并按需生成剧本初稿。
 */
const aiClient = require('./aiClient');
const MAX_ADAPTATION_CHARS = 3000;

/**
 * 简单的章节检测（不调用 AI，基于规则）
 * 识别常见章节标题格式
 */
function detectChaptersByRules(text) {
  const lines = text.split(/\r?\n/);
  const chapterPatterns = [
    /^第[零一二三四五六七八九十百千\d]+章/,
    /^第[零一二三四五六七八九十百千\d]+节/,
    /^Chapter\s+\d+/i,
    /^CHAPTER\s+\d+/,
    /^\d+[\.、]\s*.{2,20}$/,
    /^【.{1,30}】$/,
    /^「.{1,30}」$/,
  ];
  const chapters = [];
  let currentStart = 0;
  let currentTitle = '序章';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const isChapter = chapterPatterns.some((p) => p.test(line));
    if (isChapter) {
      if (i > currentStart) {
        const content = lines.slice(currentStart, i).join('\n').trim();
        // Some downloaded novels start with a site disclaimer, not story text.
        const siteDisclaimer = chapters.length === 0 && currentTitle === '序章' && /^声明[：:]\s*本书为/.test(content);
        if (content.length > 20 && !siteDisclaimer) {
          chapters.push({ title: currentTitle, content });
        }
      }
      currentTitle = line;
      currentStart = i + 1;
    }
  }
  // 最后一章
  const lastContent = lines.slice(currentStart).join('\n').trim();
  if (lastContent.length > 20) {
    chapters.push({ title: currentTitle, content: lastContent });
  }
  return chapters;
}

/**
 * 用 AI 将章节内容摘要为剧本形式
 */
async function summarizeChapterToScript(db, log, chapterTitle, chapterContent, dramaTitle) {
  const excerpt = chapterContent.slice(0, MAX_ADAPTATION_CHARS);
  const userPrompt = `作品：${dramaTitle || '未命名'}
章节：${chapterTitle}

【原文】
${excerpt}
【原文结束】

请写一段约45至60秒的中文短剧初稿，约180至260字。用“场景：”交代地点和时间，用“动作：”描述能拍到的情节，再用3到5句“人物名：台词”推进剧情。选取原文已有的悬念或行动收尾。省略人物介绍、分析和创作说明。`;
  const systemPrompt = '你是短剧编剧。根据用户提供的小说原文改写。人物姓名、地点、事件、关系和已知结果须与原文一致，原文未交代的事保持未知。只输出剧本，动作和台词均不得反复。';

  try {
    const result = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'novel_import',
      max_tokens: 520,
      temperature: 0.3,
      silence_timeout_ms: 120000,
      require_complete: true,
    });
    if (!result || !result.trim()) throw new Error('文字模型没有返回剧本');
    const lineCounts = new Map();
    for (const line of result.split(/\r?\n/)) {
      const normalized = line.trim().replace(/\s+/g, '');
      if (normalized.length < 10) continue;
      const count = (lineCounts.get(normalized) || 0) + 1;
      if (count >= 4) throw new Error('生成内容出现大量重复，请更换更强的文字模型后重试');
      lineCounts.set(normalized, count);
    }
    return result;
  } catch (err) {
    log.warn('[小说导入] AI改写章节失败', { error: err.message });
    const reason = err.code === 'ECONNREFUSED' ? '文字模型服务没有响应，请检查 Ollama 是否已启动，或检查 AI 配置中的服务地址' : err.message;
    throw new Error(`“${chapterTitle}”改写失败：${reason}`);
  }
}

/**
 * 主入口：解析小说文本，返回章节列表
 * @returns {{ chapters: Array<{title, content, script}> }}
 */
async function importNovel(db, log, { text, title, maxChapters, aiSummarize }) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('小说内容不能为空');
  text = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');

  const chapters = detectChaptersByRules(text);
  if (chapters.length === 0) {
    // 没有检测到章节，整个文本作为一章
    chapters.push({ title: title || '第一集', content: text.trim() });
  }

  const limit = Math.min(maxChapters || 20, chapters.length);
  const result = [];

  for (let i = 0; i < limit; i++) {
    const ch = chapters[i];
    let script = ch.content;
    if (aiSummarize) {
      script = await summarizeChapterToScript(db, log, ch.title, ch.content, title);
    }
    result.push({
      index: i + 1,
      title: ch.title,
      content: ch.content.slice(0, 300),
      script,
    });
  }

  return { chapters: result, total: chapters.length };
}

module.exports = { importNovel, detectChaptersByRules };
