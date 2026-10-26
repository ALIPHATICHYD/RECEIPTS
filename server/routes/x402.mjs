import express, { Router } from 'express'
import { memwal, NAMESPACES } from '../memwal-client.mjs'
import { validatePickInput, encodePick } from '../picks.mjs'
import { loadCredibility, credKey, recallAll, proof } from '../learning.mjs'
import { createOffer, getOffer, isDigestUsed, unlockFor, recordUnlock, listOffers, publicOffer } from '../offers.mjs'
import {
  agentAddress,
  balances,
  payUsdc,
  verifyPayment,
  paymentsNetwork,
  paymentsMock,
  usdcType,
  fromAtomic,
  toAtomic,
  txExplorerUrl,
  PaymentConfigError,
} from '../sui-payments.mjs'
import { sendError } from './receipts.mjs'
import { relayGrpcWeb } from '../sui-grpc.mjs'

const router = Router()
const PAY_MARKER = 'RECEIPTS_PAY_V1 '

function fail(res, err, fallback) {
  if (err instanceof PaymentConfigError) return res.status(503).json({ error: err.message, code: 'payments-not-configured' })
  return sendError(res, err, fallback)
}

async function remember(sentence, record) {
  const accepted = await memwal().remember(`${sentence}\n${PAY_MARKER}${JSON.stringify(record)}`, NAMESPACES.payments)
  return accepted.job_id
}

const network = () => `sui-${paymentsNetwork()}`

// ---------- Seller side ----------

// What a browser wallet needs to build the payment itself.
router.get('/x402/config', (_req, res) => {
  res.json({ network: paymentsNetwork(), mock: paymentsMock(), usdcType: usdcType() })
})

// Sui gRPC-web for browser wallets, relayed to Tatum's Sui gRPC gateway as native gRPC so the
// API key stays on the server. Reads, simulation and executing an already-signed
// transaction only; streaming subscriptions are not relayed.
const GRPC_ALLOWED = /^sui\.rpc\.v2\.(LedgerService|StateService|MovePackageService|NameService|SignatureVerificationService|TransactionExecutionService)\/[A-Za-z]+$/
router.post('/sui-grpc/:method(*)', express.raw({ type: () => true, limit: '1mb' }), (req, res) => {
  const method = req.params.method
  if (!GRPC_ALLOWED.test(method)) return res.status(403).set('grpc-status', '7').set('grpc-message', 'Method not allowed through this relay').end()
  if (!process.env.TATUM_API_KEY) return res.status(503).set('grpc-status', '14').set('grpc-message', 'TATUM_API_KEY is not set').end()
  relayGrpcWeb(paymentsNetwork(), method, req.body, res)
})

router.get('/x402/offers', (_req, res) => {
  res.json({ network: paymentsNetwork(), mock: paymentsMock(), offers: listOffers() })
})

// Seal a pick: the pick stays here, a commitment to it goes to Walrus now.
router.post('/x402/offers', async (req, res) => {
  const { offer, error } = createOffer(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const sentence =
      `Sealed pick: ${offer.source} put a ${offer.league} pick on ${offer.event} behind an x402 paywall for ${offer.price} USDC on Sui, ` +
      `created ${offer.createdAt}. Commitment sha256:${offer.commitment}; the pick is revealed only after payment.`
    const jobId = await remember(sentence, {
      type: 'sealed',
      offerId: offer.id,
      source: offer.source,
      league: offer.league,
      event: offer.event,
      price: offer.price,
      payTo: offer.payTo,
      commitment: offer.commitment,
      recordedAt: offer.createdAt,
    })
    res.status(201).json({ offer: publicOffer(offer), jobId })
  } catch (err) {
    fail(res, err, 'Sealed the pick but could not write its commitment to Walrus')
  }
})

