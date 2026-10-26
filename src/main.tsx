import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DAppKitProvider, createDAppKit } from '@mysten/dapp-kit-react'
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc'
import App from './App.tsx'
import './index.css'

type Network = 'mainnet' | 'testnet'

// Visitor wallets talk to Sui through the server's Tatum relay, so the browser
// never needs an RPC key. The server says which network payments settle on.
async function start() {
  const config = await fetch('/api/x402/config')
    .then((r) => r.json())
    .catch(() => ({}))
  const network: Network = config.network === 'testnet' ? 'testnet' : 'mainnet'
  const dAppKit = createDAppKit({
    networks: [network],
    defaultNetwork: network,
    createClient: (n) => new SuiJsonRpcClient({ network: n, transport: new JsonRpcHTTPTransport({ url: `${location.origin}/api/sui-rpc` }) }),
  })

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DAppKitProvider dAppKit={dAppKit}>
        <App />
      </DAppKitProvider>
    </StrictMode>,
  )
}

start()
