// Sealed picks: a tipster's pick sold per view over x402. The pick text stays on
// this server until someone pays; what goes to Walrus at creation is a SHA-256
// commitment to it, so once revealed anyone can check the pick wasn't changed
// after the result.
import { createHash, randomBytes, randomUUID } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs'
import path from 'path'
import { CATEGORIES, detectLeague, parseSource } from './picks.mjs'
import { toAtomic, fromAtomic, paymentsMock } from './sui-payments.mjs'

const FILE = path.join(process.cwd(), 'data', 'offers.json')
const SUI_ADDRESS_RE = /^0x[0-9a-f]{64}$/i
export const MOCK_SELLER = `0x${'5e'.repeat(32)}`

function load() {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return []
  }
}

function save(offers) {
  mkdirSync(path.dirname(FILE), { recursive: true })
  writeFileSync(`${FILE}.tmp`, JSON.stringify(offers, null, 2))
  renameSync(`${FILE}.tmp`, FILE)
}

const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function commitmentOf(hidden, salt) {
  return createHash('sha256').update(JSON.stringify({ ...hidden, salt })).digest('hex')
}

export function createOffer(body) {
  const hidden = {
    market: clean(body?.market, 80),
    side: clean(body?.side, 120),
    odds: clean(body?.odds, 20),
    notes: clean(body?.notes, 500),
  }
  const event = clean(body?.event)
  const missing = [!event && 'event', !hidden.market && 'market', !hidden.side && 'side'].filter(Boolean)
  if (missing.length) return { error: `Missing ${missing.join(', ')}` }

  let amount
  try {
    amount = toAtomic(clean(body?.price, 12) || '0.05')
  } catch (err) {
    return { error: err.message }
  }
  if (amount <= 0n || amount > toAtomic('5')) return { error: 'Price must be between 0.01 and 5 USDC' }

  const payTo = clean(body?.payTo, 70) || process.env.SELLER_SUI_ADDRESS || (paymentsMock() ? MOCK_SELLER : '')
  if (!SUI_ADDRESS_RE.test(payTo)) return { error: 'Set the seller’s Sui address (payTo, or SELLER_SUI_ADDRESS in .env)' }

  const category = CATEGORIES.includes(body?.category) ? body.category : 'Sports'
  const salt = randomBytes(16).toString('hex')
  const offer = {
    id: randomUUID(),
    ...parseSource(body?.source),
    event,
    teaser: clean(body?.teaser, 200),
    category,
    league: clean(body?.league, 40) || detectLeague(`${event} ${body?.teaser ?? ''}`, category),
    amount: amount.toString(),
    price: fromAtomic(amount),
    payTo,
    hidden,
    salt,
    commitment: commitmentOf(hidden, salt),
    createdAt: new Date().toISOString(),
    unlocked: null,
  }
  save([offer, ...load()])
  return { offer }
}

export const getOffer = (id) => load().find((o) => o.id === id) ?? null
export const isDigestUsed = (digest) => load().some((o) => o.unlocked?.digest === digest)

export function markUnlocked(id, unlocked) {
  const offers = load()
  const offer = offers.find((o) => o.id === id)
  if (!offer) return null
  offer.unlocked = unlocked
  save(offers)
  return offer
}

// What anyone may see before paying: no pick, no salt.
export function publicOffer(o) {
  const { hidden, salt, ...rest } = o
  return o.unlocked ? { ...rest, hidden, salt } : rest
}

export const listOffers = () => load().map(publicOffer)
