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
  const styles = incoming(graph, node.id, 'prompt_for')
    .map((edge) => findNode(graph, edge.source))
    .filter((source) => source && source.type === 'style' && nonEmpty(source.data?.text));
  styles.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const style of styles) pieces.push(style.data.text);
  return pieces.join('，');
}

function promptForImage(graph, nodeId) {
  const node = findNode(graph, nodeId);
  if (!node) return '';
  return assemble(graph, node);
}

function upstreamImage(graph, nodeId) {
  return firstOfType(graph, nodeId, 'media_input_for', 'image');
}

function upstreamStoryboard(graph, nodeId, image) {
  if (image) {
    const viaImage = firstOfType(graph, image.id, 'prompt_for', 'storyboard');
    if (viaImage) return viaImage;
  }
  return firstOfType(graph, nodeId, 'prompt_for', 'storyboard');
}

function promptForVideo(graph, nodeId) {
  const video = findNode(graph, nodeId);
  const image = upstreamImage(graph, nodeId);
  const storyboard = upstreamStoryboard(graph, nodeId, image);
  const data = image?.data || {};
  return {
    prompt: image ? assemble(graph, image) : '',
    duration: validDuration(video?.data?.duration) ?? validDuration(storyboard?.data?.duration) ?? 5,
    imagePath: nonEmpty(data.local_path) ? data.local_path : (nonEmpty(data.image_url) ? data.image_url : ''),
  };
}

function spokenText(graph, nodeId) {
  const node = findNode(graph, nodeId);
  if (nonEmpty(node?.data?.text)) return node.data.text;
  const storyboard = firstOfType(graph, nodeId, 'prompt_for', 'storyboard');
  if (storyboard && nonEmpty(storyboard.data?.dialogue)) return storyboard.data.dialogue;
  return '';
}

module.exports = { promptForImage, promptForVideo, spokenText };
