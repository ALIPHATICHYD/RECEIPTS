import { Router } from 'express'
import { memwal, memwalNetwork, blobExplorerUrl, NAMESPACES, MissingMemWalConfigError } from '../memwal-client.mjs'
import { validatePickInput, encodePick, encodeGrade, parseTip, RESULTS } from '../picks.mjs'
import {
  loadPicks,
  loadCredibility,
  loadProfile,
  writeCredibility,
  writePatternChanges,
  writeLimit,
  adviseOpenPicks,
  credKey,
  findPatterns,
} from '../learning.mjs'

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

// The feed: every pick with its latest grade, and for open picks the advice and
// trust score recalled from memory. Open picks are ranked by remembered trust.
router.get('/picks', async (_req, res) => {
  try {
    const [picks, credibility, profile] = await Promise.all([loadPicks(), loadCredibility(), loadProfile()])
    const advice = new Map(adviseOpenPicks(picks, credibility, profile).map((a) => [a.pickId, a]))
    const enriched = picks.map((p) => ({ ...p, trust: advice.get(p.id)?.trust ?? null, advice: advice.get(p.id)?.advice ?? [] }))
    const open = enriched.filter((p) => p.status === 'pending').sort((a, b) => (b.trust ?? 50) - (a.trust ?? 50) || b.loggedAt.localeCompare(a.loggedAt))
    const settled = enriched.filter((p) => p.status !== 'pending').sort((a, b) => b.grade.gradedAt.localeCompare(a.grade.gradedAt))
    res.json({ network: memwalNetwork(), picks: [...open, ...settled] })
  } catch (err) {
    sendError(res, err, 'Failed to recall picks from Walrus Memory')
  }
})

// Grade a pick. Writes a grade memory, then the source's new credibility score,
// then any pattern in the user's journal whose verdict changed.
router.post('/picks/:id/grade', async (req, res) => {
  const result = req.body?.result
  if (!RESULTS.includes(result)) return res.status(400).json({ error: `result must be one of ${RESULTS.join(', ')}` })
  const closingOdds = typeof req.body?.closingOdds === 'string' ? req.body.closingOdds.trim().slice(0, 20) : ''
  try {
    const [picks, credibility, profile] = await Promise.all([loadPicks(), loadCredibility(), loadProfile()])
    const pick = picks.find((p) => p.id === req.params.id)
    if (!pick) return res.status(404).json({ error: 'Pick not found in memory' })

    const grade = { pickId: pick.id, result, closingOdds: closingOdds || null, gradedAt: new Date().toISOString() }
    const accepted = await memwal().remember(encodeGrade(pick, grade), NAMESPACES.grades)

    // Score from the picks we already hold plus this grade, so we don't wait on the write.
    pick.status = result
    pick.grade = grade
    const previous = credibility.current.get(credKey(pick.source, pick.league))
    const cred = await writeCredibility(picks, pick, previous)
    const patterns = await writePatternChanges(picks, profile)
    res.status(202).json({ jobId: accepted.job_id, credibility: cred.sentence, trust: cred.record.trust, prevTrust: cred.record.prevTrust, patterns })
  } catch (err) {
    sendError(res, err, 'Failed to grade pick')
  }
})

// Leaderboard plus the timeline of every score change, newest first.
router.get('/credibility', async (_req, res) => {
  try {
    const { current, history } = await loadCredibility()
    const board = [...current.values()].sort((a, b) => b.trust - a.trust || b.n - a.n)
    res.json({ network: memwalNetwork(), board, history })
  } catch (err) {
    sendError(res, err, 'Failed to recall credibility')
  }
})

router.get('/profile', async (_req, res) => {
  try {
    const [profile, picks] = await Promise.all([loadProfile(), loadPicks()])
    res.json({
      patterns: [...profile.patterns.values()].filter((p) => p.verdict !== 'neutral'),
      limit: profile.limit,
      history: profile.history,
      // Live segments, including ones not yet strong enough to be remembered.
      segments: findPatterns(picks),
    })
  } catch (err) {
    sendError(res, err, 'Failed to recall profile')
  }
})

router.post('/profile/limit', async (req, res) => {
  const n = Number(req.body?.maxDailyLosses)
  if (!Number.isInteger(n) || n < 0 || n > 20) return res.status(400).json({ error: 'maxDailyLosses must be a whole number from 0 to 20' })
  try {
    const profile = await loadProfile()
    const written = await writeLimit(n || null, profile.limit)
    res.status(202).json({ jobId: written.jobId, limit: written.record, sentence: written.sentence })
  } catch (err) {
    sendError(res, err, 'Failed to save limit')
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
