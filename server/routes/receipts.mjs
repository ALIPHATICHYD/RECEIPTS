import { Router } from 'express'
import { memwal, memwalNetwork, blobExplorerUrl, NAMESPACES, MissingMemWalConfigError } from '../memwal-client.mjs'
import { validatePickInput, encodePick, decodePick, parseTip } from '../picks.mjs'

const router = Router()

function sendError(res, error, fallback) {
  if (error instanceof MissingMemWalConfigError) {
    return res.status(503).json({ error: error.message, code: 'memwal-not-configured' })
  }
  return res.status(502).json({ error: error?.message || fallback })
}

router.get('/memory/status', async (_req, res) => {
  const network = memwalNetwork()
  try {
    const health = await memwal().health()
    res.json({ network, configured: true, health })
  } catch (error) {
    res.json({ network, configured: !(error instanceof MissingMemWalConfigError), error: error.message })
  }
})

// Log a pick. Returns as soon as the relayer accepts the write; the client polls
// the job to learn the Walrus blob ID once it is stored.
router.post('/picks', async (req, res) => {
  const { pick, error } = validatePickInput(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const accepted = await memwal().remember(encodePick(pick), NAMESPACES.picks, { idempotencyKey: pick.id })
    res.status(202).json({ pick, jobId: accepted.job_id })
  } catch (err) {
    sendError(res, err, 'Failed to store pick in Walrus Memory')
  }
})

router.get('/picks/jobs/:jobId', async (req, res) => {
  try {
    const job = await memwal().getRememberStatus(req.params.jobId)
    res.json({ status: job.status, blobId: job.blob_id ?? null, explorerUrl: blobExplorerUrl(job.blob_id), error: job.error })
  } catch (err) {
    sendError(res, err, 'Failed to read job status')
  }
})

router.get('/picks', async (_req, res) => {
  try {
    const result = await memwal().recall({
      query: 'Receipt: tipster picked a side, logged pick',
      namespace: NAMESPACES.picks,
      limit: 100,
      sort: 'recent',
    })
    // Newest record per pick id wins, so a later grade supersedes the original.
    const byId = new Map()
    for (const hit of result.results) {
      const pick = decodePick(hit.text)
      if (!pick) continue
      const record = { ...pick, blobId: hit.blob_id, storedAt: hit.created_at ?? pick.loggedAt, explorerUrl: blobExplorerUrl(hit.blob_id) }
      const prev = byId.get(pick.id)
      if (!prev || record.storedAt > prev.storedAt) byId.set(pick.id, record)
    }
    const picks = [...byId.values()].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    res.json({ network: memwalNetwork(), picks })
  } catch (err) {
    sendError(res, err, 'Failed to recall picks from Walrus Memory')
  }
})

router.post('/picks/parse', (req, res) => {
  if (typeof req.body?.text !== 'string' || !req.body.text.trim()) {
    return res.status(400).json({ error: 'Paste the tip text first' })
  }
  res.json({ draft: parseTip(req.body.text, req.body.source) })
})

// Memory inspector: the full inventory across namespaces (metadata only).
router.get('/memories', async (_req, res) => {
  try {
    const client = memwal()
    const ours = new Set(Object.values(NAMESPACES))
    const memories = []
    if (typeof client.listMemories === 'function') {
      let cursor
      let more = true
      while (more && memories.length < 2000) {
        const page = await client.listMemories({ cursor, limit: 500 })
        for (const m of page.memories) {
          if (!ours.has(m.namespace_id)) continue
          memories.push({
            memoryId: m.memory_id,
            namespace: m.namespace_id,
            blobId: m.blob_id,
            createdAt: m.created_at,
            size: m.size,
            status: m.status,
            explorerUrl: blobExplorerUrl(m.blob_id),
          })
        }
        cursor = page.next_cursor ?? undefined
        more = page.has_more
      }
    } else {
      // The SDK mock has no inventory endpoint; recall each namespace instead.
      for (const namespace of ours) {
        const result = await client.recall({ query: 'Receipt', namespace, limit: 100 })
        for (const hit of result.results) {
          memories.push({ memoryId: hit.blob_id, namespace, blobId: hit.blob_id, createdAt: hit.created_at ?? null, explorerUrl: null })
        }
      }
    }
    memories.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    res.json({ network: memwalNetwork(), total: memories.length, memories })
  } catch (err) {
    sendError(res, err, 'Failed to list memories')
  }
})

export default router
