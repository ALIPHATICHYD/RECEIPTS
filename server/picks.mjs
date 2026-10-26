// A pick is stored as one Walrus memory: a readable sentence (so semantic recall
// works) followed by a marker line carrying the exact JSON, so the app can read
// the record back without guessing. Records are append-only: grading a pick later
// writes a new record that supersedes this one, it never edits it.
import { randomUUID } from 'crypto'

const MARKER = 'RECEIPTS_PICK_V1 '

export const CATEGORIES = ['Sports', 'Polymarket', 'Crypto', 'Macro']

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function normalizeHandle(handle) {
  const h = clean(handle, 64).replace(/^@+/, '')
  return h ? `@${h}` : '@me'
}

export function validatePickInput(body) {
  const pick = {
    id: randomUUID(),
    event: clean(body?.event),
    market: clean(body?.market, 80),
    side: clean(body?.side, 120),
    odds: clean(body?.odds, 20),
    source: normalizeHandle(body?.source),
    category: CATEGORIES.includes(body?.category) ? body.category : 'Sports',
    confidence: Math.min(100, Math.max(0, Math.round(Number(body?.confidence) || 0))),
    notes: clean(body?.notes, 500),
    eventTime: clean(body?.eventTime, 40) || null,
    loggedAt: new Date().toISOString(),
    status: 'pending',
  }
  const missing = ['event', 'market', 'side'].filter((k) => !pick[k])
  return missing.length ? { error: `Missing ${missing.join(', ')}` } : { pick }
}

export function encodePick(pick) {
  const sentence =
    `Receipt: ${pick.source} picked ${pick.side} (${pick.market}) for ${pick.event} ` +
    `[${pick.category}]${pick.odds ? ` at ${pick.odds}` : ''} with ${pick.confidence}% confidence, ` +
    `logged ${pick.loggedAt}.${pick.notes ? ` Notes: ${pick.notes}` : ''}`
  return `${sentence}\n${MARKER}${JSON.stringify(pick)}`
}

export function decodePick(text) {
  const line = text?.split('\n').find((l) => l.startsWith(MARKER))
  if (!line) return null
  try {
    return JSON.parse(line.slice(MARKER.length))
  } catch {
    return null
  }
}

// ---------- Paste-a-tip parser ----------
// Turns a tipster's post into a draft pick the user confirms before it is saved.
// Heuristic on purpose: it only pre-fills the form, nothing is stored unconfirmed.

const EVENT_RE = /([A-Z][\w.'&-]*(?:\s+[A-Z0-9][\w.'&-]*){0,3})\s+(?:vs\.?|v\.?|@|versus)\s+([A-Z][\w.'&-]*(?:\s+[A-Z0-9][\w.'&-]*){0,3})/
const AMERICAN_ODDS_RE = /(?:^|[\s(])([+-]\d{3,4})(?=[\s),]|$)/
const DECIMAL_ODDS_RE = /(?:@|odds:?)\s*(\d{1,2}\.\d{1,2})\b/i
const PRICE_RE = /\b(0\.\d{2})\b|\b(\d{1,2})\s?¢/
const TOTAL_RE = /\b(over|under|o|u)\s?(\d{1,3}(?:\.5)?)\b/i
const SPREAD_RE = /([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2})\s+([+-]\d{1,2}(?:\.5)?)(?!\d)/
const ML_RE = /([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2})\s+(?:ML|moneyline|to win)\b/i
const BINARY_RE = /\b(YES|NO)\b/
const BTTS_RE = /\b(BTTS|both teams to score)\b/i
const CONFIDENCE_RE = /(\d{1,3})\s?%\s*(?:conf|confidence)|(\d)\s?u(?:nits?)?\b/i

export function parseTip(raw, fallbackSource) {
  const text = clean(raw, 2000)
  const draft = {
    event: '',
    market: '',
    side: '',
    odds: '',
    source: normalizeHandle(text.match(/@(\w{2,30})/)?.[1] || fallbackSource),
    category: 'Sports',
    confidence: 60,
    notes: text.slice(0, 280),
  }

  const lower = text.toLowerCase()
  if (/polymarket|kalshi|myriad|waterx/.test(lower)) draft.category = 'Polymarket'
  else if (/\b(btc|eth|sui|sol|bitcoin|ethereum)\b/.test(lower)) draft.category = 'Crypto'
  else if (/elect|senate|house|midterm|fed\b|cpi|rate cut|governor/.test(lower)) draft.category = 'Macro'

  const event = text.match(EVENT_RE)
  if (event) draft.event = `${event[1]} vs ${event[2]}`

  const total = text.match(TOTAL_RE)
  const spread = text.match(SPREAD_RE)
  const ml = text.match(ML_RE)
  const binary = text.match(BINARY_RE)
  if (BTTS_RE.test(text)) {
    draft.market = 'Both Teams to Score'
    draft.side = binary?.[1] === 'NO' ? 'NO' : 'YES'
  } else if (total) {
    draft.market = 'Total'
    draft.side = `${/^o/i.test(total[1]) ? 'Over' : 'Under'} ${total[2]}`
  } else if (ml) {
    draft.market = 'Moneyline'
    draft.side = ml[1]
  } else if (spread && !/^\d/.test(spread[1])) {
    draft.market = 'Spread'
    draft.side = `${spread[1]} ${spread[2]}`
  } else if (binary) {
    draft.market = 'Binary Yes/No'
    draft.side = binary[1]
  }

  const american = text.match(AMERICAN_ODDS_RE)
  const decimal = text.match(DECIMAL_ODDS_RE)
  const price = text.match(PRICE_RE)
  if (american) draft.odds = american[1]
  else if (decimal) draft.odds = decimal[1]
  else if (price) draft.odds = price[1] ?? (Number(price[2]) / 100).toFixed(2)

  const conf = text.match(CONFIDENCE_RE)
  if (conf?.[1]) draft.confidence = Math.min(100, Number(conf[1]))
  else if (conf?.[2]) draft.confidence = Math.min(95, 50 + Number(conf[2]) * 10)

  if (!draft.event && draft.category !== 'Sports') draft.event = text.split('\n')[0].slice(0, 120)
  return draft
}
