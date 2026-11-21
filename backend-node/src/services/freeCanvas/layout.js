const X = { script: 80, storyboard: 400, image: 720, video: 1040, audio: 1040, compose: 1360 };
const Y0 = 80;
const GAP_Y = 220;

function layoutGraph(graph, onlyIds) {
  const next = JSON.parse(JSON.stringify(graph));
  const allow = onlyIds && onlyIds.length ? new Set(onlyIds) : null;
  const scripts = next.nodes.filter((node) => node.type === 'script');
  scripts.forEach((script, index) => {
    if (!allow || allow.has(script.id)) script.position = { x: X.script, y: Y0 + index * GAP_Y };
  });
  const boards = next.nodes.filter((node) => node.type === 'storyboard');
  boards.forEach((board, index) => {
    if (!allow || allow.has(board.id)) board.position = { x: X.storyboard, y: Y0 + index * GAP_Y };
  });
  for (const node of next.nodes) {
    if (allow && !allow.has(node.id)) continue;
    if (node.type === 'image' || node.type === 'video' || node.type === 'audio' || node.type === 'compose') {
      const upstream = next.edges.find((edge) => edge.target === node.id);
      const source = upstream && next.nodes.find((item) => item.id === upstream.source);
      const y = source && source.position ? source.position.y : Y0;
      const yShift = node.type === 'audio' ? 160 : 0;
      node.position = { x: X[node.type], y: y + yShift };
    }
    if (!node.position && node.type !== 'group') node.position = { x: 80, y: Y0 };
  }
  return next;
}

module.exports = { layoutGraph };
