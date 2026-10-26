import { Router } from 'express'
import { memwal, NAMESPACES } from '../memwal-client.mjs'
import { validatePickInput, encodePick } from '../picks.mjs'
import { loadPicks } from '../learning.mjs'
import { MissingApiKeyError } from '../tatum-client.mjs'
import {
  searchMarkets,
  getMarket,
  topTraders,
  walletTrades,
  resultFor,
  winningOutcome,
  livePrice,
  tradeToPick,
  TRADER_CATEGORIES,
  TRADER_PERIODS,
} from '../prediction.mjs'
import { sendError, loadState, gradeAndLearn } from './receipts.mjs'

const router = Router()

function fail(res, err, fallback) {
  if (err instanceof MissingApiKeyError) return res.status(503).json({ error: err.message, code: 'tatum-not-configured' })
  return sendError(res, err, fallback)
}

const WALLET_RE = /^0x[0-9a-f]{40}$/i

router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 300)
  if (q.length < 2) return res.status(400).json({ error: 'Type at least 2 characters' })
  try {
    res.json({ markets: await searchMarkets(q) })
  } catch (err) {
    fail(res, err, 'Market search failed')
  }
})

router.get('/traders', async (req, res) => {
  const category = TRADER_CATEGORIES.includes(req.query.category) ? req.query.category : 'SPORTS'
  const period = TRADER_PERIODS.includes(req.query.period) ? req.query.period : 'MONTH'
  try {
    res.json({ category, period, traders: await topTraders(category, period, 10) })
  } catch (err) {
    fail(res, err, 'Could not load top traders')
  }
})

// Import a trader's latest buys as picks sourced to them. Each one becomes a
// Walrus memory; trades already imported (same tx hash or same market and side
// from this source) are skipped, so following again only adds new calls.
router.post('/follow', async (req, res) => {
  const wallet = String(req.body?.wallet ?? '')
  if (!WALLET_RE.test(wallet)) return res.status(400).json({ error: 'wallet must be a 0x Polymarket proxy wallet' })
  const limit = Math.min(10, Math.max(1, Number(req.body?.limit) || 5))
  try {
    const [trades, picks] = await Promise.all([walletTrades(wallet), loadPicks()])
    const seen = new Set(picks.flatMap((p) => [p.externalId, p.marketId && `${p.source.toLowerCase()}|${p.marketId}|${String(p.outcome).toLowerCase()}`]).filter(Boolean))
    const created = []
    for (const trade of trades) {
      if (created.length >= limit) break
      if (trade.side !== 'BUY' || !trade.conditionId) continue
      const { pick, error } = validatePickInput(tradeToPick(trade, String(req.body?.userName ?? '')))
      if (error) continue
      const key = `${pick.source.toLowerCase()}|${pick.marketId}|${pick.outcome.toLowerCase()}`
      if (seen.has(pick.externalId) || seen.has(key)) continue
      seen.add(key)
      const accepted = await memwal().remember(encodePick(pick), NAMESPACES.picks, { idempotencyKey: pick.id })
      created.push({ pick, jobId: accepted.job_id })
    }
    res.status(202).json({ created, skipped: trades.length - created.length })
  } catch (err) {
    fail(res, err, 'Could not import trades')
  }
})

// Live price of each open linked pick's outcome, for "now vs when picked".
router.get('/live', async (_req, res) => {
  try {
    const open = (await loadPicks()).filter((p) => p.status === 'pending' && p.marketId).slice(0, 25)
    const prices = await Promise.all(
      open.map(async (p) => {
        try {
          const m = await getMarket(p.marketId)
          return { pickId: p.id, price: livePrice(p, m), status: m?.status ?? null, settledFor: winningOutcome(m) }
        } catch (err) {
          return { pickId: p.id, price: null, status: null, settledFor: null, error: err.message }
        }
      }),
    )
    res.json({ prices })
  } catch (err) {
    fail(res, err, 'Could not read live prices')
  }
})

// Grade every open linked pick whose market has settled, from the market itself.
router.post('/settle', async (_req, res) => {
  try {
    const state = await loadState()
    const open = state.picks.filter((p) => p.status === 'pending' && p.marketId)
    const graded = []
    const learned = []
    for (const pick of open) {
      let market
      try {
        market = await getMarket(pick.marketId, 0)
      } catch {
        continue // one unreadable market shouldn't stop the others settling
      }
      const result = resultFor(pick, market)
      if (!result) continue
      const grade = { pickId: pick.id, result, closingOdds: null, gradedAt: new Date().toISOString(), auto: true, winner: winningOutcome(market) }
      const out = await gradeAndLearn(state, pick, grade)
      graded.push({ pickId: pick.id, result, winner: grade.winner })
      learned.push(out.credibility, ...out.patterns)
    }
    res.json({ checked: open.length, graded, learned })
  } catch (err) {
    fail(res, err, 'Could not settle picks')
  }
})

export default router
