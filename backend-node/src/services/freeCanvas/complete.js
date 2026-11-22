const { getCanvas, listCanvases, saveDocument } = require('./store');
const { clone } = require('./document');

function sameGeneration(node, generationId) {
  return node && node.data && String(node.data.generation_id) === String(generationId);
}

function applyResult(node, patch) {
  if (patch.error) {
    node.status = 'failed';
    node.error = String(patch.error);
    return;
  }
  node.status = 'succeeded';
  node.error = null;
  if (patch.kind === 'video') {
    node.data.video_url = patch.url || '';
    node.data.local_path = patch.local_path || '';
    return;
  }
  node.data.image_url = patch.url || '';
  node.data.local_path = patch.local_path || '';
}

function noteFreeCanvasResult(db, patch) {
  const generationId = patch && patch.generation_id;
  if (generationId == null || generationId === '') return { ok: false, error: '缺少生成记录' };
  const canvases = listCanvases(db).filter((canvas) => (
    (canvas.document.nodes || []).some((node) => sameGeneration(node, generationId))
  ));
  for (const listed of canvases) {
    let canvas = getCanvas(db, listed.id);
    for (let attempt = 0; attempt < 5 && canvas; attempt += 1) {
      const graph = clone(canvas.document);
      const target = (graph.nodes || []).find((node) => sameGeneration(node, generationId));
      if (!target) break;
      applyResult(target, patch);
      const saved = saveDocument(db, canvas.id, canvas.revision, graph);
      if (saved.ok) break;
      canvas = getCanvas(db, canvas.id);
    }
  }
  return { ok: true };
}

module.exports = { noteFreeCanvasResult };
