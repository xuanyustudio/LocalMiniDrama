/**
 * 媒体生成「画幅/比例」官方参数说明与归一化（图片 + 视频）
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ Google Gemini 图片 generateContent（generationConfig）                     │
 * │   官方字段：aspectRatio（camelCase，字符串枚举）                             │
 * │   枚举：GEMINI_IMAGE_ASPECT_RATIOS                                         │
 * │   文档：https://ai.google.dev/gemini-api/docs/image-generation             │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ Google Gemini 视频 Veo predictLongRunning（parameters）                    │
 * │   官方字段：aspectRatio（camelCase）                                        │
 * │   文档：与所用 Veo 模型版本说明一致                                          │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ Vidu POST /ent/v2/text2video | img2video                                   │
 * │   官方字段：aspect_ratio（snake，如 "16:9"）                                │
 * │            resolution（"540p"|"720p"|"1080p"，依模型/时长）                  │
 * │   文档：https://platform.vidu.com/docs/text-to-video                       │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ OpenAI Images POST /v1/images/generations                                  │
 * │   官方字段：size（如 DALL·E 3："1024x1024","1792x1024","1024x1792"）        │
 * │   无标准顶层 aspect_ratio；部分 OpenAI 兼容中转会额外识别 aspect_ratio       │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │ 本项目火山/OpenAI 风格视频（contents + ratio）                              │
 * │   当前使用：ratio；部分网关同时识别 aspect_ratio                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Gemini 图片官方枚举（与 Google 文档一致的可选 aspectRatio） */
const GEMINI_IMAGE_ASPECT_RATIOS = new Set([
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9',
]);

/** Vidu 文生视频文档列出的 aspect_ratio（21:9 以项目 UI 为准，官方文挡以接口返回为准） */
const VIDU_ASPECT_RATIOS = new Set(['16:9', '9:16', '3:4', '4:3', '1:1', '21:9']);

/**
 * 将任意比例标签限制在 Gemini 图片官方枚举内（未知则 16:9）
 */
function clampToGeminiImageAspectRatio(ratio) {
  const r = String(ratio || '').trim();
  if (GEMINI_IMAGE_ASPECT_RATIOS.has(r)) return r;
  return '16:9';
}

/**
 * 将比例限制在 Vidu 常见枚举内（未知则 16:9）
 */
function clampToViduAspectRatio(ratio) {
  const r = String(ratio || '').trim();
  if (VIDU_ASPECT_RATIOS.has(r)) return r;
  return '16:9';
}

/**
 * 从 "2560x1440" / "1440*2560" 推断比例标签（与 imageClient.geminiAspectRatio 桶一致，供 OpenAI 兼容层附加 aspect_ratio）
 */
function aspectRatioLabelFromPixelSize(size) {
  if (!size || typeof size !== 'string') return '16:9';
  const s = String(size).trim().toLowerCase().replace(/\s/g, '');
  const ratioSet = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']);
  if (ratioSet.has(s)) return s;
  const match = s.match(/^(\d+)[x*](\d+)$/);
  if (!match) return '16:9';
  const w = parseInt(match[1], 10);
  const h = parseInt(match[2], 10);
  if (!w || !h) return '16:9';
  const r = w / h;
  if (r > 2) return '21:9';
  if (r >= 1.6) return '16:9';
  if (r >= 1.2) return '4:3';
  if (r >= 0.9) return '1:1';
  if (r >= 0.7) return '3:4';
  if (r >= 0.55) return '4:5';
  return '9:16';
}

/**
 * Vidu resolution 归一化；img2video + q2 系模型官方常见仅 720p/1080p（540p 易报错则抬到 720p）
 */
function pickViduResolutionParam(resolution, modelName, hasImage) {
  let r = String(resolution || '').trim().toLowerCase();
  if (r === '480p') r = '540p';
  const allowed = new Set(['540p', '720p', '1080p']);
  if (!allowed.has(r)) r = '720p';
  const m = String(modelName || '').toLowerCase();
  const q2FamilyImg = hasImage && /viduq2|vidu2\.0|viduq1/i.test(m);
  if (q2FamilyImg && r === '540p') r = '720p';
  return r;
}

function isGeminiOfficialHost(baseUrl) {
  return /generativelanguage\.googleapis\.com/i.test(String(baseUrl || ''));
}

module.exports = {
  GEMINI_IMAGE_ASPECT_RATIOS,
  VIDU_ASPECT_RATIOS,
  clampToGeminiImageAspectRatio,
  clampToViduAspectRatio,
  aspectRatioLabelFromPixelSize,
  pickViduResolutionParam,
  isGeminiOfficialHost,
};
