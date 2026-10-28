// USDC payments on Sui for x402, with every chain call going through Tatum's
// Sui gRPC gateway: the agent pays with a signed USDC transfer, and the seller
// verifies that transfer (status, recipient, amount, timing) before releasing
// a pick. No facilitator: the transaction digest is the payment proof.
import { randomBytes } from 'crypto'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction, coinWithBalance } from '@mysten/sui/transactions'
import { normalizeSuiAddress, normalizeStructTag } from '@mysten/sui/utils'
import { tatumGrpcUrl } from './tatum-client.mjs'
import { grpcTransport } from './sui-grpc.mjs'

// Circle's native USDC (docs.sui.io/guides/developer/stablecoins). 6 decimals.
export const USDC = {
  mainnet: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  testnet: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
}
export const USDC_DECIMALS = 6

export class PaymentConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PaymentConfigError'
  }
}

// PAYMENTS_MOCK=1 fakes the chain so the flow runs offline; nothing is paid.
export const paymentsMock = () => process.env.PAYMENTS_MOCK === '1'
export const paymentsNetwork = () => (process.env.PAYMENTS_NETWORK === 'testnet' ? 'testnet' : 'mainnet')
export const usdcType = () => USDC[paymentsNetwork()]
export const txExplorerUrl = (digest) => (digest && !digest.startsWith('mock') ? `https://suiscan.xyz/${paymentsNetwork()}/tx/${digest}` : null)

export function toAtomic(usdc) {
  const [whole, frac = ''] = String(usdc).trim().split('.')
  if (!/^\d+$/.test(whole || '0') || !/^\d*$/.test(frac)) throw new Error('Price must be a USDC amount like 0.05')
  return BigInt(whole || '0') * 10n ** BigInt(USDC_DECIMALS) + BigInt((frac + '000000').slice(0, USDC_DECIMALS))
}
export const fromAtomic = (atomic) => (Number(BigInt(atomic)) / 10 ** USDC_DECIMALS).toFixed(2)

let client
export function sui() {
  if (!process.env.TATUM_API_KEY) throw new PaymentConfigError('TATUM_API_KEY is not set')
  client ??= new SuiGrpcClient({
    network: paymentsNetwork(),
    transport: grpcTransport(paymentsNetwork()),
  })
  return client
}

const errorText = (e) => (typeof e === 'string' ? e : e?.message ?? JSON.stringify(e) ?? 'unknown error')

// Sui stores addresses padded to 64 hex characters; compare them normalized.
const sameAddress = (a, b) => normalizeSuiAddress(a ?? '0x0') === normalizeSuiAddress(b ?? '0x0')
const sameCoin = (a, b) => normalizeStructTag(a) === normalizeStructTag(b)

const MOCK_AGENT = `0x${'a9'.repeat(32)}`
const MOCK_VISITOR = `0x${'b7'.repeat(32)}`
const mockAgentDigests = new Set()

function agentKeypair() {
  const key = process.env.AGENT_SUI_PRIVATE_KEY
  if (!key) throw new PaymentConfigError('AGENT_SUI_PRIVATE_KEY is not set: the agent has no Sui wallet to pay from')
  return Ed25519Keypair.fromSecretKey(key)
}

export function agentAddress() {
  if (paymentsMock()) return MOCK_AGENT
  return agentKeypair().getPublicKey().toSuiAddress()
}

export async function balances(address) {
  if (paymentsMock()) return { sui: '1.00', usdc: '2.00' }
  const { balances: all } = await sui()
    .listBalances({ owner: address })
    .catch((err) => {
      throw new Error(`Tatum Sui gRPC (${tatumGrpcUrl('sui', paymentsNetwork())}) failed reading balances: ${err.message}`)
    })
  const of = (type) => BigInt(all.find((b) => sameCoin(b.coinType, type))?.balance ?? '0')
  return { sui: (Number(of('0x2::sui::SUI')) / 1e9).toFixed(3), usdc: fromAtomic(of(usdcType())) }
}

// Send `amount` atomic USDC from the agent's wallet to `payTo`. Returns the digest
// once the transaction is final, so the seller can look it up straight away.
export async function payUsdc(payTo, amount) {
  if (paymentsMock()) {
    const digest = `mock${randomBytes(16).toString('hex')}`
    mockAgentDigests.add(digest)
    return digest
  }
  const signer = agentKeypair()
  const tx = new Transaction()
  tx.setSender(signer.getPublicKey().toSuiAddress())
  tx.transferObjects([coinWithBalance({ type: usdcType(), balance: BigInt(amount) })], payTo)
  const res = await sui().signAndExecuteTransaction({ transaction: tx, signer })
  if (res.$kind !== 'Transaction') throw new Error(`Payment failed on chain: ${errorText(res.FailedTransaction.status.error)}`)
  await sui().waitForTransaction({ digest: res.Transaction.digest })
  return res.Transaction.digest
}

// Seller side. A digest pays for an offer only if the transaction succeeded,
// sent at least `amount` of the right USDC to `payTo`, and landed after the offer
// was created (so an older transfer can't be reused). Replay across offers is
// checked by the caller against digests it has already accepted.
export async function verifyPayment({ digest, payTo, amount, notBefore }) {
  if (typeof digest !== 'string' || !/^(mock[0-9a-f]{32}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(digest)) {
    return { ok: false, reason: 'Not a Sui transaction digest' }
  }
  if (digest.startsWith('mock')) {
    // Mock digests the agent didn't make stand for a visitor's wallet.
    const payer = mockAgentDigests.has(digest) ? MOCK_AGENT : MOCK_VISITOR
    return paymentsMock() ? { ok: true, payer, paid: String(amount), timestampMs: Date.now() } : { ok: false, reason: 'Mock payments are off' }
  }
  let tx
  try {
    const res = await sui().getTransaction({ digest, include: { balanceChanges: true, transaction: true } })
    tx = res.Transaction ?? res.FailedTransaction
  } catch (err) {
    return { ok: false, reason: `Transaction not found through Tatum Sui gRPC: ${err.message}` }
  }
  if (!tx.status?.success) return { ok: false, reason: 'Transaction did not succeed' }
  const received = (tx.balanceChanges ?? [])
    .filter((c) => sameCoin(c.coinType, usdcType()) && sameAddress(c.address, payTo))
    .reduce((sum, c) => sum + BigInt(c.amount), 0n)
  if (received < BigInt(amount)) return { ok: false, reason: `Paid ${fromAtomic(received)} USDC to the seller, needs ${fromAtomic(amount)}` }
  const timestampMs = Number(tx.timestampMs ?? 0)
  if (notBefore && timestampMs && timestampMs < new Date(notBefore).getTime()) {
    return { ok: false, reason: 'Transaction is older than this offer' }
  }
  return { ok: true, payer: tx.transaction?.sender ?? null, paid: received.toString(), timestampMs }
}