function paymentRequired(req, offer, error) {
  return {
    x402Version: 1,
    error,
    accepts: [
      {
        scheme: 'exact',
        network: network(),
        maxAmountRequired: offer.amount,
        resource: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        description: `${offer.source}'s ${offer.league} pick on ${offer.event}`,
        mimeType: 'application/json',
        payTo: offer.payTo,
        maxTimeoutSeconds: 600,
        asset: usdcType(),
        extra: { source: offer.source, league: offer.league, teaser: offer.teaser, commitment: offer.commitment, createdAt: offer.createdAt },
      },
    ],
  }
}

function decodePaymentHeader(header) {
  try {
    const p = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
    return p?.x402Version === 1 && p?.scheme === 'exact' ? p : null
  } catch {
    return null
  }
}

// The x402 resource. Without X-PAYMENT it answers 402 with the terms; with one,
// it checks the Sui transaction through Tatum and releases the pick.
router.get('/x402/offers/:id/pick', async (req, res) => {
  const offer = getOffer(req.params.id)
  if (!offer) return res.status(404).json({ error: 'No such sealed pick' })
  const header = req.get('X-PAYMENT')
  if (!header) return res.status(402).json(paymentRequired(req, offer, 'X-PAYMENT header is required'))

  const payment = decodePaymentHeader(header)
  const digest = payment?.payload?.transactionDigest
  if (!payment || payment.network !== network()) return res.status(402).json(paymentRequired(req, offer, 'Invalid X-PAYMENT header'))
  // One transaction unlocks one offer. Re-sending the same proof for the same
  // offer returns the pick again (a buyer reloading), anything else is refused.
  const previous = unlockFor(offer, digest)
  if (!previous && isDigestUsed(digest)) return res.status(402).json(paymentRequired(req, offer, 'This payment was already used'))
  try {
    const check = previous ? { ok: true, payer: previous.payer } : await verifyPayment({ digest, payTo: offer.payTo, amount: offer.amount, notBefore: offer.createdAt })
    if (!check.ok) return res.status(402).json(paymentRequired(req, offer, check.reason))
    if (!previous) {
      let agent = null
      try {
        agent = agentAddress()
      } catch {}
      recordUnlock(offer.id, { digest, payer: check.payer, at: new Date().toISOString() }, { byAgent: !!agent && check.payer?.toLowerCase() === agent.toLowerCase() })
    }
    const settlement = { success: true, network: network(), transaction: digest, payer: check.payer }
    res.set('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(settlement)).toString('base64'))
    res.json({ pick: { ...offer.hidden, event: offer.event, source: offer.source, league: offer.league, category: offer.category }, salt: offer.salt, commitment: offer.commitment, settlement })
  } catch (err) {
    fail(res, err, 'Could not verify the payment')
  }
})

// ---------- Buyer side: the agent ----------

router.get('/agent/wallet', async (_req, res) => {
  try {
    const address = agentAddress()
    res.json({ address, network: paymentsNetwork(), mock: paymentsMock(), ...(await balances(address)) })
  } catch (err) {
    fail(res, err, 'Could not read the agent wallet')
  }
})

router.get('/agent/decisions', async (_req, res) => {
  try {
    const hits = await recallAll(NAMESPACES.payments, 'Agent decision paid skipped sealed pick x402 USDC')
    const records = hits
      .map((h) => {
        const line = h.text?.split('\n').find((l) => l.startsWith(PAY_MARKER))
        if (!line) return null
        try {
          return { ...JSON.parse(line.slice(PAY_MARKER.length)), text: h.text.split('\n')[0], ...proof(h) }
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    res.json({ records })
  } catch (err) {
    fail(res, err, 'Could not recall payment decisions')
  }
})

// The agent asks for a sealed pick like any x402 client: it reads the 402 terms,
// decides from remembered credibility whether the source has earned the price,
// pays on Sui if so, retries with the payment proof, logs the pick, and writes
// down why it paid or walked away.
router.post('/agent/buy', async (req, res) => {
  const minTrust = Math.min(100, Math.max(0, Number(req.body?.minTrust ?? process.env.AGENT_MIN_TRUST ?? 55)))
  const maxPrice = String(req.body?.maxPrice ?? process.env.AGENT_MAX_PRICE_USDC ?? '0.25')
  const url = `${req.protocol}://${req.get('host')}/api/x402/offers/${encodeURIComponent(String(req.body?.offerId ?? ''))}/pick`
  try {
    const first = await fetch(url)
    if (first.status === 404) return res.status(404).json({ error: 'No such sealed pick' })
    if (first.status !== 402) return res.status(409).json({ error: 'This pick is not behind a paywall' })
    const terms = (await first.json()).accepts?.find((a) => a.scheme === 'exact' && a.network === network())
    if (!terms) return res.status(502).json({ error: `Seller does not accept ${network()}` })

    const { source, league } = terms.extra
    const cred = (await loadCredibility()).current.get(credKey(source, league))
    const trust = cred?.trust ?? null
    const price = fromAtomic(terms.maxAmountRequired)
    const base = { type: 'decision', offerId: req.body.offerId, source, league, trust, graded: cred?.n ?? 0, minTrust, maxPrice, price, recordedAt: new Date().toISOString() }

    let skip = null
    if (BigInt(terms.maxAmountRequired) > toAtomic(maxPrice)) skip = `price ${price} USDC is above the ${maxPrice} USDC limit`
    else if (trust === null || !cred.n) skip = `${source} has no graded record on ${league} yet`
    else if (trust < minTrust) skip = `${source}'s trust on ${league} is ${trust}, below the bar of ${minTrust}`
    if (skip) {
      const sentence = `Agent decision: skipped ${source}'s sealed ${league} pick (${price} USDC) because ${skip}.`
      const jobId = await remember(sentence, { ...base, decision: 'skipped', reason: skip })
      return res.json({ decision: 'skipped', reason: skip, sentence, jobId })
    }

    const digest = await payUsdc(terms.payTo, terms.maxAmountRequired)
    const header = Buffer.from(JSON.stringify({ x402Version: 1, scheme: 'exact', network: network(), payload: { transactionDigest: digest } })).toString('base64')
    const second = await fetch(url, { headers: { 'X-PAYMENT': header } })
    const body = await second.json()
    if (!second.ok) throw new Error(`Paid (tx ${digest}) but the seller refused it: ${body.error ?? second.status}`)

    const { pick, error } = validatePickInput({
      ...body.pick,
      source,
      confidence: 60,
      notes:
        `${body.pick.notes ? `${body.pick.notes} ` : ''}Bought by the agent via x402 for ${price} USDC on Sui (tx ${digest}). ` +
        `Sealed with commitment sha256:${body.commitment}, salt ${body.salt}.`,
    })
    if (error) throw new Error(`Seller returned an unusable pick: ${error}`)
    pick.purchase = { offerId: req.body.offerId, digest, price, network: network() }
    const pickJob = await memwal().remember(encodePick(pick), NAMESPACES.picks, { idempotencyKey: pick.id })

    const why = `${source}'s trust on ${league} is ${trust} (${cred.n} graded), at or above the bar of ${minTrust}, and ${price} USDC is within the ${maxPrice} USDC limit`
    const sentence = `Agent decision: paid ${price} USDC on Sui to unlock ${source}'s ${league} pick because ${why}. ${paymentsMock() ? `Mock payment ${digest}, nothing was paid.` : `Transaction ${digest}, verified through Tatum Sui RPC.`}`
    const jobId = await remember(sentence, { ...base, decision: 'paid', reason: why, digest, pickId: pick.id })
    res.json({ decision: 'paid', reason: why, sentence, digest, txUrl: txExplorerUrl(digest), pick, jobId, pickJobId: pickJob.job_id })
  } catch (err) {
    fail(res, err, 'The agent could not complete the purchase')
  }
})

export default router
