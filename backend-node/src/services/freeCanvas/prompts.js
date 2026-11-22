const DURATIONS = new Set([3, 5, 8, 10]);
const CONTEXT_TYPES = new Set(['character', 'scene', 'prop']);

function findNode(graph, id) {
  return (graph.nodes || []).find((node) => node.id === id) || null;
}

function incoming(graph, nodeId, relation) {
  return (graph.edges || []).filter((edge) => edge.target === nodeId && edge.relation === relation);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0;
}

function validDuration(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return DURATIONS.has(n) ? n : null;
}

function firstOfType(graph, nodeId, relation, type) {
  for (const edge of incoming(graph, nodeId, relation)) {
    const source = findNode(graph, edge.source);
    if (source && source.type === type) return source;
  }
  return null;
}

function mediaPath(data) {
  if (!data || typeof data !== 'object') return '';
  if (nonEmpty(data.local_path)) return data.local_path;
  if (nonEmpty(data.image_url)) return data.image_url;
  return '';
}

function collectStyles(graph, nodeId) {
  const styles = incoming(graph, nodeId, 'prompt_for')
    .map((edge) => findNode(graph, edge.source))
    .filter((source) => source && source.type === 'style' && nonEmpty(source.data?.text));
  styles.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return styles;
}

function assemble(graph, node) {
  const data = node.data || {};
  const pieces = [];
  if (nonEmpty(data.prompt)) {
    pieces.push(data.prompt);
  } else {
    const storyboard = firstOfType(graph, node.id, 'prompt_for', 'storyboard');
    if (storyboard && nonEmpty(storyboard.data?.prompt)) pieces.push(storyboard.data.prompt);
  }
  for (const edge of incoming(graph, node.id, 'context_for')) {
    const source = findNode(graph, edge.source);
    if (!source || !CONTEXT_TYPES.has(source.type)) continue;
    if (nonEmpty(source.data?.name)) pieces.push(source.data.name);
    if (nonEmpty(source.data?.prompt)) pieces.push(source.data.prompt);
  }
  for (const style of collectStyles(graph, node.id)) pieces.push(style.data.text);
  return pieces.join('，');
}

function promptForImage(graph, nodeId) {
  const node = findNode(graph, nodeId);
  if (!node) return '';
  return assemble(graph, node);
}

function upstreamMedia(graph, nodeId) {
  return firstOfType(graph, nodeId, 'media_input_for', 'image')
    || firstOfType(graph, nodeId, 'media_input_for', 'upload');
}

function upstreamStoryboard(graph, nodeId, media) {
  if (media && media.type === 'image') {
    const viaImage = firstOfType(graph, media.id, 'prompt_for', 'storyboard');
    if (viaImage) return viaImage;
  }
  return firstOfType(graph, nodeId, 'prompt_for', 'storyboard');
}

function withStyles(base, styles) {
  const pieces = [];
  if (nonEmpty(base)) pieces.push(base);
  const seen = new Set();
  for (const style of styles) {
    if (!style || seen.has(style.id)) continue;
    seen.add(style.id);
    if (nonEmpty(style.data?.text)) pieces.push(style.data.text);
  }
  return pieces.join('，');
}

function promptForVideo(graph, nodeId) {
  const video = findNode(graph, nodeId);
  const media = upstreamMedia(graph, nodeId);
  const storyboard = upstreamStoryboard(graph, nodeId, media);
  const styleNodes = [];
  if (media) styleNodes.push(...collectStyles(graph, media.id));
  styleNodes.push(...collectStyles(graph, nodeId));

  let prompt = '';
  if (nonEmpty(video?.data?.prompt)) {
    // 节点自己的提示词优先；风格词接在后面（对齐规格）
    prompt = withStyles(video.data.prompt, styleNodes);
  } else if (media && media.type === 'image') {
    // 无自有提示词时，沿上游图片拼分镜/上下文/风格（兼容既有测试）
    prompt = assemble(graph, media);
  } else if (storyboard && nonEmpty(storyboard.data?.prompt)) {
    prompt = withStyles(storyboard.data.prompt, styleNodes);
  } else {
    prompt = withStyles('', styleNodes);
  }

  return {
    prompt,
    duration: validDuration(video?.data?.duration) ?? validDuration(storyboard?.data?.duration) ?? 5,
    imagePath: mediaPath(media?.data),
  };
}

function spokenText(graph, nodeId) {
  const node = findNode(graph, nodeId);
  if (nonEmpty(node?.data?.text)) return node.data.text;
  const storyboard = firstOfType(graph, nodeId, 'prompt_for', 'storyboard');
  if (storyboard && nonEmpty(storyboard.data?.dialogue)) return storyboard.data.dialogue;
  return '';
}

module.exports = { promptForImage, promptForVideo, spokenText, upstreamMedia };
