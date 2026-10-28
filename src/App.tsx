import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  ExternalLink,
  Flame,
  Award,
  RefreshCw,
  ClipboardPaste,
  AlertTriangle,
  Loader2,
  Link2,
  UserPlus,
  Search,
  Bot,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  api,
  waitForJob,
  sourceStats,
  timeAgo,
  shortId,
  type Category,
  type PickRecord,
  type PickInput,
  type MemoryRow,
  type JobStatus,
  type Advice,
  type CredibilityRecord,
  type ProfileData,
  type GradeResult,
  type PredictionMarket,
  type Trader,
  type LivePrice,
  type SealedOffer,
  type SealInput,
  type AgentDecision,
  type BuyResult,
  pct,
  setOwnerPasscode,
  usd,
} from './api';
import { ConnectWallet, WalletBuyButton } from './WalletBuy';
import { Landing } from './Landing';
import { SiteFooter } from './SiteFooter';
import { Logo, PageHead, Row, Rule, Slip, Stamp, TrustBar, slipNumber } from './thermal';

type Tab = 'feed' | 'log' | 'sources' | 'agent' | 'memory' | 'wallet';
type FeedFilter = 'all' | Category;


const EMPTY_FORM: PickInput = {
  event: '',
  market: '',
  side: '',
  odds: '',
  source: '@',
  category: 'Sports',
  confidence: 70,
  notes: '',
};

const EMPTY_SEAL: SealInput = { source: '@', event: '', teaser: '', market: '', side: '', odds: '', price: '0.05', payTo: '' };

const inputClass =
  'w-full px-md py-sm bg-secondary border border-primary text-primary text-sm placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-focus-ring';

const TABS: Tab[] = ['feed', 'log', 'sources', 'agent', 'memory', 'wallet'];

// The landing page lives at the bare URL; each app tab has its own hash.
function tabFromHash(): Tab | null {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (TABS as string[]).includes(h) ? (h as Tab) : null;
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Flame; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={`px-md lg:px-lg min-h-[40px] text-sm font-semibold transition-colors flex items-center gap-xs ${
        active ? 'bg-paper text-ink' : 'text-paper hover:bg-white/10'
      }`}
    >
      <Icon className="w-4 h-4 sm:hidden" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatCard({ label, value, hint, brand }: { label: string; value: string; hint: string; brand?: boolean }) {
  return (
    <div className="p-xl bg-secondary border border-primary">
      <span className="kicker text-tertiary">{label}</span>
      <div className={`font-mono text-heading-sm font-bold mt-xs truncate ${brand ? 'text-carbon' : ''}`} title={value}>{value}</div>
      <div className="text-xs text-secondary mt-xxs">{hint}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: PickRecord['status'] }) {
  return <Stamp kind={status} size="sm" />;
}

function ProofLink({ url, blobId }: { url?: string | null; blobId?: string | null }) {
  if (!blobId) return null;
  if (!url) return <span className="text-xs font-mono text-tertiary">{shortId(blobId)}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-mono text-carbon inline-flex items-center gap-xxs hover:underline">
      {shortId(blobId)} <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-md bg-utility-error-50 border-l-4 border-stamp text-utility-error-700 text-xs flex items-start gap-xs">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>{friendlyError(message)}</span>
    </div>
  );
}

// Raw relayer bodies are for the server log, not for visitors.
function friendlyError(message: string) {
  if (/\(429\)|rate limit/i.test(message)) return 'Walrus Memory is busy right now. Wait a minute and try again.';
  return message;
}

const ADVICE_STYLES: Record<Advice['tone'], string> = {
  good: 'border-carbon text-utility-success-700',
  warn: 'border-stamp text-utility-error-700',
  info: 'border-muted text-secondary',
};

