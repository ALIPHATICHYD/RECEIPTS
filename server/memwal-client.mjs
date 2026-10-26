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
  client = MemWal.create({
    key,
    accountId,
    serverUrl: process.env.MEMWAL_SERVER_URL || RELAYERS[memwalNetwork()],
    namespace: NAMESPACES.picks,
  })
  return client
}
