// A pick is stored as one Walrus memory: a readable sentence (so semantic recall
// works) followed by a marker line carrying the exact JSON, so the app can read
// the record back without guessing. Records are append-only: grading a pick later
// writes a new record that supersedes this one, it never edits it.
import { randomUUID } from 'crypto'

const MARKER = 'RECEIPTS_PICK_V1 '
const GRADE_MARKER = 'RECEIPTS_GRADE_V1 '

export const CATEGORIES = ['Sports', 'Polymarket', 'Crypto', 'Macro']
// 'pending' reopens a pick: it withdraws an earlier grade (a misclick, a
// voided game) with a new memory rather than deleting anything.
export const RESULTS = ['won', 'lost', 'push', 'pending']

// Credibility is tracked per source and league, because a sharp NBA voice can be
// useless on the Premier League. Picks without a known league fall back to category.
const LEAGUES = [
  ['NBA', /\bnba\b|celtics|knicks|lakers|warriors|nuggets|bucks|heat|76ers|sixers|suns|mavericks|thunder|cavaliers|timberwolves|clippers|grizzlies|pelicans|kings|rockets|spurs|hawks|bulls|pacers|magic|nets|raptors|pistons|hornets|wizards|blazers|jazz/i],
  ['NFL', /\bnfl\b|chiefs|49ers|eagles|cowboys|bills|ravens|bengals|packers|lions|steelers|dolphins|jets|patriots|broncos|chargers|raiders|seahawks|rams|vikings|bears|saints|buccaneers|falcons|panthers|giants|commanders|texans|colts|jaguars|titans|browns|cardinals/i],
  ['UCL', /champions league|\bucl\b/i],
  ['EPL', /premier league|\bepl\b|arsenal|chelsea|liverpool|man(chester)? (city|united|utd)|tottenham|spurs fc|newcastle|aston villa|everton|west ham|brighton|fulham|brentford|crystal palace|wolves|bournemouth|nottingham forest|leeds|sunderland|burnley/i],
  ['La Liga', /la liga|real madrid|barcelona|atletico|sevilla|villarreal|real sociedad|athletic bilbao|valencia|betis/i],
  ['NHL', /\bnhl\b/i],
  ['MLB', /\bmlb\b|world series/i],
  ['Elections', /elect|senate|house|midterm|governor|congress/i],
]

export function detectLeague(text, category) {
  const hit = LEAGUES.find(([, re]) => re.test(text || ''))
  return hit ? hit[0] : category || 'Sports'
}

// Decimal odds from American (-110), decimal (1.91) or prediction-market price (0.65).
export function decimalOdds(odds) {
  const s = String(odds ?? '').trim()
  if (/^[+-]\d{3,4}$/.test(s)) {
    const n = Number(s)
    return n > 0 ? 1 + n / 100 : 1 + 100 / -n
  }
  const n = Number(s)
  if (n > 0 && n < 1) return 1 / n
  if (n >= 1.01 && n < 100) return n
  return 2 // unknown odds: treat as even money so units stay comparable
}

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function normalizeHandle(handle) {
  const h = clean(handle, 64).replace(/^@+/, '')
  return h ? `@${h}` : '@me'
}

// A source can be given as a profile link instead of a bare handle, so the pick
// names the exact account. The handle stays the credibility key; the link and
// platform are kept alongside it.
const PROFILE_HOSTS = [
  ['X', /^(?:www\.|mobile\.)?(?:x|twitter)\.com$/, (p) => p[0]],
  ['Telegram', /^(?:www\.)?(?:t\.me|telegram\.me)$/, (p) => (p[0] === 's' ? p[1] : p[0])],
  ['Instagram', /^(?:www\.)?instagram\.com$/, (p) => p[0]],
  ['TikTok', /^(?:www\.)?tiktok\.com$/, (p) => p[0]],
  ['YouTube', /^(?:www\.|m\.)?youtube\.com$/, (p) => (p[0] === 'c' || p[0] === 'channel' ? p[1] : p[0])],
  // Only profile pages name a person; a market page (/event, /predictions) does not.
  ['Polymarket', /^(?:www\.)?polymarket\.com$/, (p) => (p[0] === 'profile' ? p[1] : p[0]?.startsWith('@') ? p[0] : 'polymarket')],
  ['Discord', /^(?:www\.)?discord\.(?:gg|com)$/, (p) => p[p.length - 1]],
]
const PROFILE_URL_RE = /https?:\/\/[^\s)]+/i