function AdviceList({ advice }: { advice: Advice[] }) {
  return (
    <ul className="space-y-xxs pt-xs font-sans">
      {advice.map((a, i) => (
        <li key={i} className={`text-xs pl-sm py-xxs border-l-2 flex flex-wrap items-center gap-xs ${ADVICE_STYLES[a.tone]}`}>
          <Brain className="w-3 h-3 flex-shrink-0" />
          <span>{a.text}</span>
          {a.memory && (
            <span className="opacity-80">
              from memory <ProofLink url={a.memory.explorerUrl} blobId={a.memory.blobId} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function GradeButtons({ busy, onGrade, current, onCancel }: { busy: boolean; onGrade: (r: GradeResult) => void; current?: PickRecord['status']; onCancel?: () => void }) {
  if (busy) {
    return (
      <span className="text-xs text-tertiary flex items-center gap-xxs">
        <Loader2 className="w-3 h-3 animate-spin" /> grading
      </span>
    );
  }
  const btn = 'btn min-h-[34px] px-md text-xs font-sans';
  return (
    <div className="flex flex-wrap gap-xs" aria-label="Grade this pick">
      <button onClick={() => onGrade('won')} className={`${btn} border-2 border-carbon text-carbon hover:bg-carbon hover:text-paper`}>Won</button>
      <button onClick={() => onGrade('lost')} className={`${btn} border-2 border-stamp text-stamp-text hover:bg-stamp hover:text-ink`}>Lost</button>
      <button onClick={() => onGrade('push')} className={`${btn} border border-primary`}>Push</button>
      {current && current !== 'pending' && (
        <button onClick={() => onGrade('pending')} className={`${btn} border border-primary`} title="Withdraw the grade and mark the pick open again">
          Reopen
        </button>
      )}
      {onCancel && (
        <button onClick={onCancel} className="px-xs text-xs text-tertiary underline">Cancel</button>
      )}
    </div>
  );
}

function TrustDelta({ from, to }: { from: number; to: number }) {
  if (from === to) return <span className="text-xs text-tertiary">=</span>;
  const up = to > from;
  return <span className={`text-xs font-semibold font-mono ${up ? 'text-carbon' : 'text-stamp-text'}`}>{up ? '▲' : '▼'}{Math.abs(to - from)}</span>;
}

// Where the market now prices the picked outcome, against the price at pick time.
function LiveMove({ from, to }: { from: number; to: number }) {
  const move = Number.isFinite(from) && from > 0 && from < 1 ? Math.round((to - from) * 100) : null;
  return (
    <div className="text-xs font-mono text-tertiary text-right" title="Live price from Tatum's prediction market API">
      now {to.toFixed(3)}
      {move !== null && move !== 0 && (
        <span className={move > 0 ? 'text-carbon' : 'text-stamp-text'}> {move > 0 ? '+' : ''}{move}¢</span>
      )}
    </div>
  );
}

// Market odds as a two-tone bar: solid ink for the picked side, dither for the rest.
function OddsBar({ price }: { price: number }) {
  const p = Math.max(0, Math.min(1, price));
  return (
    <div className="space-y-xxs" aria-label={`Market price ${Math.round(p * 100)} percent`}>
      <div className="flex justify-between text-[11px] text-tertiary">
        <span>PICKED {Math.round(p * 100)}%</span>
        <span>OTHER {100 - Math.round(p * 100)}%</span>
      </div>
      <div className="h-[10px] flex border border-primary">
        <div className="bg-ink" style={{ width: `${p * 100}%` }} />
        <div className="dither flex-1" />
      </div>
    </div>
  );
}

function slipLabel(id: string) {
  return `#${String(slipNumber(id) % 10000).padStart(4, '0')}`;
}

export default function App() {
  const [activeTab, setTab] = useState<Tab | null>(tabFromHash);
  const setActiveTab = (tab: Tab) => {
    window.location.hash = tab;
  };
  useEffect(() => {
    const onHash = () => {
      setTab(tabFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [network, setNetwork] = useState<string>('…');
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const [picks, setPicks] = useState<PickRecord[]>([]);
  const [picksLoading, setPicksLoading] = useState(true);
  const [picksError, setPicksError] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');

  const [form, setForm] = useState<PickInput>(EMPTY_FORM);
  const [tipText, setTipText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveJob, setSaveJob] = useState<JobStatus | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [gradingId, setGradingId] = useState<string | null>(null);
  const [regradeId, setRegradeId] = useState<string | null>(null);
  const [learned, setLearned] = useState<string[] | null>(null);
  const [credBoard, setCredBoard] = useState<CredibilityRecord[]>([]);
  const [credHistory, setCredHistory] = useState<CredibilityRecord[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [limitInput, setLimitInput] = useState('3');
  const [learningError, setLearningError] = useState<string | null>(null);

  const [live, setLive] = useState<Record<string, LivePrice>>({});
  const [settling, setSettling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [marketQuery, setMarketQuery] = useState('');
  const [marketResults, setMarketResults] = useState<PredictionMarket[] | null>(null);
  const [searchingMarkets, setSearchingMarkets] = useState(false);
  const [linked, setLinked] = useState<{ market: PredictionMarket; outcome: string } | null>(null);
  const [traderCategory, setTraderCategory] = useState('SPORTS');
  const [traders, setTraders] = useState<Trader[] | null>(null);
  const [tradersLoading, setTradersLoading] = useState(false);
  const [followingWallet, setFollowingWallet] = useState<string | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  const [offers, setOffers] = useState<SealedOffer[]>([]);
  const [paymentsMock, setPaymentsMock] = useState(false);
  const [agentWallet, setAgentWallet] = useState<{ address: string; network: string; sui: string; usdc: string } | null>(null);
  const [walletSetupError, setWalletSetupError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [minTrust, setMinTrust] = useState('55');
  const [maxPrice, setMaxPrice] = useState('0.25');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyResults, setBuyResults] = useState<Record<string, BuyResult>>({});
  const [sealForm, setSealForm] = useState<SealInput>(EMPTY_SEAL);
  const [sealing, setSealing] = useState(false);
  const [showSeal, setShowSeal] = useState(false);

  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState('');
  const [suiBalance, setSuiBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const loadPicks = useCallback(async () => {
    setPicksLoading(true);
    setPicksError(null);
    try {
      const data = await api.listPicks();
      setPicks(data.picks);
      setNetwork(data.network);
      // Live market prices for open picks linked to a prediction market.
      if (data.picks.some((p) => p.status === 'pending' && p.marketId)) {
        api
          .livePrices()
          .then((r) => setLive(Object.fromEntries(r.prices.map((x) => [x.pickId, x]))))
          .catch(() => {});
      }
    } catch (err: any) {
      setPicksError(err.message);
    } finally {
      setPicksLoading(false);
    }
  }, []);

  const loadMemories = useCallback(async () => {
    setMemoriesLoading(true);
    setMemoriesError(null);
    try {
      const data = await api.listMemories();
      setMemories(data.memories);
      setNetwork(data.network);
    } catch (err: any) {
      setMemoriesError(err.message);
    } finally {
      setMemoriesLoading(false);
    }
  }, []);

  // Hosted demo: visitors read only; the owner unlocks writes with a passcode.
  const [session, setSession] = useState({ readOnly: false, owner: true });
  const canWrite = !session.readOnly || session.owner;
  useEffect(() => {
    api.session().then(setSession).catch(() => {});
  }, []);

  const handleOwnerLogin = async () => {
    const passcode = window.prompt('Owner passcode');
    if (!passcode) return;
    setOwnerPasscode(passcode);
    const s = await api.session().catch(() => null);
    if (s?.owner) {
      setSession(s);
      setNotice('Owner mode is on in this browser.');
    } else {
      setOwnerPasscode(null);
      setNotice('That passcode was not accepted.');
    }
  };

  const handleOwnerLogout = () => {
    setOwnerPasscode(null);
    setSession((s) => ({ ...s, owner: false }));
    if (activeTab === 'log') setActiveTab('feed');
  };

  useEffect(() => {
    api
      .memoryStatus()
      .then((s) => {
        setNetwork(s.network);
        if (!s.configured || s.error) setMemoryError(s.error ?? 'Walrus Memory is not configured');
      })
      .catch((err) => setMemoryError(err.message));
    loadPicks();
  }, [loadPicks]);

  const loadLearning = useCallback(async () => {
    setLearningError(null);
    try {
      const [cred, prof] = await Promise.all([api.credibility(), api.profile()]);
      setCredBoard(cred.board);
      setCredHistory(cred.history);
      setProfile(prof);
    } catch (err: any) {
      setLearningError(err.message);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'sources' || activeTab === 'memory' || activeTab === 'agent') loadLearning();
  }, [activeTab, loadLearning]);

  const loadAgent = useCallback(async () => {
    setAgentError(null);
    const [o, w, d] = await Promise.allSettled([api.offers(), api.agentWallet(), api.agentDecisions()]);
    if (o.status === 'fulfilled') {
      setOffers(o.value.offers);
      setPaymentsMock(o.value.mock);
    } else setAgentError(o.reason.message);
    if (w.status === 'fulfilled') {
      setAgentWallet(w.value);
      setWalletSetupError(null);
    } else setWalletSetupError(w.reason.message);
    if (d.status === 'fulfilled') setDecisions(d.value.records);
  }, []);

  useEffect(() => {
    if (activeTab === 'agent') loadAgent();
  }, [activeTab, loadAgent]);

  const handleBuy = async (offer: SealedOffer) => {
    setBuyingId(offer.id);
    setAgentError(null);
    try {
      const res = await api.agentBuy(offer.id, Number(minTrust) || 0, maxPrice || '0');
      setBuyResults((r) => ({ ...r, [offer.id]: res }));
      setLearned([res.sentence]);
      if (res.pick) setPicks((prev) => [res.pick as PickRecord, ...prev]);
      setTimeout(loadAgent, 3000);
    } catch (err: any) {
      setAgentError(err.message);
    } finally {
      setBuyingId(null);
    }
  };

  const handleSeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSealing(true);
    setAgentError(null);
    try {
      const res = await api.sealPick(sealForm);
      setOffers((prev) => [res.offer, ...prev]);
      setSealForm({ ...EMPTY_SEAL, source: sealForm.source, payTo: sealForm.payTo });
      setShowSeal(false);
      setNotice(`Sealed ${res.offer.source}'s pick. Its commitment is on Walrus now, and the pick itself stays hidden until someone pays.`);
    } catch (err: any) {
      setAgentError(err.message);
    } finally {
      setSealing(false);
    }
  };

  const handleGrade = async (pick: PickRecord, result: GradeResult) => {
    setGradingId(pick.id);
    setRegradeId(null);
    setPicksError(null);
    try {
      const res = await api.gradePick(pick.id, result);
      setLearned([res.credibility, ...res.patterns]);
      // Show the new grade and score straight away; recall from Walrus lags the write.
      setPicks((prev) => prev.map((p) => (p.source === pick.source && p.league === pick.league ? { ...p, trust: res.trust } : p)).map((p) => (p.id === pick.id ? { ...p, status: result } : p)));
      // Re-read once the grade is stored on Walrus, so the feed comes from memory again.
      await waitForJob(res.jobId, () => {});
      await new Promise((r) => setTimeout(r, 3000));
      await loadPicks();
    } catch (err: any) {
      setPicksError(err.message);
    } finally {
      setGradingId(null);
    }
  };

  const handleSettle = async () => {
    setSettling(true);
    setPicksError(null);
    try {
      const res = await api.settle();
      if (res.graded.length) {
        setLearned(res.learned);
        await new Promise((r) => setTimeout(r, 4000));
        await loadPicks();
      } else {
        setNotice(`Checked ${res.checked} linked pick${res.checked === 1 ? '' : 's'}. None of their markets have settled yet.`);
      }
    } catch (err: any) {
      setPicksError(err.message);
    } finally {
      setSettling(false);
    }
  };

  const handleSearchMarkets = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (marketQuery.trim().length < 2) return;
    setSearchingMarkets(true);
    setFormError(null);
    try {
      setMarketResults((await api.searchMarkets(marketQuery.trim())).markets);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSearchingMarkets(false);
    }
  };

  const linkMarket = (market: PredictionMarket, outcome: { name: string; price: number }) => {
    setLinked({ market, outcome: outcome.name });
    setMarketResults(null);
    setForm((f) => ({
      ...f,
      category: 'Polymarket',
      event: market.eventTitle,
      market: market.question,
      side: outcome.name,
      odds: outcome.price.toFixed(3),
      platform: market.platform,
      marketId: market.id,
      outcome: outcome.name,
      marketUrl: market.url ?? undefined,
    }));
  };

  const unlinkMarket = () => {
    setLinked(null);
    setForm((f) => ({ ...f, platform: undefined, marketId: undefined, outcome: undefined, marketUrl: undefined }));
  };

  const loadTraders = async (category = traderCategory) => {
    setTradersLoading(true);
    setPredictionError(null);
    try {
      setTraders((await api.topTraders(category, 'MONTH')).traders);
    } catch (err: any) {
      setPredictionError(err.message);
    } finally {
      setTradersLoading(false);
    }
  };

  const handleFollow = async (t: Trader) => {
    setFollowingWallet(t.proxyWallet);
    setPredictionError(null);
    try {
      const res = await api.followTrader(t.proxyWallet, t.userName);
      setPicks((prev) => [...res.created.map((c) => c.pick), ...prev]);
      const name = t.userName ?? t.proxyWallet.slice(0, 10);
      setNotice(
        res.created.length
          ? `Logged ${res.created.length} of @${name}'s latest Polymarket trades as picks on Walrus. They grade themselves when their markets settle.`
          : `No new trades from @${name} since the last import.`,
      );
      if (res.created.length) setTimeout(loadPicks, 4000);
    } catch (err: any) {
      setPredictionError(err.message);
    } finally {
      setFollowingWallet(null);
    }
  };

  const handleSetLimit = async () => {
    const n = Number(limitInput);
    if (!Number.isInteger(n) || n < 0) return;
    try {
      const res = await api.setLimit(n);
      setLearned([res.sentence]);
      setTimeout(loadLearning, 4000);
    } catch (err: any) {
      setLearningError(err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'memory') loadMemories();
  }, [activeTab, loadMemories]);

  const stats = useMemo(() => sourceStats(picks), [picks]);
  const graded = picks.filter((p) => p.status === 'won' || p.status === 'lost');
  const won = picks.filter((p) => p.status === 'won').length;
  const pending = picks.filter((p) => p.status === 'pending').length;
  const busiest = [...stats].sort((a, b) => b.total - a.total)[0];
  const filteredPicks = picks.filter((p) => feedFilter === 'all' || p.category === feedFilter);

  const updateForm = <K extends keyof PickInput>(key: K, value: PickInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handleParseTip = async () => {
    if (!tipText.trim()) return;
    setParsing(true);
    setFormError(null);
    try {
      const { draft } = await api.parseTip(tipText, form.source.replace(/^@$/, ''));
      setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== '' && v !== null)) }));
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleCreatePick = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveJob(null);
    setFormError(null);
    try {
      const { pick, jobId } = await api.logPick(form);
      setPicks((prev) => [pick, ...prev]);
      setForm({ ...EMPTY_FORM, source: form.source, category: form.category });
      setTipText('');
      setLinked(null);
      const final = await waitForJob(jobId, setSaveJob);
      if (final.status === 'done') {
        setPicks((prev) => prev.map((p) => (p.id === pick.id ? { ...p, blobId: final.blobId ?? undefined, explorerUrl: final.explorerUrl } : p)));
      } else if (final.status === 'failed') {
        setFormError(final.error ?? 'Walrus Memory could not store this pick');
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fetchWallet = async () => {
    if (!walletAddress.trim()) return;
    setIsLoadingWallet(true);
    setWalletError(null);
    try {
      const data = await api.suiBalance(walletAddress.trim());
      setSuiBalance(data.sui);
      setUsdcBalance(data.usdc);
    } catch (err: any) {
      setWalletError(err.message || 'Error fetching Sui balance');
    } finally {
      setIsLoadingWallet(false);
    }
  };

  const networkLabel = network === 'mainnet' ? 'Walrus Mainnet' : network === 'testnet' ? 'Walrus Testnet' : network === 'mock' ? 'Mock memory' : 'Connecting…';

  if (activeTab === null) return <Landing picks={picks} />;

  return (
    <div className="min-h-screen bg-primary text-primary font-sans antialiased selection:bg-ink selection:text-paper flex flex-col">
      <header className="bg-ink text-paper sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-xl py-md flex items-center justify-between gap-md">
          <a href="#" className="flex items-center gap-md flex-shrink-0" title="Receipts home">
            <Logo size={24} />
            <span className="hidden md:inline font-display text-[24px] tracking-wide">Receipts</span>
          </a>

          <nav className="flex items-center gap-xxs">
            <NavButton active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} icon={TrendingUp} label="Feed" />
            {canWrite && <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={PlusCircle} label="Log" />}
            <NavButton active={activeTab === 'sources'} onClick={() => setActiveTab('sources')} icon={Users} label="Sources" />
            <NavButton active={activeTab === 'agent'} onClick={() => setActiveTab('agent')} icon={Bot} label="Agent" />
            <NavButton active={activeTab === 'memory'} onClick={() => setActiveTab('memory')} icon={Brain} label="Memory" />
          </nav>

          <div className="hidden lg:flex items-center gap-md font-mono text-xs text-muted-light">
            <span className="flex items-center gap-xs">
              <span className={`w-2 h-2 rounded-full ${memoryError ? 'bg-stamp' : 'bg-carbon-light animate-pulse'}`}></span>
              {networkLabel.toUpperCase()}
            </span>
            {session.readOnly && (
              <button
                onClick={session.owner ? handleOwnerLogout : handleOwnerLogin}
                className="btn-line min-h-[36px] px-md text-xs font-sans text-paper"
                title={session.owner ? 'Leave owner mode in this browser' : 'Unlock logging and grading'}
              >
                {session.owner ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />} {session.owner ? 'Owner' : 'Owner login'}
              </button>
            )}
          </div>
        </div>
      </header>
      {!canWrite && (
        <div className="bg-stamp text-ink font-mono text-xs">
          <div className="max-w-7xl mx-auto px-xl py-sm">
            READ-ONLY DEMO · EVERY SLIP HERE IS A REAL WALRUS MEMORY ON MAINNET · ON THE AGENT TAB YOU CAN BUY A SEALED PICK WITH YOUR OWN SUI WALLET
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-xl pt-4xl pb-7xl space-y-2xl">
        {memoryError && <ErrorBox message={`Walrus Memory: ${memoryError}`} />}
        {learned && (
          <div className="p-lg bg-ink text-paper space-y-xs font-mono">
            <div className="kicker text-stamp flex items-center gap-xs">
              <Sparkles className="w-4 h-4" /> Receipts learned something and wrote it to Walrus
            </div>
            {learned.map((l, i) => (
              <p key={i} className="text-sm font-sans text-[#D9D4C7]">{l}</p>
            ))}
            <button onClick={() => setLearned(null)} className="text-xs underline text-muted-light">Dismiss</button>
          </div>
        )}

        {notice && (
          <div className="p-md bg-secondary border border-dashed border-primary text-secondary text-xs flex items-center justify-between gap-md">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="underline flex-shrink-0">Dismiss</button>
          </div>
        )}

        {/* ================= FEED ================= */}
        {activeTab === 'feed' && (
          <div className="space-y-3xl">
            <PageHead
              kicker={`The ledger · ${networkLabel}`}
              title={
                <>
                  Every pick,
                  <br />
                  no deletes.
                </>
              }
              actions={
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-px bg-ink border border-primary font-mono">
                  {[
                    { v: String(picks.length), l: 'Picks', c: '' },
                    { v: String(won), l: 'Won', c: 'text-carbon' },
                    { v: String(graded.length - won), l: 'Lost', c: 'text-stamp-text' },
                    { v: String(pending), l: 'Open', c: '' },
                    { v: graded.length ? `${Math.round((won / graded.length) * 100)}%` : '—', l: 'Win rate', c: '' },
                  ].map((x) => (
                    <div key={x.l} className={`bg-primary px-lg py-md ${x.c}`}>
                      <div className="text-[28px] font-bold leading-none">{x.v}</div>
                      <div className="text-[11px] uppercase mt-xs">{x.l}</div>
                    </div>
                  ))}
                </div>
              }
            >
              Every pick is written to Walrus Memory before the event, so nothing gets quietly deleted.{' '}
              {busiest ? `${picks.filter((p) => p.blobId).length} are stored so far, across ${stats.length} source${stats.length === 1 ? '' : 's'}.` : ''}
            </PageHead>

            <div className="flex flex-wrap items-center gap-xs border-b border-primary pb-lg">
              <span className="kicker mr-xs">Filter</span>
              {(['all', 'Sports', 'Polymarket', 'Crypto', 'Macro'] as FeedFilter[]).map((f) => (
                <button key={f} onClick={() => setFeedFilter(f)} className={`${feedFilter === f ? 'btn-ink' : 'btn-line'} min-h-[36px] px-md`}>
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
              <span className="flex-1" />
              {canWrite && picks.some((p) => p.status === 'pending' && p.marketId) && (
                <button
                  onClick={handleSettle}
                  disabled={settling}
                  className="btn-stamp min-h-[36px]"
                  title="Grade linked picks whose market has settled, using Tatum's prediction market data"
                >
                  {settling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Check market results
                </button>
              )}
              <button onClick={loadPicks} className="btn-line min-h-[36px] px-sm" title="Refresh" aria-label="Refresh">
                <RefreshCw className={`w-4 h-4 ${picksLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {picksError && <ErrorBox message={picksError} />}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3xl items-start">
              {filteredPicks.map((pick) => {
                const tilt = ((slipNumber(pick.id) % 5) - 2) * 0.3;
                const livePrice = pick.status === 'pending' ? live[pick.id]?.price : null;
                return (
                  <Slip key={pick.id} tilt={tilt}>
                    <div className="p-xl flex flex-col gap-sm">
                      <div className="flex justify-between gap-sm text-xs text-tertiary">
                        <span>
                          {slipLabel(pick.id)} · {(pick.league ?? pick.category).toUpperCase()}
                        </span>
                        <span>{timeAgo(pick.loggedAt)}</span>
                      </div>
                      <h3 className="font-display text-[26px] pr-[92px] break-words">{pick.event}</h3>
                      <Row label="MARKET">{pick.market}</Row>
                      <Row label="PICK">
                        <span className="font-bold">
                          {pick.side}
                          {pick.odds ? ` · ${pick.odds}` : ''}
                        </span>
                      </Row>
                      {livePrice != null && (
                        <>
                          <OddsBar price={livePrice} />
                          <LiveMove from={Number(pick.odds)} to={livePrice} />
                        </>
                      )}
                      <Row label="SOURCE">
                        {pick.sourceUrl ? (
                          <a href={pick.sourceUrl} target="_blank" rel="noreferrer" className="text-carbon hover:underline inline-flex items-center gap-xxs" title={pick.sourceUrl}>
                            {pick.source} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          pick.source
                        )}
                      </Row>
                      <Row
                        label={
                          <span title="Receipts' 0-100 score for this source in this league, learned from graded picks. 50 is neutral; a dash means none of their picks here are graded yet.">
                            TRUST
                          </span>
                        }
                      >
                        <TrustBar value={pick.trust} />
                      </Row>
                      {pick.marketId && (
                        <Row label="MARKET">
                          <a
                            href={pick.marketUrl ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-xxs hover:underline"
                            title={pick.status === 'pending' ? 'Linked market: grades itself when it settles' : 'Linked market'}
                          >
                            <Link2 className="w-3 h-3" /> {pick.platform === 'kalshi' ? 'Kalshi' : 'Polymarket'}
                          </a>
                        </Row>
                      )}
                      {pick.notes && <p className="text-xs text-secondary italic font-sans">&ldquo;{pick.notes}&rdquo;</p>}
                      {pick.status === 'pending' && pick.advice && pick.advice.length > 0 && <AdviceList advice={pick.advice} />}
                      <Rule />
                      <div className="flex flex-wrap justify-between gap-sm text-[11px] text-tertiary">
                        <span className="flex items-center gap-xs">
                          BLOB{' '}
                          {pick.blobId ? (
                            <ProofLink url={pick.explorerUrl} blobId={pick.blobId} />
                          ) : (
                            <span className="flex items-center gap-xxs">
                              <Loader2 className="w-3 h-3 animate-spin" /> storing
                            </span>
                          )}
                        </span>
                        <span>{pick.status === 'pending' ? (pick.marketId ? 'SETTLES VIA TATUM' : 'GRADED BY HAND') : 'GRADED'}</span>
                      </div>
                      {pick.grade?.blobId && (
                        <div className="text-[11px] text-tertiary flex items-center gap-xs">
                          GRADE <ProofLink url={pick.grade.explorerUrl} blobId={pick.grade.blobId} />
                        </div>
                      )}
                      <div className="barcode h-[26px]" aria-hidden="true" />
                      {canWrite && pick.status === 'pending' && pick.blobId && (
                        <GradeButtons busy={gradingId === pick.id} onGrade={(result) => handleGrade(pick, result)} />
                      )}
                      {canWrite &&
                        pick.status !== 'pending' &&
                        (regradeId === pick.id || gradingId === pick.id ? (
                          <GradeButtons busy={gradingId === pick.id} current={pick.status} onGrade={(result) => handleGrade(pick, result)} onCancel={() => setRegradeId(null)} />
                        ) : (
                          <button
                            onClick={() => setRegradeId(pick.id)}
                            className="text-xs text-tertiary underline self-start font-sans"
                            title="Graded by mistake? Change it. The correction is saved as a new memory."
                          >
                            Change grade
                          </button>
                        ))}
                    </div>
                    <div className="absolute right-lg top-[40px] pointer-events-none">
                      <StatusBadge status={pick.status} />
                    </div>
                  </Slip>
                );
              })}

              {!picksLoading && !picksError && filteredPicks.length === 0 && (
                <div className="border-2 border-dashed border-primary p-3xl flex flex-col gap-md min-h-[280px] justify-center">
                  <span className="kicker">Empty</span>
                  <span className="font-display text-[34px]">
                    No receipt,
                    <br />
                    no claim.
                  </span>
                  <span className="text-md text-secondary">
                    {canWrite
                      ? "Paste a tip or a Polymarket link. It is stored on Walrus before the game starts, so the result can't be argued later."
                      : 'Nothing in this filter yet.'}
                  </span>
                  {canWrite && (
                    <button onClick={() => setActiveTab('log')} className="btn-ink self-start">
                      Log a pick
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= LOG PICK ================= */}
        {activeTab === 'log' && (
          <div className="max-w-2xl mx-auto space-y-2xl">
            <PageHead kicker="Before kickoff" title="Print a receipt">
              Record the pick before the event starts. It is stored on Walrus with a Sui-backed timestamp and can't be edited after.
            </PageHead>

            <div className="p-xl bg-secondary border border-primary space-y-md">
              <div className="kicker flex items-center gap-xs">
                <ClipboardPaste className="w-4 h-4" /> Paste a tip
              </div>
              <textarea
                rows={3}
                placeholder="Paste a tipster's post from X, Telegram or WhatsApp, e.g. “@StatViper Celtics vs Knicks: Celtics -4.5 (-110) 3u”"
                value={tipText}
                onChange={(e) => setTipText(e.target.value)}
                className={inputClass}
              />
              <button type="button" onClick={handleParseTip} disabled={parsing || !tipText.trim()} className="btn-line min-h-[36px] text-xs">
                <Sparkles className="w-3.5 h-3.5" /> {parsing ? 'Reading…' : 'Fill the form from this tip'}
              </button>
              <p className="text-xs text-tertiary">Check the fields below before saving. Nothing is stored until you commit.</p>
            </div>

            <div className="p-xl bg-secondary border border-primary space-y-md">
              <div className="kicker flex items-center gap-xs">
                <Link2 className="w-4 h-4" /> Link a Polymarket market
              </div>
              {linked ? (
                <div className="p-md bg-utility-brand-50 border-l-4 border-carbon text-utility-brand-700 text-xs flex items-center justify-between gap-md">
                  <span>
                    Linked: <strong>{linked.outcome}</strong> on “{linked.market.question}”. Receipts tracks its live price and grades it when the market settles.
                  </span>
                  <button type="button" onClick={unlinkMarket} className="underline flex-shrink-0">Unlink</button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSearchMarkets} className="flex gap-sm">
                    <input
                      type="text"
                      placeholder="Search, e.g. Senate, Ballon d'Or, Lakers, or paste a Polymarket link"
                      value={marketQuery}
                      onChange={(e) => setMarketQuery(e.target.value)}
                      className={inputClass}
                    />
                    <button type="submit" disabled={searchingMarkets || marketQuery.trim().length < 2} className="btn-ink text-xs">
                      {searchingMarkets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Search
                    </button>
                  </form>
                  {marketResults && marketResults.length === 0 && <p className="text-xs text-tertiary">No active markets match that.</p>}
                  {marketResults && marketResults.length > 0 && (
                    <ul className="divide-y divide-secondary border border-primary max-h-80 overflow-y-auto">
                      {marketResults.map((m) => (
                        <li key={m.id} className="p-md bg-secondary space-y-xs">
                          <div className="text-xs text-tertiary font-mono">
                            {m.eventTitle} · {usd(m.volume ?? 0)} volume{m.closeTime ? ` · closes ${new Date(m.closeTime).toLocaleDateString()}` : ''}
                          </div>
                          <div className="text-sm font-semibold text-primary">{m.question}</div>
                          <div className="flex flex-wrap gap-xs">
                            {m.outcomes.map((o) => (
                              <button key={o.name} type="button" onClick={() => linkMarket(m, o)} className="btn-line min-h-[32px] px-md text-xs">
                                {o.name} <span className="font-mono text-tertiary">{o.price.toFixed(3)}</span>
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-tertiary">Pick an outcome to fill the form. Markets from a pasted link are listed first. Prices come from Tatum's prediction market API.</p>
                </>
              )}
            </div>

            {saveJob && (
              <div className="p-lg bg-ink text-paper text-sm font-mono flex items-center gap-sm">
                {saveJob.status === 'done' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-carbon-light" /> : <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />}
                <span>
                  {saveJob.status === 'done' ? 'RECEIPT STORED ON WALRUS. ' : `STORING ON WALRUS (${saveJob.status.toUpperCase()})… `}
                  <ProofLink url={saveJob.explorerUrl} blobId={saveJob.blobId} />
                </span>
              </div>
            )}
            {formError && <ErrorBox message={formError} />}

            <Slip>
              <form onSubmit={handleCreatePick} className="p-2xl space-y-lg font-sans">
                <div className="text-center font-display text-[24px]">Receipts</div>
                <div className="text-center font-mono text-xs text-tertiary">NEW PICK · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</div>
                <Rule />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                  <div className="space-y-xs">
                    <label className="kicker text-secondary">Category</label>
                    <select value={form.category} onChange={(e) => updateForm('category', e.target.value as Category)} className={inputClass}>
                      <option value="Sports">Sports (NBA, NFL, Soccer, etc.)</option>
                      <option value="Polymarket">Polymarket / Prediction Market</option>
                      <option value="Crypto">Crypto Price Binary</option>
                      <option value="Macro">Macro / Politics</option>
                    </select>
                  </div>
                  <div className="space-y-xs">
                    <label className="kicker text-secondary">Source (handle or link)</label>
                    <input type="text" placeholder="@tipster, @me, or a profile or post link" value={form.source} onChange={(e) => updateForm('source', e.target.value)} className={inputClass} required />
                  </div>
                </div>

                <div className="space-y-xs">
                  <label className="kicker text-secondary">Event / Matchup</label>
                  <input type="text" placeholder="e.g. Chiefs vs 49ers, or Senate control after the midterms" value={form.event} onChange={(e) => updateForm('event', e.target.value)} className={inputClass} required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
                  <div className="space-y-xs">
                    <label className="kicker text-secondary">Market type</label>
                    <input type="text" placeholder="Spread, Total, Moneyline, Yes/No" value={form.market} onChange={(e) => updateForm('market', e.target.value)} className={inputClass} required />
                  </div>
                  <div className="space-y-xs">
                    <label className="kicker text-secondary">Side / Pick</label>
                    <input type="text" placeholder="Chiefs -3.5 or YES" value={form.side} onChange={(e) => updateForm('side', e.target.value)} className={inputClass} required />
                  </div>
                  <div className="space-y-xs">
                    <label className="kicker text-secondary">Odds / Price</label>
                    <input type="text" placeholder="-110, 1.91 or 0.65" value={form.odds} onChange={(e) => updateForm('odds', e.target.value)} className={inputClass} />
                  </div>
                </div>

                <div className="space-y-xs">
                  <div className="flex items-center justify-between">
                    <label className="kicker text-secondary">Confidence</label>
                    <span className="font-mono text-sm font-bold">{form.confidence}%</span>
                  </div>
                  <input type="range" min="50" max="100" value={form.confidence} onChange={(e) => updateForm('confidence', Number(e.target.value))} className="w-full cursor-pointer accent-[#121212]" />
                </div>

                <div className="space-y-xs">
                  <label className="kicker text-secondary">Notes &amp; rationale</label>
                  <textarea rows={3} placeholder="Injury news, line movement, the tipster's reasoning…" value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} className={inputClass}></textarea>
                </div>

                <div className="barcode h-8" aria-hidden="true" />
                <button type="submit" disabled={saving} className="btn-ink w-full min-h-[48px] text-md">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  {saving ? 'Writing to Walrus…' : 'Print it to Walrus'}
                </button>
              </form>
            </Slip>
          </div>
        )}

        {/* ================= SOURCES ================= */}
        {activeTab === 'sources' && (
          <div className="space-y-3xl">
            <PageHead
              kicker="Source credibility"
              title={
                <>
                  Earned,
                  <br />
                  not claimed.
                </>
              }
            >
              Trust is scored per source and league from graded receipts, and every change is written to Walrus as a new memory.
            </PageHead>
            {learningError && <ErrorBox message={learningError} />}

            {credBoard.length === 0 ? (
              <p className="text-sm text-secondary">No graded picks yet. Grade an open pick in the feed and its source gets a score here.</p>
            ) : (
              <div className="border border-primary overflow-x-auto bg-secondary">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-primary font-mono text-xs uppercase">
                      <th className="py-md px-lg">#</th>
                      <th className="py-md px-lg">Source</th>
                      <th className="py-md px-lg">League</th>
                      <th className="py-md px-lg">Trust</th>
                      <th className="py-md px-lg">Record</th>
                      <th className="py-md px-lg">ROI</th>
                      <th className="py-md px-lg">Last change</th>
                      <th className="py-md px-lg">Memory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary text-sm">
                    {credBoard.map((c, i) => (
                      <tr key={c.key} className="hover:bg-secondary-hover transition-colors">
                        <td className="py-md px-lg font-mono font-bold">
                          {i === 0 ? (
                            <span className="flex items-center gap-xs">
                              <Award className="w-4 h-4 text-carbon" /> 01
                            </span>
                          ) : (
                            String(i + 1).padStart(2, '0')
                          )}
                        </td>
                        <td className="py-md px-lg font-bold text-primary">{c.source}</td>
                        <td className="py-md px-lg font-mono text-xs">{c.league.toUpperCase()}</td>
                        <td className="py-md px-lg whitespace-nowrap">
                          <TrustBar value={c.trust} className="text-sm font-bold" /> <TrustDelta from={c.prevTrust} to={c.trust} />
                        </td>
                        <td className="py-md px-lg font-mono text-xs">
                          {c.won}W-{c.lost}L{c.push ? `-${c.push}P` : ''}
                        </td>
                        <td className={`py-md px-lg font-mono text-xs font-semibold ${c.roi >= 0 ? 'text-carbon' : 'text-stamp-text'}`}>{pct(c.roi)}</td>
                        <td className="py-md px-lg text-secondary text-xs">{c.reason}</td>
                        <td className="py-md px-lg">
                          <ProofLink url={c.explorerUrl} blobId={c.blobId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {stats.some((s) => !credBoard.some((c) => c.source.toLowerCase() === s.source.toLowerCase())) && (
              <div className="space-y-sm">
                <h2 className="kicker">Waiting for results</h2>
                <div className="flex flex-wrap gap-xs">
                  {stats
                    .filter((s) => !credBoard.some((c) => c.source.toLowerCase() === s.source.toLowerCase()))
                    .map((s) => (
                      <span key={s.source} className="px-md py-xxs border border-dashed border-primary font-mono text-xs text-secondary">
                        {s.source} · {s.pending} open
                      </span>
                    ))}
                </div>
              </div>
            )}

            <div className="p-xl bg-secondary border border-primary space-y-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                <div>
                  <div className="flex items-center gap-xs text-md font-bold">
                    <UserPlus className="w-4 h-4" /> Follow Polymarket's top traders
                  </div>
                  <p className="text-xs text-secondary">
                    Their latest trades become picks on Walrus and grade themselves when the market settles, so Receipts learns whether a leaderboard name is worth following.
                  </p>
                </div>
                <div className="flex items-center gap-xs flex-shrink-0">
                  <select
                    value={traderCategory}
                    onChange={(e) => {
                      setTraderCategory(e.target.value);
                      if (traders) loadTraders(e.target.value);
                    }}
                    className="px-sm min-h-[36px] bg-secondary border border-primary text-xs text-primary"
                    aria-label="Leaderboard category"
                  >
                    <option value="SPORTS">Sports</option>
                    <option value="POLITICS">Politics</option>
                    <option value="CRYPTO">Crypto</option>
                    <option value="OVERALL">Overall</option>
                  </select>
                  <button onClick={() => loadTraders()} disabled={tradersLoading} className="btn-ink min-h-[36px] text-xs">
                    {tradersLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {traders ? 'Refresh' : 'Load this month’s leaders'}
                  </button>
                </div>
              </div>
              {predictionError && <ErrorBox message={predictionError} />}
              {traders && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-primary font-mono text-xs uppercase">
                        <th className="py-xs px-sm">#</th>
                        <th className="py-xs px-sm">Trader</th>
                        <th className="py-xs px-sm">30-day PnL</th>
                        <th className="py-xs px-sm">Volume</th>
                        <th className="py-xs px-sm">Receipts trust</th>
                        <th className="py-xs px-sm"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary">
                      {traders.map((t) => {
                        const handle = `@${t.userName ?? t.proxyWallet.slice(0, 10)}`.toLowerCase();
                        const cred = credBoard.filter((c) => c.source.toLowerCase() === handle);
                        return (
                          <tr key={t.proxyWallet}>
                            <td className="py-xs px-sm font-mono text-tertiary">{t.rank}</td>
                            <td className="py-xs px-sm font-semibold text-primary">{t.userName ?? shortId(t.proxyWallet)}</td>
                            <td className={`py-xs px-sm font-mono text-xs font-semibold ${t.pnl >= 0 ? 'text-carbon' : 'text-stamp-text'}`}>{usd(t.pnl)}</td>
                            <td className="py-xs px-sm font-mono text-xs text-secondary">{usd(t.vol)}</td>
                            <td className="py-xs px-sm text-xs text-secondary">
                              {cred.length ? cred.map((c) => `${c.trust} on ${c.league}`).join(', ') : 'Not graded yet'}
                            </td>
                            <td className="py-xs px-sm text-right">
                              {canWrite && (
                                <button onClick={() => handleFollow(t)} disabled={followingWallet !== null} className="btn-line min-h-[32px] px-md text-xs">
                                  {followingWallet === t.proxyWallet ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />} Log latest 5 trades
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {credHistory.length > 0 && (
              <div className="space-y-sm">
                <h2 className="font-display text-[32px]">How Receipts changed its mind</h2>
                <p className="text-xs text-tertiary">Append-only: each line is its own Walrus memory and names the score it replaced.</p>
                <ol className="border-l-2 border-primary ml-xs">
                  {credHistory.map((h) => (
                    <li key={h.blobId} className="relative pl-xl py-sm text-xs flex flex-col md:flex-row md:items-center justify-between gap-xs">
                      <span className="absolute -left-[5px] top-[14px] w-2 h-2 bg-ink" aria-hidden="true" />
                      <span className="text-secondary">
                        <span className="font-mono text-tertiary">{new Date(h.recordedAt).toLocaleString()} · </span>
                        {h.text}
                      </span>
                      <ProofLink url={h.explorerUrl} blobId={h.blobId} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* ================= AGENT (x402) ================= */}
        {activeTab === 'agent' && (
          <div className="space-y-3xl">
            <PageHead
              kicker="Agent · x402 pay-per-pick"
              title={
                <>
                  It only pays
                  <br />
                  for proof.
                </>
              }
              actions={
                <button onClick={loadAgent} className="btn-line min-h-[36px] px-sm" title="Refresh" aria-label="Refresh">
                  <RefreshCw className="w-4 h-4" />
                </button>
              }
            >
              Tipsters seal their next pick behind an x402 paywall. The agent recalls the seller's graded record from Walrus, pays in USDC on Sui only when trust clears
              the bar, and the payment is checked through Tatum before the pick is revealed.
            </PageHead>
            {paymentsMock && <div className="p-md border border-dashed border-primary font-mono text-xs text-secondary">MOCK PAYMENTS ARE ON: NOTHING IS PAID ON CHAIN.</div>}
            {agentError && <ErrorBox message={agentError} />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl items-stretch">
              <div className="p-xl bg-secondary border border-primary space-y-md flex flex-col">
                <div className="kicker flex items-center gap-xs">
                  <Wallet className="w-4 h-4" /> Buy a pick yourself
                </div>
                <p className="text-sm text-secondary flex-1">
                  Connect any Sui wallet (Slush, Suiet, Phantom) holding a little USDC and SUI for gas. You pay the seller directly, the payment is checked through Tatum,
                  and the pick shows only in your browser.
                </p>
                <ConnectWallet />
              </div>
              <div className="p-xl bg-secondary border border-primary space-y-md font-mono">
                <div className="kicker flex items-center gap-xs font-sans">
                  <Bot className="w-4 h-4" /> Agent wallet {agentWallet && <span className="text-tertiary">· SUI {agentWallet.network.toUpperCase()}</span>}
                </div>
                {walletSetupError ? (
                  <ErrorBox message={/AGENT_SUI_PRIVATE_KEY/.test(walletSetupError) ? (canWrite ? 'The agent has no wallet yet. Set AGENT_SUI_PRIVATE_KEY on the server and restart it.' : 'The agent wallet is not set up on this deploy.') : walletSetupError} />
                ) : agentWallet ? (
                  <>
                    <div className="text-xs text-secondary break-all">{agentWallet.address}</div>
                    <div className="flex gap-2xl">
                      <div>
                        <div className="text-heading-xs font-bold text-carbon">{agentWallet.usdc}</div>
                        <div className="text-xs text-tertiary">USDC TO SPEND</div>
                      </div>
                      <div>
                        <div className="text-heading-xs font-bold">{agentWallet.sui}</div>
                        <div className="text-xs text-tertiary">SUI FOR GAS</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-tertiary">Loading…</p>
                )}
              </div>
              <div className="halftone p-xl">
                <div className="bg-ink text-paper p-xl font-mono space-y-md h-full">
                  <div className="kicker text-muted-light">The agent's rule</div>
                  <label className="flex justify-between items-center gap-md text-sm">
                    <span>MIN TRUST</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={minTrust}
                      onChange={(e) => setMinTrust(e.target.value)}
                      readOnly={!canWrite}
                      className="w-20 px-sm py-xxs bg-transparent border border-ink-line text-paper text-right font-bold"
                      aria-label="Minimum trust"
                    />
                  </label>
                  <label className="flex justify-between items-center gap-md text-sm">
                    <span>MAX PRICE (USDC)</span>
                    <input
                      type="text"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      readOnly={!canWrite}
                      className="w-20 px-sm py-xxs bg-transparent border border-ink-line text-paper text-right font-bold"
                      aria-label="Maximum price"
                    />
                  </label>
                  <p className="text-xs text-muted-light font-sans">Pays only when the seller's trust in that league clears the bar. Every decision, paid or skipped, is written to Walrus with the reason.</p>
                </div>
              </div>
            </div>

            <div className="space-y-xl">
              <div className="flex flex-wrap items-center justify-between gap-md border-b-2 border-primary pb-md">
                <h2 className="font-display text-[32px]">Sealed picks</h2>
                {canWrite && (
                  <button onClick={() => setShowSeal((v) => !v)} className="btn-stamp min-h-[36px]">
                    <Lock className="w-3.5 h-3.5" /> {showSeal ? 'Close' : 'Seal a pick (as a tipster)'}
                  </button>
                )}
              </div>

              {showSeal && (
                <form onSubmit={handleSeal} className="p-xl bg-secondary border border-primary grid grid-cols-1 md:grid-cols-2 gap-md">
                  <input className={inputClass} placeholder="Tipster handle or profile link" value={sealForm.source} onChange={(e) => setSealForm({ ...sealForm, source: e.target.value })} required />
                  <input className={inputClass} placeholder="Event, e.g. Celtics vs Knicks" value={sealForm.event} onChange={(e) => setSealForm({ ...sealForm, event: e.target.value })} required />
                  <input className={`${inputClass} md:col-span-2`} placeholder="Public teaser buyers see, e.g. Big edge on the spread" value={sealForm.teaser} onChange={(e) => setSealForm({ ...sealForm, teaser: e.target.value })} />
                  <input className={inputClass} placeholder="Hidden: market, e.g. Spread" value={sealForm.market} onChange={(e) => setSealForm({ ...sealForm, market: e.target.value })} required />
                  <input className={inputClass} placeholder="Hidden: side, e.g. Celtics -4.5" value={sealForm.side} onChange={(e) => setSealForm({ ...sealForm, side: e.target.value })} required />
                  <input className={inputClass} placeholder="Hidden: odds, e.g. -110" value={sealForm.odds} onChange={(e) => setSealForm({ ...sealForm, odds: e.target.value })} />
                  <input className={inputClass} placeholder="Price in USDC" value={sealForm.price} onChange={(e) => setSealForm({ ...sealForm, price: e.target.value })} />
                  <input className={`${inputClass} md:col-span-2 font-mono`} placeholder="Pay to (Sui address), optional" value={sealForm.payTo} onChange={(e) => setSealForm({ ...sealForm, payTo: e.target.value })} />
                  <button type="submit" disabled={sealing} className="btn-ink md:col-span-2 min-h-[44px]">
                    {sealing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Seal it and commit to Walrus
                  </button>
                </form>
              )}

              {offers.length === 0 && <p className="text-sm text-secondary">No sealed picks yet. Seal one as a tipster, then let the agent decide whether it's worth paying for.</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3xl items-start">
                {offers.map((o) => {
                  const cred = credBoard.find((c) => c.source.toLowerCase() === o.source.toLowerCase() && c.league === o.league);
                  const result = buyResults[o.id];
                  return (
                    <Slip key={o.id} dark tilt={((slipNumber(o.id) % 5) - 2) * 0.25}>
                      <div className="p-xl flex flex-col gap-sm">
                        <div className="flex justify-between gap-sm text-xs text-muted-light">
                          <span>
                            {slipLabel(o.id)} · {o.league.toUpperCase()}
                          </span>
                          <span>sealed {timeAgo(o.createdAt)}</span>
                        </div>
                        <h3 className="font-display text-[26px] pr-[110px] break-words">{o.event}</h3>
                        {o.teaser && <p className="text-xs font-sans text-[#D9D4C7]">{o.teaser}</p>}
                        {o.unlocked && o.hidden ? (
                          <Row label={<span className="text-muted-light">PICK</span>}>
                            <span className="font-bold">
                              {o.hidden.side} ({o.hidden.market}){o.hidden.odds ? ` · ${o.hidden.odds}` : ''}
                            </span>
                          </Row>
                        ) : (
                          <Row label={<span className="text-muted-light">PICK</span>}>
                            <span aria-label="Hidden until paid">██████ · ████</span>
                          </Row>
                        )}
                        <Row label={<span className="text-muted-light">SELLER</span>}>
                          {o.source}
                          {o.sourcePlatform ? ` · ${o.sourcePlatform}` : ''}
                        </Row>
                        <Row label={<span className="text-muted-light">TRUST {o.league.toUpperCase()}</span>}>
                          <TrustBar value={cred?.trust} />
                        </Row>
                        <Row label={<span className="text-muted-light">PRICE</span>}>
                          <span className="font-bold">{o.price} USDC · x402</span>
                        </Row>
                        <Rule dark />
                        <div className="flex justify-between gap-sm text-[11px] text-muted-light">
                          <span title="SHA-256 of the hidden pick plus a salt, written to Walrus when sealed">HASH {shortId(o.commitment)}</span>
                          {!!o.buyerCount && <span>BOUGHT {o.buyerCount}×</span>}
                        </div>
                        <div className="barcode-light h-[22px]" aria-hidden="true" />
                        {!o.unlocked && (
                          <div className="flex flex-col gap-xs font-sans pt-xs">
                            <WalletBuyButton offer={o} mock={paymentsMock} onError={setAgentError} />
                            {canWrite && (
                              <button onClick={() => handleBuy(o)} disabled={buyingId !== null} className="btn-stamp w-full">
                                {buyingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />} Ask the agent
                              </button>
                            )}
                          </div>
                        )}
                        {result?.decision === 'skipped' && <AdviceList advice={[{ tone: 'warn', text: `Skipped: ${result.reason}` }]} />}
                        {o.unlocked && (
                          <div className="text-xs text-muted-light flex flex-wrap items-center gap-xs">
                            <span>BOUGHT BY THE AGENT · PAID IN TX</span>
                            {o.unlocked.digest.startsWith('mock') ? (
                              <span>{shortId(o.unlocked.digest)}</span>
                            ) : (
                              <a
                                href={`https://suiscan.xyz/${agentWallet?.network ?? 'mainnet'}/tx/${o.unlocked.digest}`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline inline-flex items-center gap-xxs text-carbon-light"
                              >
                                {shortId(o.unlocked.digest)} <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="absolute right-lg top-[40px] pointer-events-none">
                        <Stamp kind={o.unlocked ? 'unlocked' : 'sealed'} size="sm" className={o.unlocked ? '!text-carbon-light' : ''} />
                      </div>
                    </Slip>
                  );
                })}
              </div>
            </div>

            {decisions.length > 0 && (
              <div className="border border-primary bg-secondary">
                <div className="flex justify-between items-center px-xl py-md border-b border-primary font-mono text-xs">
                  <span>WHY THE AGENT PAID, OR DIDN'T</span>
                  <span className="text-tertiary">NEWEST FIRST</span>
                </div>
                <ol className="divide-y divide-secondary">
                  {decisions.map((d) => {
                    const tag =
                      d.type === 'sealed'
                        ? { label: 'SEALED', cls: 'border border-stamp text-stamp-text' }
                        : d.decision === 'paid'
                          ? { label: 'PAID', cls: 'bg-carbon text-paper' }
                          : { label: 'SKIPPED', cls: 'border border-primary' };
                    return (
                      <li key={d.blobId} className="px-xl py-md text-xs flex flex-col md:flex-row md:items-center justify-between gap-sm">
                        <span className="flex flex-col sm:flex-row sm:items-center gap-sm min-w-0">
                          <span className={`font-mono font-bold px-sm py-xxs w-fit flex-shrink-0 whitespace-nowrap ${tag.cls}`}>{tag.label}</span>
                          <span className="text-secondary">
                            <span className="font-mono text-tertiary">{new Date(d.recordedAt).toLocaleString()} · </span>
                            {d.text}
                          </span>
                        </span>
                        <ProofLink url={d.explorerUrl} blobId={d.blobId} />
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            <div className="font-mono text-xs text-secondary border-t border-primary pt-md overflow-x-auto whitespace-nowrap">
              walrus.recall(seller, league) ──▶ trust ──▶ rule ok? ──▶ x402 402 ──▶ USDC transfer on Sui ──▶ tatum.getTransaction ✓ ──▶ pick revealed
            </div>
          </div>
        )}

        {/* ================= MEMORY INSPECTOR ================= */}
        {activeTab === 'memory' && (
          <div className="space-y-3xl">
            <PageHead
              kicker="Memory inspector"
              title="Total recall."
              actions={
                <button onClick={loadMemories} className="btn-line min-h-[36px] text-xs">
                  <RefreshCw className={`w-3.5 h-3.5 ${memoriesLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              }
            >
              Every memory Receipts has written to Walrus, with a link to its blob.
            </PageHead>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              <StatCard label="Network" value={networkLabel} hint={network === 'mainnet' ? 'Every blob is on Walrus mainnet' : 'Test network, not permanent'} />
              <StatCard label="Memories stored" value={`${memories.length}`} hint="Picks, grades, credibility and profile" brand />
              <StatCard
                label="Last written"
                value={timeAgo(memories[0]?.createdAt)}
                hint={memories[0] ? `To ${memories[0].namespace.replace(/^receipts-/, '')}` : 'Nothing written yet'}
              />
            </div>

            <div className="p-xl bg-secondary border border-primary space-y-md">
              <div className="flex items-center gap-xs text-md font-bold">
                <Brain className="w-4 h-4" /> {canWrite ? 'What Receipts knows about you' : 'What Receipts knows about its owner'}
              </div>
              {learningError && <ErrorBox message={learningError} />}
              {profile && profile.patterns.length === 0 && (
                <p className="text-xs text-secondary">
                  No strong patterns yet. Receipts calls something a pattern once 5 graded picks in a league, market or price range are clearly winning or losing.
                </p>
              )}
              {profile?.patterns.map((p) => (
                <div key={p.key} className={`text-xs pl-sm py-xs border-l-2 flex flex-wrap items-center gap-xs ${ADVICE_STYLES[p.verdict === 'leak' ? 'warn' : 'good']}`}>
                  <span>{p.text}</span>
                  <ProofLink url={p.explorerUrl} blobId={p.blobId} />
                </div>
              ))}
              {(canWrite || profile?.limit?.maxDailyLosses) && (
                <div className="flex flex-wrap items-center gap-sm text-xs text-secondary pt-md border-t border-dashed border-primary">
                  {canWrite ? (
                    <>
                      <span>Warn me after</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        className="w-16 px-sm py-xxs bg-secondary border border-primary text-primary font-mono"
                        aria-label="Daily loss limit"
                      />
                      <span>losing picks in one day</span>
                      <button onClick={handleSetLimit} className="btn-ink min-h-[32px] px-md text-xs">
                        Remember this
                      </button>
                    </>
                  ) : (
                    <span>Daily loss limit: warns after {profile?.limit?.maxDailyLosses} losing picks in one day</span>
                  )}
                  {profile?.limit?.maxDailyLosses && (
                    <span className="text-tertiary">
                      {canWrite && <>Current: {profile.limit.maxDailyLosses} · </>}<ProofLink url={profile.limit.explorerUrl} blobId={profile.limit.blobId} />
                    </span>
                  )}
                </div>
              )}
            </div>

            {memoriesError && <ErrorBox message={memoriesError} />}
            {!memoriesLoading && !memoriesError && memories.length === 0 && <p className="text-sm text-secondary">No memories yet.</p>}
            {memories.length > 0 && (
              <div className="border border-primary overflow-x-auto bg-secondary">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-primary font-mono text-xs uppercase">
                      <th className="py-md px-lg">Namespace</th>
                      <th className="py-md px-lg">Walrus blob</th>
                      <th className="py-md px-lg">Written</th>
                      <th className="py-md px-lg">Size</th>
                      <th className="py-md px-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary text-sm">
                    {memories.map((m) => (
                      <tr key={m.memoryId} className="hover:bg-secondary-hover transition-colors">
                        <td className="py-md px-lg">
                          <span className="px-xs py-xxs border border-primary text-xs font-mono">{m.namespace.replace('receipts-', '')}</span>
                        </td>
                        <td className="py-md px-lg">
                          <ProofLink url={m.explorerUrl} blobId={m.blobId} />
                        </td>
                        <td className="py-md px-lg text-secondary text-xs font-mono">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}</td>
                        <td className="py-md px-lg text-secondary text-xs font-mono">{m.size ? `${(m.size / 1024).toFixed(1)} KB` : '—'}</td>
                        <td className="py-md px-lg text-secondary text-xs font-mono">{m.status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= SUI WALLET ================= */}
        {activeTab === 'wallet' && (
          <div className="max-w-3xl mx-auto space-y-2xl">
            <PageHead kicker="Sui wallet reader" title="Check a balance">
              Read live SUI and USDC balances on Sui Mainnet through Tatum's Sui gRPC gateway.
            </PageHead>

            <div className="p-2xl bg-secondary border border-primary space-y-xl">
              <div className="space-y-xs">
                <label className="kicker text-secondary" htmlFor="wallet-address">
                  Sui wallet address
                </label>
                <div className="flex gap-sm">
                  <input
                    id="wallet-address"
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="0x..."
                    className={`${inputClass} flex-1 font-mono`}
                  />
                  <button onClick={fetchWallet} disabled={isLoadingWallet} className="btn-ink">
                    {isLoadingWallet ? 'Querying…' : 'Fetch balances'}
                  </button>
                </div>
              </div>

              {walletError && <ErrorBox message={walletError} />}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <div className="p-xl border border-primary">
                  <div className="flex items-center justify-between">
                    <span className="kicker text-tertiary">Native asset</span>
                    <span className="font-mono text-xs text-secondary">0x2::sui::SUI</span>
                  </div>
                  <div className="font-mono text-heading-md font-bold mt-sm">{suiBalance !== null ? `${suiBalance} SUI` : '—'}</div>
                  <p className="text-xs text-secondary mt-xxs">Gas currency on Sui Mainnet</p>
                </div>
                <div className="p-xl border border-primary">
                  <div className="flex items-center justify-between">
                    <span className="kicker text-tertiary">Stablecoin</span>
                    <span className="font-mono text-xs text-secondary">USDC (native)</span>
                  </div>
                  <div className="font-mono text-heading-md font-bold mt-sm text-carbon">{usdcBalance !== null ? `${usdcBalance} USDC` : '—'}</div>
                  <p className="text-xs text-secondary mt-xxs">Pays for pay-per-pick unlocks</p>
                </div>
              </div>

              <div className="p-lg bg-ink text-paper flex items-start gap-md">
                <Wallet className="w-5 h-5 flex-shrink-0 mt-xxs" />
                <div className="text-xs space-y-xxs">
                  <div className="font-semibold">Read through Tatum's Sui gateway</div>
                  <div className="text-muted-light">
                    The server calls <code className="font-mono text-carbon-light">listBalances</code> over gRPC with its own Tatum key, so no key ever reaches the browser.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <SiteFooter full={false} />
    </div>
  );
}
