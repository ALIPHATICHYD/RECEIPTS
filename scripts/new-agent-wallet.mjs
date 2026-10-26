// Creates a fresh Sui wallet for the Receipts agent. Prints the address to fund
// and the private key to put in .env as AGENT_SUI_PRIVATE_KEY. Run once:
//   node scripts/new-agent-wallet.mjs
// The key is shown only here: paste it into .env yourself, never into a chat.
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'

const kp = new Ed25519Keypair()
console.log(`Agent address (send it ~1 USDC and ~0.1 SUI on Sui mainnet):\n  ${kp.getPublicKey().toSuiAddress()}\n`)
console.log(`Add this line to .env (keep it secret):\n  AGENT_SUI_PRIVATE_KEY=${kp.getSecretKey()}`)
