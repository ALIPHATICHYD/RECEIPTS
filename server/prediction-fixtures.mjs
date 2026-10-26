// Recorded Tatum prediction API responses (trimmed from a live probe on 26 Oct
// 2026), served when PREDICTION_MOCK=1 so the app and tests run offline.
const outcome = (name, price) => ({ name, price })
const market = (id, question, status, outcomes, extra = {}) => ({
  id,
  platform: 'polymarket',
  question,
  category: 'Sports',
  status,
  closeTime: '2026-11-04T00:00:00.000Z',
  outcomes,
  volume: 1_000_000,
  resolution: null,
  source: { platform: 'polymarket', platformId: id, url: `https://polymarket.com/market/${id.slice(0, 10)}` },
  ...extra,
})

const MARKETS = [
  market('0x87091dc5932f015d80c40e71e47cb043c3f8b6098484eb5bc3943cf35ee9afc1', "Will Kylian Mbappé win the 2026 Ballon d'Or?", 'active', [outcome('YES', 0.2105), outcome('NO', 0.7895)], { volume: 7620363 }),
  market('0x307a1ed89d60b61002dd5bbf00e1408c5ed2ab3fcdb056191ca7ef9bc34d38f3', 'Will the Democratic Party control the Senate after the 2026 Midterm elections?', 'active', [outcome('YES', 0.645), outcome('NO', 0.355)], { category: 'Senate', volume: 5383660 }),
  market('0x064d33e3f5703792aafa92bfb0ee10e08f461b1b34c02c1f02671892ede1609a', 'NBA: Will the Mavericks beat the Grizzlies by more than 5.5 points in their December 4 matchup?', 'closed', [outcome('YES', 0), outcome('NO', 1)]),
  // Markets behind the fixture trades: the first has settled for the Grizzlies.
  market('0xc9e812dcd8d0bb7f18619915f13cc7230669d28ca7f6ba68bab02c05281d4244', 'Spread: Grizzlies (-4.5)', 'closed', [outcome('Grizzlies', 1), outcome('Kings', 0)]),
  market('0x822997ad1933a962b288c5532764a87620fb55d708ca29e0742316ee8446c2cf', 'Spread: Grizzlies (-5.5)', 'active', [outcome('Grizzlies', 0.47), outcome('Kings', 0.53)]),
]

const EVENTS = [
  { id: '48361', title: "Ballon d'Or Winner 2026", markets: [MARKETS[0]] },
  { id: '32224', title: 'Which party will win the Senate in 2026?', markets: [MARKETS[1]] },
]

const TRADERS = [
  { rank: 1, proxyWallet: '0xf0318c32136c2db7fec88b84869aee6a1106c80c', userName: 'BreakTheBank', xUsername: null, verifiedBadge: false, vol: 79171868.69, pnl: 8350213.67, profileImage: null },
  { rank: 2, proxyWallet: '0xcdcccd0f2d86e450d973da415ad2430e5cc7935a', userName: 'joseph00677', xUsername: null, verifiedBadge: false, vol: 46990663.22, pnl: 5685940.62, profileImage: null },
]

const trade = (conditionId, title, size, price, timestamp, transactionHash) => ({
  proxyWallet: TRADERS[0].proxyWallet,
  side: 'BUY',
  conditionId,
  size,
  price,
  timestamp,
  title,
  slug: 'nba-mem-sac-2026-10-25-spread',
  eventSlug: 'nba-mem-sac-2026-10-25',
  outcome: 'Grizzlies',
  outcomeIndex: 0,
  name: 'BreakTheBank',
  transactionHash,
})

const TRADES = [
  trade(MARKETS[3].id, 'Spread: Grizzlies (-4.5)', 5175.6, 0.49, 1792976951, '0x481e8d5716d87fa15e9cf49f56fe4bfa574d2a1de9d1e85414ec016a0db720a2'),
  trade(MARKETS[4].id, 'Spread: Grizzlies (-5.5)', 72.8, 0.45, 1792976484, '0x3ae4e4063c00b05cb9704d8591edf5c8295809aae07c42f4375b4ab7e43c5f9e'),
]

export function FIXTURES(path) {
  if (path.startsWith('/events')) return EVENTS
  if (path.startsWith('/top-traders')) return TRADERS
  if (/^\/wallets\/[^/]+\/trades/.test(path)) return TRADES
  const m = path.match(/^\/markets\/([^/?]+)$/)
  if (m) return MARKETS.find((x) => x.id === decodeURIComponent(m[1]))
  return undefined
}