export function parseSource(value) {
  const raw = clean(value, 300)
  let url
  try {
    url = /^https?:\/\//i.test(raw) ? new URL(raw) : /^[\w.-]+\.[a-z]{2,}\/\S+/i.test(raw) ? new URL(`https://${raw}`) : null
  } catch {
    url = null
  }
  if (!url) return { source: normalizeHandle(raw) }
  const parts = url.pathname.split('/').filter(Boolean)
  const host = url.hostname.toLowerCase()
  const known = PROFILE_HOSTS.find(([, re]) => re.test(host))
  const name = known ? known[2](parts) : parts[parts.length - 1]
  const handle = String(name ?? host.replace(/^www\./, '')).replace(/^@+/, '').slice(0, 64)
  return {
    source: normalizeHandle(handle),
    sourceUrl: `${url.origin}${url.pathname}`.replace(/\/+$/, ''),
    sourcePlatform: known ? known[0] : host.replace(/^www\./, ''),
  }
}

export function validatePickInput(body) {
  const pick = {
    id: randomUUID(),
    event: clean(body?.event),
    market: clean(body?.market, 80),
    side: clean(body?.side, 120),
    odds: clean(body?.odds, 20),
    ...parseSource(body?.source),
    category: CATEGORIES.includes(body?.category) ? body.category : 'Sports',
    confidence: Math.min(100, Math.max(0, Math.round(Number(body?.confidence) || 0))),
    notes: clean(body?.notes, 500),
    eventTime: clean(body?.eventTime, 40) || null,
    league: clean(body?.league, 40),
    loggedAt: new Date().toISOString(),
    status: 'pending',
  }
  // Optional link to a prediction market, so the pick can be priced and graded
  // automatically. Only kept when the market id looks real.
  const marketId = clean(body?.marketId, 100)
  if (/^(0x[0-9a-f]{64}|[A-Z0-9][A-Z0-9._-]{2,99})$/i.test(marketId)) {
    pick.platform = body?.platform === 'kalshi' ? 'kalshi' : 'polymarket'
    pick.marketId = marketId
    pick.outcome = clean(body?.outcome, 120) || pick.side
    const url = clean(body?.marketUrl, 300)
    if (/^https:\/\/(polymarket\.com|kalshi\.com)\//.test(url)) pick.marketUrl = url
    const externalId = clean(body?.externalId, 100)
    if (externalId) pick.externalId = externalId
    const tradedAt = clean(body?.tradedAt, 40)
    if (tradedAt) pick.tradedAt = tradedAt
  }
  if (!pick.league) pick.league = detectLeague(`${pick.event} ${pick.notes}`, pick.category)
  const missing = ['event', 'market', 'side'].filter((k) => !pick[k])
  return missing.length ? { error: `Missing ${missing.join(', ')}` } : { pick }
}

export function encodePick(pick) {
  const sentence =
    `Receipt: ${pick.source}${pick.sourcePlatform ? ` (${pick.sourcePlatform}, ${pick.sourceUrl})` : ''} picked ${pick.side} (${pick.market}) for ${pick.event} ` +
    `[${pick.category}]${pick.odds ? ` at ${pick.odds}` : ''} with ${pick.confidence}% confidence, ` +
    `logged ${pick.loggedAt}.` +
    `${pick.marketId ? ` Linked to ${pick.platform} market ${pick.marketId}.` : ''}${pick.notes ? ` Notes: ${pick.notes}` : ''}`
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

// A grade is its own memory. The pick record is never rewritten; the newest grade
// for a pick id decides its status.
export function encodeGrade(pick, grade) {
  const verb = grade.result === 'push' ? 'pushed' : grade.result === 'pending' ? 'reopened, withdrawing its earlier grade' : grade.result
  const sentence =
    `Graded: ${pick.source}'s pick ${pick.side} (${pick.market}) for ${pick.event} [${pick.league}] ${verb}` +
    `${grade.closingOdds ? `, closing odds ${grade.closingOdds}` : ''}, graded ${grade.gradedAt}` +
    `${grade.auto ? `, settled automatically from the ${pick.platform} result (winner: ${grade.winner}) via Tatum` : ''}.`
  return `${sentence}\n${GRADE_MARKER}${JSON.stringify(grade)}`
}

export function decodeGrade(text) {
  const line = text?.split('\n').find((l) => l.startsWith(GRADE_MARKER))
  if (!line) return null
  try {
    return JSON.parse(line.slice(GRADE_MARKER.length))
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
    // A profile link in the tip beats an @mention, which beats the fallback.
    source: text.match(PROFILE_URL_RE)?.[0] || text.match(/@(\w{2,30})/)?.[1] || fallbackSource || '',
    category: 'Sports',
    confidence: 60,
    notes: text.slice(0, 280),
    league: '',
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
  draft.league = detectLeague(text, draft.category)
  return draft
}
