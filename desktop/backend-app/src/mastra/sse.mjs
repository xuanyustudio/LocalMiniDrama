import { assertOwned } from './context.mjs';

export function guardDeleteApproval(db, dramaId, args) {
  const type = args && args.type;
  const id = args && args.id;
  const owned = assertOwned(db, dramaId, type, id);
  if (!owned.ok) return { action: 'decline', error: owned.error };
  return { action: 'ask', type, id, label: owned.label };
}

export function toAgentSseEvent(chunk) {
  if (!chunk || typeof chunk.type !== 'string') return null;
  const payload = chunk.payload || {};
  if (chunk.type === 'text-delta') {
    const text = chunk.textDelta ?? chunk.text ?? payload.text ?? '';
    return { type: 'text-delta', text };
  }
  if (chunk.type === 'tool-call') {
    return { type: 'tool-call', toolName: chunk.toolName || payload.toolName || '' };
  }
  if (chunk.type === 'tool-result') {
    const result = chunk.result || payload.result || {};
    return {
      type: 'tool-result',
      toolName: chunk.toolName || payload.toolName || '',
      ok: result.ok !== false,
      summary: result.summary || result.error || '',
      taskId: result.taskId,
      imageUrl: result.imageUrl,
      localPath: result.localPath,
    };
  }
  if (chunk.type === 'tool-call-approval') {
    const args = payload.args || chunk.args || {};
    return {
      type: 'tool-call-approval',
      runId: chunk.runId || payload.runId,
      toolCallId: payload.toolCallId || chunk.toolCallId,
      toolName: payload.toolName || chunk.toolName,
      itemType: args.type,
      id: args.id,
      label: chunk.label || payload.label || '',
    };
  }
  if (chunk.type === 'error') {
    const message = payload.message || payload.error || chunk.message || '对话失败';
    return { type: 'error', message: typeof message === 'string' ? message : (message.message || '对话失败') };
  }
  return null;
}
