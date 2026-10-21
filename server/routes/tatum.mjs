import { Router } from 'express'
import { tatumApiBase, tatumRpc, MissingApiKeyError } from '../tatum-client.mjs'

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
    // Sui JSON-RPC method: suix_getAllBalances
    const rpcResponse = await tatumRpc('sui', {
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getAllBalances',
      params: [address.trim()],
    })

    if (!rpcResponse.ok) {
      const errText = await rpcResponse.text()
      return res.status(rpcResponse.status).json({
        error: `Tatum Sui gateway responded with ${rpcResponse.status}: ${errText}`,
      })
    }

    const data = await rpcResponse.json()
    if (data.error) {
      return res.status(400).json({ error: data.error.message || 'Sui RPC returned an error' })
    }

    const balancesList = data.result || []

    // SUI native coinType: "0x2::sui::SUI" (9 decimals)
    // Common Native USDC on Sui: "0xdba34672e30cb065b1f93e3ab5522878403066345d8b0255b6b67c53bf77796f::usdc::USDC" (6 decimals)
    // Also check for Wormhole or bridged USDC: contains "usdc" case-insensitive
    let totalSuiRaw = 0n
    let totalUsdcRaw = 0n

    for (const item of balancesList) {
      const coinType = (item.coinType || '').toLowerCase()
      const totalBalance = BigInt(item.totalBalance || '0')

      if (coinType.includes('::sui::sui') || coinType === '0x2::sui::sui') {
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
    if (error instanceof MissingApiKeyError) {
      return res.status(500).json({ error: 'TATUM_API_KEY is not set for this workspace' })
    }
    return res.status(500).json({ error: error.message || 'Failed to query Sui gateway' })
  }
})

export default router
