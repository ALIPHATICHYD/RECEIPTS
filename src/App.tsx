import React, { useState } from 'react';
import {
  TrendingUp,
  PlusCircle,
  Users,
  Brain,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  Filter,
  Flame,
  Award,
  ArrowUpRight
} from 'lucide-react';

interface PickItem {
  id: string;
  event: string;
  market: string;
  side: string;
  odds: string;
  sourceHandle: string;
  confidence: number;
  status: 'pending' | 'won' | 'lost';
  time: string;
  notes?: string;
  category: string;
}

interface SourceLeader {
  rank: number;
  handle: string;
  platform: string;
  winRate: number;
  roi: number;
  totalPicks: number;
  streak: string;
}

interface MemoryNote {
  id: string;
  title: string;
  date: string;
  insight: string;
  tags: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'feed' | 'log' | 'sources' | 'memory' | 'wallet'>('feed');
  const [walletAddress, setWalletAddress] = useState('0x7e8b912c478a5e81d77a06f3630f9a562473850cb05ef2ebf4c5a7536d76bb30');
  const [suiBalance, setSuiBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Form state for logging a pick
  const [formEvent, setFormEvent] = useState('');
  const [formMarket, setFormMarket] = useState('');
  const [formSide, setFormSide] = useState('');
  const [formOdds, setFormOdds] = useState('');
  const [formSource, setFormSource] = useState('@');
  const [formConfidence, setFormConfidence] = useState(70);
  const [formCategory, setFormCategory] = useState('Sports');
  const [formNotes, setFormNotes] = useState('');
  const [logSuccess, setLogSuccess] = useState(false);

  // Feed filter
  const [feedFilter, setFeedFilter] = useState<'all' | 'sports' | 'crypto' | 'polymarket'>('all');

  const [picks, setPicks] = useState<PickItem[]>([
    {
      id: '1',
      event: 'Boston Celtics vs NY Knicks',
      market: 'Moneyline',
      side: 'Celtics -4.5',
      odds: '-110',
      sourceHandle: '@StatViper',
      confidence: 85,
      status: 'pending',
      time: 'Tonight 7:30 PM',
      category: 'Sports',
      notes: 'Tatum returned to practice, heavy sharp action on Boston'
    },
    {
      id: '2',
      event: 'BTC > $100k by End of Month',
      market: 'Polymarket Binary',
      side: 'YES',
      odds: '0.68',
      sourceHandle: '@PredictorWhale',
      confidence: 78,
      status: 'pending',
      time: 'Closes in 6 days',
      category: 'Polymarket',
      notes: 'Spot ETF weekly inflows at 4-month high'
    },
    {
      id: '3',
      event: 'Arsenal vs Real Madrid',
      market: 'Both Teams to Score',
      side: 'YES',
      odds: '-125',
      sourceHandle: '@FootyAlpha',
      confidence: 65,
      status: 'won',
      time: 'Yesterday',
      category: 'Sports',
      notes: 'Hits in 8 of last 9 UCL fixtures'
    },
    {
      id: '4',
      event: 'Fed Rate Cut 25bps in June',
      market: 'Prediction Market',
      side: 'NO',
      odds: '0.42',
      sourceHandle: '@MacroJunkie',
      confidence: 90,
      status: 'lost',
      time: '2 days ago',
      category: 'Crypto',
      notes: 'CPI print cooled higher than consensus'
    }
  ]);

  const sources: SourceLeader[] = [
    { rank: 1, handle: '@PredictorWhale', platform: 'Polymarket / X', winRate: 74.2, roi: 31.8, totalPicks: 142, streak: 'W5' },
    { rank: 2, handle: '@StatViper', platform: 'Action / Discord', winRate: 68.5, roi: 24.1, totalPicks: 310, streak: 'W2' },
    { rank: 3, handle: '@FootyAlpha', platform: 'Telegram', winRate: 64.0, roi: 18.9, totalPicks: 89, streak: 'W3' },
    { rank: 4, handle: '@MacroJunkie', platform: 'Substack', winRate: 58.7, roi: 11.2, totalPicks: 64, streak: 'L1' },
    { rank: 5, handle: '@SharpEdgeBets', platform: 'X / Twitter', winRate: 55.4, roi: 8.6, totalPicks: 520, streak: 'W1' }
  ];

  const memories: MemoryNote[] = [
    {
      id: 'm1',
      title: 'Fade Public Overreactions on Back-to-Backs',
      date: 'May 12, 2026',
      insight: 'NBA road teams playing 3 in 4 nights cover the spread 38% of the time when listed as underdogs of 3 points or fewer.',
      tags: ['NBA', 'Fatigue-Model', 'System']
    },
    {
      id: 'm2',
      title: 'Polymarket Resolution Dispute Guardrails',
      date: 'May 08, 2026',
      insight: 'Avoid binary outcomes with ambiguous UMA oracle clauses within 12 hours of scheduled resolution.',
      tags: ['Crypto', 'Polymarket', 'Risk']
    },
    {
      id: 'm3',
      title: 'Tipster @StatViper Sharp Line Moves',
      date: 'Apr 29, 2026',
      insight: 'Line moves within 4 minutes of @StatViper posting in Discord. Always set push notification or place limit bets.',
      tags: ['Execution', 'Sources']
    }
  ];

  const handleCreatePick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEvent || !formMarket || !formSide) return;
    const newPick: PickItem = {
      id: Date.now().toString(),
      event: formEvent,
      market: formMarket,
      side: formSide,
      odds: formOdds || '+100',
      sourceHandle: formSource.startsWith('@') ? formSource : `@${formSource}`,
      confidence: formConfidence,
      status: 'pending',
      time: 'Just now',
      category: formCategory,
      notes: formNotes
    };
    setPicks([newPick, ...picks]);
    setFormEvent('');
    setFormMarket('');
    setFormSide('');
    setFormOdds('');
    setFormNotes('');
    setLogSuccess(true);
    setTimeout(() => setLogSuccess(false), 3000);
  };

  const fetchWallet = async () => {
    if (!walletAddress.trim()) return;
    setIsLoadingWallet(true);
    setWalletError(null);
    try {
      const res = await fetch(`/api/sui/balance?address=${encodeURIComponent(walletAddress.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch balance');
      }
      setSuiBalance(data.sui);
      setUsdcBalance(data.usdc);
    } catch (err: any) {
      setWalletError(err.message || 'Error fetching Sui balance');
    } finally {
      setIsLoadingWallet(false);
    }
  };

  const filteredPicks = picks.filter((p) => {
    if (feedFilter === 'all') return true;
    if (feedFilter === 'sports') return p.category.toLowerCase() === 'sports';
    if (feedFilter === 'polymarket') return p.category.toLowerCase() === 'polymarket';
    if (feedFilter === 'crypto') return p.category.toLowerCase() === 'crypto';
    return true;
  });

  return (
    <div className="min-h-screen bg-primary text-primary font-sans antialiased selection:bg-brand-solid selection:text-primary-on-brand flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-secondary bg-secondary sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-xl py-lg flex items-center justify-between">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-md bg-brand-solid flex items-center justify-center shadow-xs">
              <Flame className="w-5 h-5 text-primary-on-brand" />
            </div>
            <div>
              <div className="flex items-center gap-xs">
                <span className="text-heading-xs font-bold tracking-tight">Receipts</span>
                <span className="px-xs py-xxs rounded-sm bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 text-xs font-semibold">
                  Pick Journal
                </span>
              </div>
              <p className="text-xs text-tertiary">Sports &amp; Prediction Markets Tracker</p>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-xs bg-tertiary p-xxs rounded-md border border-secondary">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-lg py-xs rounded-sm text-sm font-medium transition-colors flex items-center gap-xs ${
                activeTab === 'feed'
                  ? 'bg-secondary text-primary shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-secondary-hover'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Feed
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={`px-lg py-xs rounded-sm text-sm font-medium transition-colors flex items-center gap-xs ${
                activeTab === 'log'
                  ? 'bg-secondary text-primary shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-secondary-hover'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Log Pick
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-lg py-xs rounded-sm text-sm font-medium transition-colors flex items-center gap-xs ${
                activeTab === 'sources'
                  ? 'bg-secondary text-primary shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-secondary-hover'
              }`}
            >
              <Users className="w-4 h-4" />
              Sources
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`px-lg py-xs rounded-sm text-sm font-medium transition-colors flex items-center gap-xs ${
                activeTab === 'memory'
                  ? 'bg-secondary text-primary shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-secondary-hover'
              }`}
            >
              <Brain className="w-4 h-4" />
              Memory
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`px-lg py-xs rounded-sm text-sm font-medium transition-colors flex items-center gap-xs ${
                activeTab === 'wallet'
                  ? 'bg-secondary text-primary shadow-xs'
                  : 'text-secondary hover:text-primary hover:bg-secondary-hover'
              }`}
            >
              <Wallet className="w-4 h-4" />
              Sui Wallet
            </button>
          </nav>

          {/* Quick wallet status badge */}
          <div className="hidden lg:flex items-center gap-sm">
            <div className="px-md py-xs rounded-md bg-tertiary border border-secondary text-xs flex items-center gap-xs">
              <span className="w-2 h-2 rounded-full bg-brand-solid animate-pulse"></span>
              <span className="text-secondary font-medium">Sui Mainnet</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-xl py-2xl">
        {/* ================= FEED VIEW ================= */}
        {activeTab === 'feed' && (
          <div className="space-y-2xl">
            {/* Top stats bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-lg">
              <div className="p-xl rounded-md bg-secondary border border-secondary">
                <span className="text-xs text-tertiary uppercase font-semibold tracking-wider">Total Tracked</span>
                <div className="text-heading-sm font-bold mt-xs">24 Picks</div>
                <div className="text-xs text-secondary mt-xxs">Across 6 tipsters</div>
              </div>
              <div className="p-xl rounded-md bg-secondary border border-secondary">
                <span className="text-xs text-tertiary uppercase font-semibold tracking-wider">Win Rate (30d)</span>
                <div className="text-heading-sm font-bold text-brand-primary mt-xs">68.4%</div>
                <div className="text-xs text-secondary mt-xxs">13W - 6L (5 Pending)</div>
              </div>
              <div className="p-xl rounded-md bg-secondary border border-secondary">
                <span className="text-xs text-tertiary uppercase font-semibold tracking-wider">Aggregated ROI</span>
                <div className="text-heading-sm font-bold text-brand-primary mt-xs">+22.7%</div>
                <div className="text-xs text-secondary mt-xxs">+18.4 Units net gain</div>
              </div>
              <div className="p-xl rounded-md bg-secondary border border-secondary">
                <span className="text-xs text-tertiary uppercase font-semibold tracking-wider">Top Source</span>
                <div className="text-heading-sm font-bold mt-xs">@PredictorWhale</div>
                <div className="text-xs text-secondary mt-xxs">74% accuracy on Poly</div>
              </div>
            </div>

            {/* Header + Filter controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md border-b border-secondary pb-lg">
              <div>
                <h1 className="text-heading-sm font-bold">Pick Journal Feed</h1>
                <p className="text-sm text-secondary">Today&apos;s verified bets, predictions, and community receipts</p>
              </div>
              <div className="flex items-center gap-xs">
                <button
                  onClick={() => setFeedFilter('all')}
                  className={`px-md py-xs rounded-sm text-xs font-medium border ${
                    feedFilter === 'all'
                      ? 'bg-brand-solid text-primary-on-brand border-transparent'
                      : 'bg-secondary text-secondary border-secondary hover:text-primary'
                  }`}
                >
                  All Picks
                </button>
                <button
                  onClick={() => setFeedFilter('sports')}
                  className={`px-md py-xs rounded-sm text-xs font-medium border ${
                    feedFilter === 'sports'
                      ? 'bg-brand-solid text-primary-on-brand border-transparent'
                      : 'bg-secondary text-secondary border-secondary hover:text-primary'
                  }`}
                >
                  Sports
                </button>
                <button
                  onClick={() => setFeedFilter('polymarket')}
                  className={`px-md py-xs rounded-sm text-xs font-medium border ${
                    feedFilter === 'polymarket'
                      ? 'bg-brand-solid text-primary-on-brand border-transparent'
                      : 'bg-secondary text-secondary border-secondary hover:text-primary'
                  }`}
                >
                  Polymarket
                </button>
                <button
                  onClick={() => setFeedFilter('crypto')}
                  className={`px-md py-xs rounded-sm text-xs font-medium border ${
                    feedFilter === 'crypto'
                      ? 'bg-brand-solid text-primary-on-brand border-transparent'
                      : 'bg-secondary text-secondary border-secondary hover:text-primary'
                  }`}
                >
                  Macro &amp; Crypto
                </button>
              </div>
            </div>

            {/* Picks List */}
            <div className="space-y-md">
              {filteredPicks.map((pick) => (
                <div
                  key={pick.id}
                  className="p-xl rounded-md bg-secondary border border-secondary hover:border-primary transition-all flex flex-col md:flex-row md:items-center justify-between gap-lg"
                >
                  <div className="space-y-xs">
                    <div className="flex items-center gap-sm">
                      <span className="px-xs py-xxs rounded-sm bg-tertiary border border-secondary text-xs text-secondary font-medium">
                        {pick.category}
                      </span>
                      <span className="text-xs text-tertiary flex items-center gap-xxs">
                        <Clock className="w-3 h-3" />
                        {pick.time}
                      </span>
                      <span className="text-xs font-medium text-brand-primary">{pick.sourceHandle}</span>
                    </div>

                    <div className="flex items-baseline gap-sm">
                      <h3 className="text-base font-bold text-primary">{pick.event}</h3>
                      <span className="text-xs text-tertiary">({pick.market})</span>
                    </div>

                    {pick.notes && <p className="text-xs text-secondary italic">&ldquo;{pick.notes}&rdquo;</p>}
                  </div>

                  <div className="flex items-center gap-xl border-t md:border-t-0 pt-md md:pt-0 border-secondary">
                    {/* Pick & Odds */}
                    <div className="text-right min-w-[120px]">
                      <div className="text-xs text-tertiary uppercase font-medium">Selected Side</div>
                      <div className="text-sm font-bold text-primary">{pick.side}</div>
                      <div className="text-xs text-secondary font-mono">{pick.odds}</div>
                    </div>

                    {/* Confidence Gauge */}
                    <div className="min-w-[80px] text-center">
                      <div className="text-xs text-tertiary uppercase font-medium">Confidence</div>
                      <div className="text-sm font-bold text-brand-primary">{pick.confidence}%</div>
                      <div className="w-16 h-1.5 bg-tertiary rounded-full overflow-hidden mx-auto mt-xxs">
                        <div
                          className="h-full bg-brand-solid"
                          style={{ width: `${pick.confidence}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="min-w-[100px] flex justify-end">
                      {pick.status === 'won' && (
                        <span className="inline-flex items-center gap-xs rounded-full border border-utility-success-200 bg-utility-success-50 px-md py-xxs text-xs font-medium text-utility-success-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-fg-success-primary" /> Won
                        </span>
                      )}
                      {pick.status === 'lost' && (
                        <span className="inline-flex items-center gap-xs rounded-full border border-utility-error-200 bg-utility-error-50 px-md py-xxs text-xs font-medium text-utility-error-700">
                          <XCircle className="w-3.5 h-3.5 text-fg-error-primary" /> Lost
                        </span>
                      )}
                      {pick.status === 'pending' && (
                        <span className="inline-flex items-center gap-xs rounded-full border border-secondary bg-tertiary px-md py-xxs text-xs font-medium text-secondary">
                          <Clock className="w-3.5 h-3.5 text-fg-tertiary" /> Open
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= LOG PICK FORM VIEW ================= */}
        {activeTab === 'log' && (
          <div className="max-w-2xl mx-auto space-y-xl">
            <div className="border-b border-secondary pb-md">
              <h1 className="text-heading-sm font-bold">Log New Pick (Receipt)</h1>
              <p className="text-sm text-secondary">
                Record an on-record pick before the event settles to hold tipsters and models accountable.
              </p>
            </div>

            {logSuccess && (
              <div className="p-lg rounded-md bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 text-sm font-medium flex items-center gap-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                Receipt verified and logged into your local timeline!
              </div>
            )}

            <form onSubmit={handleCreatePick} className="p-2xl rounded-md bg-secondary border border-secondary space-y-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-md py-sm rounded-md bg-tertiary border border-secondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  >
                    <option value="Sports">Sports (NBA, NFL, Soccer, etc.)</option>
                    <option value="Polymarket">Polymarket / Prediction Market</option>
                    <option value="Crypto">Crypto Price Binary</option>
                    <option value="Macro">Macro / Politics</option>
                  </select>
                </div>

                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Source Handle</label>
                  <input
                    type="text"
                    placeholder="@tipster or @model"
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="w-full px-md py-sm rounded-md bg-tertiary border border-secondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
                    required
                  />
                </div>
              </div>

              <div className="space-y-xs">
                <label className="text-xs font-medium text-secondary uppercase tracking-wider">Event / Matchup</label>
                <input
                  type="text"
                  placeholder="e.g. Kansas City Chiefs vs SF 49ers or ETH > $4,000"
                  value={formEvent}
                  onChange={(e) => setFormEvent(e.target.value)}
                  className="w-full px-md py-sm rounded-md bg-tertiary border border-secondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Market Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Spread, Total, Binary Yes/No"
                    value={formMarket}
                    onChange={(e) => setFormMarket(e.target.value)}
                    className="w-full px-md py-sm rounded-md bg-tertiary border border-secondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
                    required
                  />
                </div>

                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Side / Pick</label>
                  <input
                    type="text"
                    placeholder="e.g. Chiefs -3.5 or YES"
                    value={formSide}
                    onChange={(e) => setFormSide(e.target.value)}
                    className="w-full px-md py-sm rounded-md bg-tertiary border border-secondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
                    required
                  />
                </div>

                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Odds / Price</label>
                  <input
                    type="text"
                    placeholder="e.g. -110 or 0.65"
                    value={formOdds}
                    onChange={(e) => setFormOdds(e.target.value)}
                    className="w-full px-md py-sm rounded-md bg-tertiary border border-secondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  />
                </div>
              </div>

              <div className="space-y-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Confidence Level</label>
                  <span className="text-xs font-bold text-brand-primary">{formConfidence}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={formConfidence}
                  onChange={(e) => setFormConfidence(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="space-y-xs">
                <label className="text-xs font-medium text-secondary uppercase tracking-wider">Notes &amp; Rationale</label>
                <textarea
                  rows={3}
                  placeholder="Key injury update, edge calculation, or insider thesis..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-md py-sm rounded-md bg-tertiary border border-secondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-md rounded-md bg-brand-solid hover:bg-brand-solid-hover text-primary-on-brand font-semibold text-sm transition-colors border border-transparent shadow-xs flex items-center justify-center gap-xs"
              >
                <PlusCircle className="w-4 h-4" />
                Commit Receipt to Journal
              </button>
            </form>
          </div>
        )}

        {/* ================= SOURCES LEADERBOARD VIEW ================= */}
        {activeTab === 'sources' && (
          <div className="space-y-xl">
            <div className="border-b border-secondary pb-md">
              <h1 className="text-heading-sm font-bold">Tipster &amp; Model Leaderboard</h1>
              <p className="text-sm text-secondary">
                Audited performance metrics, historical win rates, and return on investment
              </p>
            </div>

            <div className="rounded-md border border-secondary overflow-hidden bg-secondary">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-secondary bg-tertiary text-xs font-medium text-tertiary uppercase tracking-wider">
                    <th className="py-md px-lg">Rank</th>
                    <th className="py-md px-lg">Handle / Source</th>
                    <th className="py-md px-lg">Platform</th>
                    <th className="py-md px-lg">Win Rate</th>
                    <th className="py-md px-lg">ROI</th>
                    <th className="py-md px-lg">Total Logged</th>
                    <th className="py-md px-lg">Current Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary text-sm">
                  {sources.map((src) => (
                    <tr key={src.handle} className="hover:bg-secondary-hover transition-colors">
                      <td className="py-md px-lg font-bold">
                        {src.rank === 1 ? (
                          <span className="flex items-center gap-xs text-brand-primary">
                            <Award className="w-4 h-4 text-fg-brand-primary" /> #1
                          </span>
                        ) : (
                          `#${src.rank}`
                        )}
                      </td>
                      <td className="py-md px-lg font-medium text-primary">
                        <div className="flex items-center gap-xs">
                          <span>{src.handle}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-fg-quaternary" />
                        </div>
                      </td>
                      <td className="py-md px-lg text-secondary text-xs">{src.platform}</td>
                      <td className="py-md px-lg">
                        <span className="font-semibold text-brand-primary">{src.winRate}%</span>
                      </td>
                      <td className="py-md px-lg">
                        <span className="font-semibold text-brand-primary">+{src.roi}%</span>
                      </td>
                      <td className="py-md px-lg text-secondary">{src.totalPicks} picks</td>
                      <td className="py-md px-lg">
                        <span className="px-xs py-xxs rounded-sm bg-tertiary border border-secondary text-xs font-mono font-medium">
                          {src.streak}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= MEMORY NOTES VIEW ================= */}
        {activeTab === 'memory' && (
          <div className="space-y-xl">
            <div className="border-b border-secondary pb-md flex items-center justify-between">
              <div>
                <h1 className="text-heading-sm font-bold">Memory &amp; Playbook</h1>
                <p className="text-sm text-secondary">
                  System insights, market anomalies, and betting rules learned from previous outcomes
                </p>
              </div>
              <button className="px-lg py-xs rounded-md bg-secondary border border-secondary text-xs font-semibold text-primary hover:bg-tertiary transition-colors flex items-center gap-xs">
                <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
                Add Insight
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              {memories.map((mem) => (
                <div
                  key={mem.id}
                  className="p-xl rounded-md bg-secondary border border-secondary flex flex-col justify-between hover:border-primary transition-all"
                >
                  <div className="space-y-sm">
                    <div className="flex items-center justify-between text-xs text-tertiary">
                      <span>{mem.date}</span>
                      <Brain className="w-3.5 h-3.5 text-brand-primary" />
                    </div>
                    <h3 className="text-base font-bold text-primary">{mem.title}</h3>
                    <p className="text-sm text-secondary leading-relaxed">{mem.insight}</p>
                  </div>

                  <div className="mt-xl flex flex-wrap gap-xs">
                    {mem.tags.map((t) => (
                      <span
                        key={t}
                        className="px-xs py-xxs rounded-sm bg-tertiary border border-secondary text-xs text-tertiary"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= SUI WALLET VIEW ================= */}
        {activeTab === 'wallet' && (
          <div className="max-w-3xl mx-auto space-y-xl">
            <div className="border-b border-secondary pb-md">
              <h1 className="text-heading-sm font-bold">Sui Wallet Reader</h1>
              <p className="text-sm text-secondary">
                Read real-time SUI and USDC balances on Sui Mainnet powered by Tatum RPC Gateway
              </p>
            </div>

            <div className="p-2xl rounded-md bg-secondary border border-secondary space-y-xl">
              <div className="space-y-xs">
                <label className="text-xs font-medium text-secondary uppercase tracking-wider">
                  Sui Wallet Address
                </label>
                <div className="flex gap-sm">
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="0x..."
                    className="flex-1 px-md py-sm rounded-md bg-tertiary border border-secondary text-primary font-mono text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  />
                  <button
                    onClick={fetchWallet}
                    disabled={isLoadingWallet}
                    className="px-xl py-sm rounded-md bg-brand-solid hover:bg-brand-solid-hover disabled:bg-disabled-subtle text-primary-on-brand font-medium text-sm transition-colors border border-transparent shadow-xs flex items-center gap-xs"
                  >
                    {isLoadingWallet ? 'Querying...' : 'Fetch Balances'}
                  </button>
                </div>
              </div>

              {walletError && (
                <div className="p-md rounded-md bg-utility-error-50 border border-utility-error-200 text-utility-error-700 text-xs">
                  {walletError}
                </div>
              )}

              {/* Balance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg pt-md">
                {/* SUI Card */}
                <div className="p-xl rounded-md bg-tertiary border border-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-tertiary uppercase font-medium">Native Asset</span>
                    <span className="px-xs py-xxs rounded-sm bg-secondary text-xs font-mono text-secondary">
                      0x2::sui::SUI
                    </span>
                  </div>
                  <div className="text-heading-md font-bold mt-sm text-primary">
                    {suiBalance !== null ? `${suiBalance} SUI` : '—'}
                  </div>
                  <p className="text-xs text-secondary mt-xxs">Gas &amp; staking currency on Sui Mainnet</p>
                </div>

                {/* USDC Card */}
                <div className="p-xl rounded-md bg-tertiary border border-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-tertiary uppercase font-medium">Stablecoin</span>
                    <span className="px-xs py-xxs rounded-sm bg-secondary text-xs font-mono text-secondary">
                      USDC (Native)
                    </span>
                  </div>
                  <div className="text-heading-md font-bold mt-sm text-primary">
                    {usdcBalance !== null ? `${usdcBalance} USDC` : '—'}
                  </div>
                  <p className="text-xs text-secondary mt-xxs">Polymarket &amp; market settlement currency</p>
                </div>
              </div>

              {/* RPC info box */}
              <div className="p-lg rounded-md bg-tertiary border border-secondary flex items-start gap-md">
                <Wallet className="w-5 h-5 text-brand-primary flex-shrink-0 mt-xxs" />
                <div className="text-xs space-y-xxs text-secondary">
                  <div className="font-semibold text-primary">Connected to Tatum Sui Mainnet Gateway</div>
                  <div>
                    Calls <code className="text-brand-primary font-mono">suix_getAllBalances</code> via server-side Tatum RPC client with secured API credentials.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
