// One-off probe of Tatum's Prediction Market API, to learn the exact response
// fields before building on them. Reads TATUM_API_KEY from .env, never prints it.
// Run: node --env-file=.env scripts/probe-prediction.mjs
// Costs roughly 1,500 Tatum credits (100-200 per call).
const BASE = 'https://api.tatum.io/v4/data/prediction'
const key = process.env.TATUM_API_KEY
if (!key) {
  console.error('TATUM_API_KEY is not set. Run with: node --env-file=.env scripts/probe-prediction.mjs')
  process.exit(1)
}

// Keep output pasteable: first 2 items of any array, long strings cut short.
function trim(value, depth = 0) {
  if (Array.isArray(value)) return value.slice(0, 2).map((v) => trim(v, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trim(v, depth + 1)]))
  }
  if (typeof value === 'string' && value.length > 120) return `${value.slice(0, 120)}…`
  return value
}

async function get(label, path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-api-key': key }, signal: AbortSignal.timeout(20000) })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 300)
  }
  console.log(`\n### ${label}\nGET ${path} -> ${res.status}`)
  console.log(JSON.stringify(trim(body), null, 1).replaceAll(key, '<redacted>'))
  return res.ok ? body : null
}

const first = (body) => (Array.isArray(body?.data) ? body.data[0] : Array.isArray(body) ? body[0] : null)

const sports = await get('Active sports events with markets', '/events?platform=polymarket&status=active&category=Sports&limit=1&includeMarkets=true')
const resolved = await get('Resolved event with markets', '/events?platform=polymarket&status=resolved&limit=1&includeMarkets=true')
await get('Senate midterm search', '/events?platform=polymarket&status=active&search=Senate&limit=1&includeMarkets=true')

const market = first(sports)?.markets?.[0]
const marketId = typeof market === 'string' ? market : market?.id
if (marketId) {
  await get('Market by id', `/markets/${marketId}`)
  await get('Market price', `/markets/${marketId}/price`)
}
const resolvedMarket = first(resolved)?.markets?.[0]
const resolvedId = typeof resolvedMarket === 'string' ? resolvedMarket : resolvedMarket?.id
if (resolvedId) await get('Resolved market by id', `/markets/${resolvedId}`)

const traders = await get('Top sports traders this month', '/top-traders?category=SPORTS&timePeriod=MONTH&limit=2')
const wallet = first(traders)?.proxyWallet
if (wallet) {
  await get('Wallet open positions', `/wallets/${wallet}/positions?limit=2`)
  for (const path of ['closed-positions', 'positions/closed', 'positions?status=closed']) {
    const ok = await get(`Wallet closed positions (trying ${path})`, `/wallets/${wallet}/${path}${path.includes('?') ? '&' : '?'}limit=2`)
    if (ok) break
  }
  await get('Wallet trades', `/wallets/${wallet}/trades?limit=2`)
}
console.log('\nDone. Paste everything above into the chat.')
