# Receipts

**A pick journal that remembers who was actually right.**

Tipsters on X, Telegram and WhatsApp delete their losing calls and screenshot their wins. Receipts records every pick *before* the event, stores it on [Walrus Memory](https://docs.wal.app/walrus-memory) so it can't be quietly edited or deleted, and builds up credibility for each source from real results.

Built for the Tatum x Walrus **Total Recall** hackathon (Track 01: Markets & Sports Prediction).

## What works today

- **Log a pick** with event, market, side, odds, source and confidence. Each pick becomes a Walrus memory with a blob you can open on Walruscan.
- **Paste a tip**: paste a tipster's post and Receipts pre-fills the form (matchup, spread/total/moneyline/yes-no, odds, units). You confirm before anything is stored.
- **Feed and source leaderboard**, rebuilt from Walrus Memory on every load.
- **Memory inspector** listing every memory the app has written, by namespace, with blob links and progress toward the 10-memory Mainnet requirement.
- **Sui wallet reader** for SUI and USDC balances through the Tatum Sui Mainnet RPC gateway.

## Coming next

- Automatic grading after each event, and append-only credibility scores per source and league
- Agent advice that cites the memories it used
- Pay-per-pick with x402, settled in USDC on Sui and verified through Tatum's Sui RPC

## How memory is used

| Namespace | What is stored |
|---|---|
| `receipts-picks` | One memory per pick: a readable sentence for semantic recall, plus the exact JSON record |
| `receipts-credibility` | Credibility scores per source × league (append-only: a new score supersedes the old one) |
| `receipts-profile` | The user's own patterns and limits |

Records are never edited. Grading a pick writes a new record; the newest record per pick wins.

## Run it locally

Requires Node 22.9+.

```bash
npm install
cp .env.example .env   # fill in your keys
npm run dev            # http://localhost:3000
```

No keys yet? `npm run dev:mock` runs the whole app against an in-memory mock of Walrus Memory (nothing is stored).

### Environment

| Variable | Purpose |
|---|---|
| `TATUM_API_KEY` | Tatum API key ([dashboard](https://dashboard.tatum.io/)) for the Sui RPC gateway |
| `MEMWAL_PRIVATE_KEY` | Walrus Memory delegate private key |
| `MEMWAL_ACCOUNT_ID` | Walrus Memory account object ID |
| `MEMWAL_NETWORK` | `testnet` (default) or `mainnet` |
| `MEMWAL_SERVER_URL` | Optional relayer override |
| `MEMWAL_MOCK` | `1` to use the in-memory mock |

Create the Walrus Memory account and delegate key at [memory.walrus.xyz](https://memory.walrus.xyz) (Mainnet) or [staging.memory.walrus.xyz](https://staging.memory.walrus.xyz) (Testnet).

## Stack

React + TypeScript + Vite + Tailwind, served by one Express process (`server/index.mjs`).

- `server/memwal-client.mjs`: Walrus Memory client (`@mysten-incubation/memwal`)
- `server/picks.mjs`: pick record format and the paste-a-tip parser
- `server/routes/receipts.mjs`: picks and memory API
- `server/routes/tatum.mjs`, `server/tatum-client.mjs`: Tatum Sui RPC
- `src/`: frontend

The initial shell was generated with [Tatum AI Builder](https://ai.tatum.io/) (first commit) and extended from there.
