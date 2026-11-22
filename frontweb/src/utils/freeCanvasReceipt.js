export function applyReceipt(document, receipt) {
  if (!receipt || receipt.ok !== true || !receipt.graph) return document
  return receipt.graph
}

export function assistantTextChangesGraph() {
  return false
}

export function pendingConfirmNodes(nodes) {
  return (nodes || []).filter((node) => node.status === 'awaiting_confirm')
}

export function documentFromCommandResponse(payload) {
  if (payload && payload.canvas && payload.canvas.document) return payload.canvas.document
  return null
}
