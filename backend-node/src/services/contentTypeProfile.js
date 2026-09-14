'use strict';

const PROFILES = {
  anime_series: {
    label: '漫剧', defaultAspectRatio: '9:16', targetSeconds: 60,
    storyRule: '用60至90秒完成一集可独立观看的故事单元：前3至5秒直接给异常、危险或强反应；前15%建立目标，15%至67%持续增加阻碍，67%至90%发生反转，最后5至10秒完成情绪落点并留下追更问题。每句对白必须推进冲突或揭示压力下的人物；角色外观、服装、标志道具和世界状态跨镜头稳定。',
    storyboardRule: '采用关键帧优先的漫画分镜工作流。每镜只改变一个主要变量，通常3至5秒；为每镜明确起始姿态、单一连续动作、结束姿态、屏幕方向、视线、服装、道具和光向。相邻镜头必须动作接力：上一镜result要能直接成为下一镜action的起点。首尾关键图应保持同主体、同场景和相近构图；差异过大的状态变化必须拆镜。默认动作匹配硬切，只有时间或空间变化才使用淡化。',
  },
  short_drama: {
    label: '短剧', defaultAspectRatio: '9:16', targetSeconds: 90,
    storyRule: '前3秒建立冲突，围绕人物目标、阻碍和反转推进；对白口语化且可表演，结尾形成明确情绪落点或悬念。',
    storyboardRule: '遵守180度轴线、视线匹配和动作衔接；对话采用建立镜头与正反打，时长以对白可完整表演为准。',
  },
  short_video: {
    label: '短视频', defaultAspectRatio: '9:16', targetSeconds: 30,
    storyRule: '首秒给出主题或反差，信息密度高，每3到5秒设置新视觉点，结尾给出回报、记忆点或行动引导。',
    storyboardRule: '采用紧凑节奏、清晰主体和适合竖屏的近中景；减少空镜，每镜只传达一个核心信息。',
  },
  store_promo: {
    label: '店铺宣传', defaultAspectRatio: '9:16', targetSeconds: 30,
    storyRule: '围绕顾客痛点、核心卖点、可信证明、门店或商品记忆点和行动引导组织内容，不虚构价格、资质或效果。',
    storyboardRule: '优先商品细节、使用场景、门店环境和品牌识别；画面须预留字幕安全区，结尾清晰呈现行动引导。',
  },
};

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return {}; }
}

function getContentTypeProfile(metadata) {
  const meta = parseMetadata(metadata);
  const key = Object.prototype.hasOwnProperty.call(PROFILES, meta.content_type) ? meta.content_type : 'short_drama';
  return { key, ...PROFILES[key] };
}

module.exports = { PROFILES, getContentTypeProfile, parseMetadata };
