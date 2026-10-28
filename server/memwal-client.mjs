// Walrus Memory access for server routes. One client per process; namespaces are
// passed per call so picks, credibility scores and the user profile stay separate.
//
// Env is read on first use, like tatum-client.mjs:
//   MEMWAL_PRIVATE_KEY  delegate key (hex or suiprivkey1...)
//   MEMWAL_ACCOUNT_ID   Walrus Memory account object ID
//   MEMWAL_NETWORK      "mainnet" | "testnet" (default: testnet)
//   MEMWAL_SERVER_URL   optional relayer override
//   MEMWAL_MOCK=1       in-process mock, for local UI work without credentials
import { MemWal, MemWalMock } from '@mysten-incubation/memwal'

export const NAMESPACES = {
  picks: 'receipts-picks',
  grades: 'receipts-grades',
  credibility: 'receipts-credibility',
  profile: 'receipts-profile',
  payments: 'receipts-payments',
}

const RELAYERS = {
  mainnet: 'https://relayer.memory.walrus.xyz',
  testnet: 'https://relayer-staging.memory.walrus.xyz',
}

export class MissingMemWalConfigError extends Error {
  constructor() {
    super('MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID must be set (or MEMWAL_MOCK=1 for local work)')
    this.name = 'MissingMemWalConfigError'
  }
}

export function memwalNetwork() {
  if (process.env.MEMWAL_MOCK === '1') return 'mock'
  return process.env.MEMWAL_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
}

// Walruscan has no mock explorer, so mock blobs get no link.
export function blobExplorerUrl(blobId) {
  const network = memwalNetwork()
  if (!blobId || network === 'mock') return null
  return `https://walruscan.com/${network}/blob/${blobId}`
}

let client = null

export function memwal() {
  if (client) return client
  if (memwalNetwork() === 'mock') {
    client = MemWalMock.create({ namespace: NAMESPACES.picks })
    return client
  }
  const key = process.env.MEMWAL_PRIVATE_KEY
  const accountId = process.env.MEMWAL_ACCOUNT_ID
  if (!key || !accountId) throw new MissingMemWalConfigError()
  client = paced(
    MemWal.create({
      key,
      accountId,
      serverUrl: process.env.MEMWAL_SERVER_URL || RELAYERS[memwalNetwork()],
      namespace: NAMESPACES.picks,
    }),
  )
  return client
}

// The relayer allows 60 weighted requests a minute per delegate key, and a page
// load recalls several namespaces at once. So every call goes through one
// sliding-window budget, identical recalls share a short cache, and a 429 waits
// out the relayer's retry_after before trying again. Retrying a remember is
// safe: the SDK reuses the idempotency key for the same text and namespace.
const WINDOW_MS = 60_000
const BUDGET = Number(process.env.MEMWAL_CALLS_PER_MIN) || 40
const RECALL_TTL_MS = 20_000
const MAX_RETRIES = 2

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sent = []
let queue = Promise.resolve()

// Resolves when this call fits in the budget. Calls queue in order.
function slot() {
  const turn = queue.then(async () => {
    for (;;) {
      while (sent.length && Date.now() - sent[0] >= WINDOW_MS) sent.shift()
      if (sent.length < BUDGET) break
      await sleep(WINDOW_MS - (Date.now() - sent[0]) + 50)
    }
    sent.push(Date.now())
  })
  queue = turn.catch(() => {})
  return turn
}

function retryAfterMs(err) {
  if (err?.status !== 429 && !/server error \(429\)/.test(err?.message ?? '')) return null
  const seconds = Number(err.retryAfterSeconds ?? /"retry_after_seconds":\s*(\d+)/.exec(err.message ?? '')?.[1])
  return Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds : 30, 65) * 1000
}

async function call(fn) {
  for (let attempt = 0; ; attempt++) {
    await slot()
    try {
      return await fn()
    } catch (err) {
      const wait = retryAfterMs(err)
      if (wait == null || attempt >= MAX_RETRIES) throw err
      console.warn(`Walrus Memory rate limit hit, retrying in ${Math.round(wait / 1000)}s`)
      // Anything queued behind us would only trip the limit again.
      const until = Date.now() + wait
      sent.length = 0
      for (let i = 0; i < BUDGET; i++) sent.push(until - WINDOW_MS)
      await sleep(wait)
    }
  }
}

export function paced(real) {
  const recalls = new Map()
  const forget = (namespace) => {
    for (const key of recalls.keys()) if (key.startsWith(`${namespace}\u0000`)) recalls.delete(key)
  }
  return new Proxy(real, {
    get(target, prop) {
      const value = target[prop]
      if (typeof value !== 'function') return value
      if (prop === 'recall') {
        return (opts = {}) => {
          const key = `${opts.namespace ?? ''}\u0000${JSON.stringify(opts)}`
          const hit = recalls.get(key)
          if (hit && Date.now() - hit.at < RECALL_TTL_MS) return hit.promise
          const promise = call(() => value.call(target, opts))
          recalls.set(key, { at: Date.now(), promise })
          promise.catch(() => recalls.delete(key))
          return promise
        }
      }
      if (prop === 'remember') {
        return (text, namespace, options) => {
          forget(typeof namespace === 'string' ? namespace : NAMESPACES.picks)
          return call(() => value.call(target, text, namespace, options))
        }
      }
      return (...args) => call(() => value.apply(target, args))
    },
  })
}
