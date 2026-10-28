import { Router } from 'express'
import { tatumApiBase, MissingApiKeyError } from '../tatum-client.mjs'
import { sui, PaymentConfigError } from '../sui-payments.mjs'

const router = Router()

// Health check — a present key says nothing about egress, so make a real request.
router.get('/status', async (_req, res) => {
  if (!process.env.TATUM_API_KEY) return res.json({ status: 'no-api-key' })
  try {
    // Any HTTP response proves the request left the pod; the status code doesn't matter.
    await fetch(tatumApiBase(), { signal: AbortSignal.timeout(8000) })
    res.json({ status: 'connected' })
  } catch (error) {
    res.json({ status: 'egress-failed', error: error.message })
  }
})

// Query Sui account balances (SUI native + USDC coin balances) using Sui RPC gateway
router.get('/sui/balance', async (req, res) => {
  const address = req.query.address
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid Sui address parameter' })
  }

  try {
    // Sui's gRPC API through Tatum (mainnet JSON-RPC has been switched off).
    const { balances: balancesList } = await sui().listBalances({ owner: address.trim() })

    // SUI native coinType: "0x2::sui::SUI" (9 decimals); USDC (6 decimals) matched by name
    let totalSuiRaw = 0n
    let totalUsdcRaw = 0n

    for (const item of balancesList) {
      const coinType = (item.coinType || '').toLowerCase()
      const totalBalance = BigInt(item.balance || '0')

      if (coinType.endsWith('::sui::sui')) {
        totalSuiRaw += totalBalance
      } else if (coinType.includes('usdc')) {
        totalUsdcRaw += totalBalance
      }
    }

    // Format SUI (9 decimals)
    const suiFormatted = (Number(totalSuiRaw) / 1e9).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })

    // Format USDC (6 decimals)
    const usdcFormatted = (Number(totalUsdcRaw) / 1e6).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    return res.json({
      address,
      sui: suiFormatted,
      usdc: usdcFormatted,
      rawBalances: balancesList,
    })
  } catch (error) {
    if (error instanceof MissingApiKeyError || error instanceof PaymentConfigError) {
      return res.status(500).json({ error: 'TATUM_API_KEY is not set for this workspace' })
    }
    return res.status(500).json({ error: error.message || 'Failed to query Sui gateway' })
  }
})

export default router
