// Tatum's Prediction Market API (Polymarket and Kalshi behind one endpoint).
// Receipts uses it to link picks to real markets, read live prices, import the
// trades of top Polymarket wallets as picks, and grade picks when a market settles.
//
// Responses are cached briefly: list calls cost 100-200 credits each.
import { tatumFetch } from './tatum-client.mjs'
import { FIXTURES } from './prediction-fixtures.mjs'
import { detectLeague } from './picks.mjs'

const BASE = '/v4/data/prediction'
const cache = new Map()

export const TRADER_CATEGORIES = ['OVERALL', 'SPORTS', 'POLITICS', 'CRYPTO']
export const TRADER_PERIODS = ['DAY', 'WEEK', 'MONTH', 'ALL']

// PREDICTION_MOCK=1 serves recorded responses, for offline work and tests.
const mock = () => process.env.PREDICTION_MOCK === '1'

async function get(path, ttlMs) {
  const hit = cache.get(path)
  if (hit && hit.expires > Date.now()) return hit.data
  let data
  if (mock()) {
    data = FIXTURES(path)
    if (data === undefined) throw new Error(`No prediction fixture for ${path}`)
  } else {
    const res = await tatumFetch(`${BASE}${path}`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = Array.isArray(body.data) ? ` (${body.data.join('; ')})` : ''
      throw new Error(`Tatum prediction API ${res.status}: ${body.message || 'request failed'}${detail}`)
    }
    data = body.data
  }
  cache.set(path, { data, expires: Date.now() + ttlMs })
  return data
}

const qs = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString()

function summarizeMarket(m, eventTitle) {
  return {
    id: m.id,
    platform: m.platform,
    eventTitle: eventTitle ?? m.question,
    question: m.question,
    category: m.category,
    status: m.status,
    closeTime: m.closeTime,
    outcomes: (m.outcomes ?? []).map((o) => ({ name: o.name, price: o.price })),
    volume: m.volume,
    url: m.source?.url ?? null,
  }
}

const ALIASES = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', xrp: 'xrp', updown: 'up or down' }

// Turn what the user typed into Tatum search text. A pasted Polymarket or Kalshi
// link becomes words from its slug (Tatum rejects URLs as search text), e.g.
// polymarket.com/event/btc-updown-5m-1793010900 -> "bitcoin up or down".
export function searchText(input) {
  const raw = String(input ?? '').trim()
  const slug = raw.match(/(?:polymarket|kalshi)\.com\/(?:[a-z]{2}\/)?(?:event|market|markets)\/([^/?#\s]+)/i)?.[1]
  const words = slug
    ? slug
        .toLowerCase()
        .split('-')
        .filter((w) => !/^(\d{5,}|\d+[a-z])$/.test(w)) // timestamps and "5m"-style windows; years stay
        .map((w) => ALIASES[w] ?? w)
        .join(' ')
    : raw
  return { text: words.replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60), slug: slug?.toLowerCase() ?? null }
}

// Tatum requires `platform` on /events (it answers 400 without it), and the
// params below are the exact set the live probe got a 200 for.
// Active markets matching a search, flattened out of their events, busiest
// first. For a pasted link, markets from that exact event come first.
export async function searchMarkets(input) {
  const { text, slug } = searchText(input)
  if (text.length < 2) return []
  const events = await get(`/events?${qs({ platform: 'polymarket', status: 'active', search: text, limit: 6, includeMarkets: true })}`, 5 * 60_000)
  const exact = (m) => (slug && m.url?.toLowerCase().includes(`/${slug}`) ? 1 : 0)
  return events
    .flatMap((e) => (e.markets ?? []).filter((m) => typeof m === 'object').map((m) => summarizeMarket(m, e.title)))
    .sort((a, b) => exact(b) - exact(a) || (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 12)
}

// Market ids are Polymarket condition ids (or Kalshi tickers). 60s keeps the
// feed's live prices fresh without spending credits on every reload.
export async function getMarket(id, ttlMs = 60_000) {
  return get(`/markets/${encodeURIComponent(id)}`, ttlMs)
}

export async function topTraders(category = 'SPORTS', timePeriod = 'MONTH', limit = 10) {
  return get(`/top-traders?${qs({ category, timePeriod, limit })}`, 10 * 60_000)
}

export async function walletTrades(wallet, limit = 25) {
  return get(`/wallets/${encodeURIComponent(wallet)}/trades?${qs({ limit })}`, 2 * 60_000)
}

const norm = (s) => String(s ?? '').trim().toLowerCase()

// The winning outcome name once a market has settled, else null. Tatum leaves
// `resolution` null on settled Polymarket markets, so a closed market whose
// outcome prices have gone to 1/0 counts as settled too.
export function winningOutcome(market) {
  if (!market) return null
  const r = market.resolution
  if (typeof r === 'string' && r) return r
  if (r && typeof r === 'object') return r.outcome ?? r.winner ?? r.name ?? null
  if (market.status === 'active') return null
  const top = (market.outcomes ?? []).find((o) => o.price >= 0.99)
  return top ? top.name : null
}

// A pick names the outcome it backs: an explicit `outcome` (set when linked from
// a market or imported from a trade), falling back to its side.
export function pickOutcome(pick) {
  return pick.outcome || pick.side
}

export function resultFor(pick, market) {
  const winner = winningOutcome(market)
  if (!winner) return null
  return norm(winner) === norm(pickOutcome(pick)) ? 'won' : 'lost'
}

export function livePrice(pick, market) {
  const o = (market?.outcomes ?? []).find((x) => norm(x.name) === norm(pickOutcome(pick)))
  return o ? o.price : null
}

// A trade from a wallet becomes a draft pick, sourced to the trader.
export function tradeToPick(trade, userName) {
  const when = new Date(trade.timestamp * 1000).toISOString()
  return {
    event: trade.title,
    market: 'Polymarket',
    side: trade.outcome,
    outcome: trade.outcome,
    odds: Number(trade.price).toFixed(3),
    source: userName || trade.name || trade.proxyWallet.slice(0, 10),
    category: 'Polymarket',
    confidence: Math.round(Math.min(99, Math.max(1, trade.price * 100))),
    notes: `Copied from Polymarket wallet ${trade.proxyWallet}: ${trade.side} ${Math.round(trade.size)} shares at ${trade.price} on ${when}, tx ${trade.transactionHash}`,
    eventTime: null,
    league: detectLeague(`${trade.title} ${trade.eventSlug ?? ''}`, 'Polymarket'),
    platform: 'polymarket',
    marketId: trade.conditionId,
    marketUrl: trade.eventSlug ? `https://polymarket.com/event/${trade.eventSlug}` : '',
    externalId: trade.transactionHash,
    tradedAt: when,
  }
}
