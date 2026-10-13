'use strict';

const { resolveStylePreset } = require('../constants/generationStylePresets');

/**
 * 从剧集行解析画风：优先使用 metadata 里由前端写入的完整提示词（与 styleOptions 一致），
 * 否则退回 dramas.style（选项 value 时会展开为完整中英文提示词，与 frontweb styleOptions 一致）。
 */

function parseDramaMetadata(dramaRow) {
  if (!dramaRow?.metadata) return {};
  try {
    return typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
  } catch (_) {
    return {};
  }
}

function styleFieldsFromDramaRow(dramaRow) {
  if (!dramaRow) return { zh: '', en: '', legacy: '' };
  const meta = parseDramaMetadata(dramaRow);
  const zh = meta.style_prompt_zh != null ? String(meta.style_prompt_zh).trim() : '';
  const en = meta.style_prompt_en != null ? String(meta.style_prompt_en).trim() : '';
  const legacy = dramaRow.style != null ? String(dramaRow.style).trim() : '';
  return { zh, en, legacy };
}

/**
 * 若仅有 default_style 且为前端下拉 value（如 cartoon），展开为 zh/en 长文案；已有 zh/en 则不处理。
 */
function expandStyleSlotIfPresetKey(styleObj) {
  if (!styleObj || typeof styleObj !== 'object') return styleObj;
  const o = { ...styleObj };
  const zh = (o.default_style_zh || '').toString().trim();
  const en = (o.default_style_en || '').toString().trim();
  if (zh || en) return o;
  const d = (o.default_style || '').toString().trim();
  if (!d) return o;
  const preset = resolveStylePreset(d);
  if (!preset) return o;
  o.default_style_zh = preset.zh;
  o.default_style_en = preset.en;
  o.default_style = preset.en || preset.zh;
  return o;
}

/**
 * 将剧集画风合并进 cfg.style（不修改原 cfg 引用外的对象）
 * @param {object} cfg
 * @param {{ style?: string, metadata?: string|object }|null|undefined} dramaRow
 */
function mergeCfgStyleWithDrama(cfg, dramaRow) {
  const { zh, en, legacy } = styleFieldsFromDramaRow(dramaRow);
  const base = { ...(cfg?.style || {}) };
  const hasMeta = !!(zh || en);
  if (hasMeta) {
    if (zh) base.default_style_zh = zh;
    else delete base.default_style_zh;
    if (en) base.default_style_en = en;
    else delete base.default_style_en;
    base.default_style = en || zh;
  } else if (legacy) {
    const preset = resolveStylePreset(legacy);
    if (preset) {
      base.default_style_zh = preset.zh;
      base.default_style_en = preset.en;
      base.default_style = preset.en || preset.zh;
    } else if (legacy === 'custom') {
      // 有 style=custom 但无 metadata 描述：勿把短标识当画风注入
    } else {
      // 自定义整段文案：双语槽位都写入，避免下游只读到「半句 key」
      base.default_style_zh = legacy;
      base.default_style_en = legacy;
      base.default_style = legacy;
    }
  }
  return { ...cfg, style: expandStyleSlotIfPresetKey(base) };
}

/**
 * 分镜流式保存等：显式请求参数优先，否则用剧集 metadata/legacy，最后兜底 realistic
 */
function resolvedStreamStyleFromDrama(styleParam, dramaRow) {
  const s = (styleParam && String(styleParam).trim()) || '';
  if (s && s !== 'custom') {
    const p = resolveStylePreset(s);
    return p ? (p.en || p.zh) : s;
  }
  const { zh, en, legacy } = styleFieldsFromDramaRow(dramaRow);
  if (en || zh) return en || zh;
  if (legacy && legacy !== 'custom') {
    const p = resolveStylePreset(legacy);
    return p ? (p.en || p.zh) : legacy;
  }
  return 'realistic';
}

module.exports = {
  mergeCfgStyleWithDrama,
  styleFieldsFromDramaRow,
  resolvedStreamStyleFromDrama,
  parseDramaMetadata,
};
