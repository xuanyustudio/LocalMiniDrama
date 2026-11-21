import assert from 'node:assert/strict'
import { test } from 'node:test'
import { propAPI } from '../src/api/props.js'

test('prop extraction sends a JSON object and the confirmed receipt', async () => {
  let outgoing
  const result = await propAPI.extractFromScript(2, {
    productionCostApproved: true,
    headers: { 'X-Production-Approval': 'fixture-receipt' },
    async adapter(config) {
      outgoing = { url: config.url, method: config.method, body: config.data,
        receipt: config.headers.get('X-Production-Approval') }
      return { data: { success: true, data: { task_id: 'fixture-task' } } }
    },
  })
  assert.deepEqual(outgoing, { url: '/episodes/2/props/extract', method: 'post', body: '{}', receipt: 'fixture-receipt' })
  assert.equal(result.task_id, 'fixture-task')
})
