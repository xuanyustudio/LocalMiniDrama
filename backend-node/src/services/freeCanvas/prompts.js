const DURATIONS = new Set([3, 5, 8, 10]);
const CONTEXT_TYPES = new Set(['character', 'scene', 'prop']);
const MEDIA_TYPES = new Set(['image', 'upload']);

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

/** 视频节点全部上游参考媒体（图片/上传），按连线顺序，最多 9 张 */
function upstreamMediaList(graph, nodeId) {
  const list = [];
  const seen = new Set();
  for (const edge of incoming(graph, nodeId, 'media_input_for')) {
    const source = findNode(graph, edge.source);
    if (!source || !MEDIA_TYPES.has(source.type)) continue;
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    list.push(source);
    if (list.length >= 9) break;
  }
  return list;
}

function upstreamMedia(graph, nodeId) {
  const list = upstreamMediaList(graph, nodeId);
  return list[0] || null;
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
  const mediaList = upstreamMediaList(graph, nodeId);
  const media = mediaList[0] || null;
  const storyboard = upstreamStoryboard(graph, nodeId, media);
  const styleNodes = [];
  for (const item of mediaList) styleNodes.push(...collectStyles(graph, item.id));
  styleNodes.push(...collectStyles(graph, nodeId));

  let prompt = '';
  if (nonEmpty(video?.data?.prompt)) {
    prompt = withStyles(video.data.prompt, styleNodes);
  } else if (media && media.type === 'image') {
    prompt = assemble(graph, media);
  } else if (storyboard && nonEmpty(storyboard.data?.prompt)) {
    prompt = withStyles(storyboard.data.prompt, styleNodes);
  } else {
    prompt = withStyles('', styleNodes);
  }

  const imagePaths = mediaList.map((item) => mediaPath(item.data)).filter(Boolean);

  return {
    prompt,
    duration: validDuration(video?.data?.duration) ?? validDuration(storyboard?.data?.duration) ?? 5,
    imagePath: imagePaths[0] || '',
    imagePaths,
  };
}

function spokenText(graph, nodeId) {
  const node = findNode(graph, nodeId);
  if (nonEmpty(node?.data?.text)) return node.data.text;
  const storyboard = firstOfType(graph, nodeId, 'prompt_for', 'storyboard');
  if (storyboard && nonEmpty(storyboard.data?.dialogue)) return storyboard.data.dialogue;
  return '';
}

module.exports = { promptForImage, promptForVideo, spokenText, upstreamMedia, upstreamMediaList };
