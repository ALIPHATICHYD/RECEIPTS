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
  pct,
} from './api';

type Tab = 'feed' | 'log' | 'sources' | 'memory' | 'wallet';
type FeedFilter = 'all' | Category;

const MAINNET_MEMORY_GOAL = 10;

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

const inputClass =
  'w-full px-md py-sm rounded-md bg-tertiary border border-secondary text-primary text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring';

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Flame; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`px-md sm:px-lg py-xs rounded-sm text-sm font-medium transition-colors flex items-center gap-xs ${
        active ? 'bg-secondary text-primary shadow-xs' : 'text-secondary hover:text-primary hover:bg-secondary-hover'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatCard({ label, value, hint, brand }: { label: string; value: string; hint: string; brand?: boolean }) {
  return (
    <div className="p-xl rounded-md bg-secondary border border-secondary">
      <span className="text-xs text-tertiary uppercase font-semibold tracking-wider">{label}</span>
      <div className={`text-heading-sm font-bold mt-xs ${brand ? 'text-brand-primary' : ''}`}>{value}</div>
      <div className="text-xs text-secondary mt-xxs">{hint}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: PickRecord['status'] }) {
  if (status === 'won')
    return (
      <span className="inline-flex items-center gap-xs rounded-full border border-utility-success-200 bg-utility-success-50 px-md py-xxs text-xs font-medium text-utility-success-700">
        <CheckCircle2 className="w-3.5 h-3.5 text-fg-success-primary" /> Won
      </span>
    );
  if (status === 'lost')
    return (
      <span className="inline-flex items-center gap-xs rounded-full border border-utility-error-200 bg-utility-error-50 px-md py-xxs text-xs font-medium text-utility-error-700">
        <XCircle className="w-3.5 h-3.5 text-fg-error-primary" /> Lost
      </span>
    );
  return (
    <span className="inline-flex items-center gap-xs rounded-full border border-secondary bg-tertiary px-md py-xxs text-xs font-medium text-secondary">
      <Clock className="w-3.5 h-3.5 text-fg-tertiary" /> {status === 'push' ? 'Push' : 'Open'}
    </span>
  );
}

function ProofLink({ url, blobId }: { url?: string | null; blobId?: string | null }) {
  if (!blobId) return null;
  if (!url) return <span className="text-xs font-mono text-tertiary">{shortId(blobId)}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs font-mono text-brand-primary inline-flex items-center gap-xxs hover:underline">
      {shortId(blobId)} <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-md rounded-md bg-utility-error-50 border border-utility-error-200 text-utility-error-700 text-xs flex items-start gap-xs">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

const ADVICE_STYLES: Record<Advice['tone'], string> = {
  good: 'border-utility-success-200 bg-utility-success-50 text-utility-success-700',
  warn: 'border-utility-error-200 bg-utility-error-50 text-utility-error-700',
  info: 'border-secondary bg-tertiary text-secondary',
};

function AdviceList({ advice }: { advice: Advice[] }) {
  return (
    <ul className="space-y-xxs pt-xs">
      {advice.map((a, i) => (
        <li key={i} className={`text-xs px-sm py-xxs rounded-sm border flex flex-wrap items-center gap-xs ${ADVICE_STYLES[a.tone]}`}>
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

function GradeButtons({ busy, onGrade }: { busy: boolean; onGrade: (r: 'won' | 'lost' | 'push') => void }) {
  if (busy) {
    return (
      <span className="text-xs text-tertiary flex items-center gap-xxs">
        <Loader2 className="w-3 h-3 animate-spin" /> grading
      </span>
    );
  }
  const btn = 'px-sm py-xxs rounded-sm border text-xs font-medium';
  return (
    <div className="flex gap-xxs" aria-label="Grade this pick">
      <button onClick={() => onGrade('won')} className={`${btn} border-utility-success-200 bg-utility-success-50 text-utility-success-700`}>Won</button>
      <button onClick={() => onGrade('lost')} className={`${btn} border-utility-error-200 bg-utility-error-50 text-utility-error-700`}>Lost</button>
      <button onClick={() => onGrade('push')} className={`${btn} border-secondary bg-tertiary text-secondary`}>Push</button>
    </div>
  );
}

function TrustDelta({ from, to }: { from: number; to: number }) {
  if (from === to) return <span className="text-xs text-tertiary">=</span>;
  const up = to > from;
  return <span className={`text-xs font-semibold ${up ? 'text-utility-success-700' : 'text-utility-error-700'}`}>{up ? '▲' : '▼'} {Math.abs(to - from)}</span>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
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
  const [learned, setLearned] = useState<string[] | null>(null);
  const [credBoard, setCredBoard] = useState<CredibilityRecord[]>([]);
  const [credHistory, setCredHistory] = useState<CredibilityRecord[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [limitInput, setLimitInput] = useState('3');
  const [learningError, setLearningError] = useState<string | null>(null);

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
    if (activeTab === 'sources' || activeTab === 'memory') loadLearning();
  }, [activeTab, loadLearning]);

  const handleGrade = async (pick: PickRecord, result: 'won' | 'lost' | 'push') => {
    setGradingId(pick.id);
    setPicksError(null);
    try {
      const res = await api.gradePick(pick.id, result);
      setLearned([res.credibility, ...res.patterns]);
      // The relayer indexes the new memories in the background; give it a moment
      // before re-reading so the feed shows the updated trust.
      await new Promise((r) => setTimeout(r, 4000));
      await loadPicks();
    } catch (err: any) {
      setPicksError(err.message);
    } finally {
      setGradingId(null);
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

  return (
    <div className="min-h-screen bg-primary text-primary font-sans antialiased selection:bg-brand-solid selection:text-primary-on-brand flex flex-col">
      <header className="border-b border-secondary bg-secondary sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-xl py-lg flex items-center justify-between gap-md">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-md bg-brand-solid flex items-center justify-center shadow-xs">
              <Flame className="w-5 h-5 text-primary-on-brand" />
            </div>
            <div className="hidden md:block">
              <div className="flex items-center gap-xs">
                <span className="text-heading-xs font-bold tracking-tight">Receipts</span>
                <span className="px-xs py-xxs rounded-sm bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 text-xs font-semibold">
                  Pick Journal
                </span>
              </div>
              <p className="text-xs text-tertiary">Remembers who was actually right</p>
            </div>
          </div>

          <nav className="flex items-center gap-xs bg-tertiary p-xxs rounded-md border border-secondary">
            <NavButton active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} icon={TrendingUp} label="Feed" />
            <NavButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={PlusCircle} label="Log Pick" />
            <NavButton active={activeTab === 'sources'} onClick={() => setActiveTab('sources')} icon={Users} label="Sources" />
            <NavButton active={activeTab === 'memory'} onClick={() => setActiveTab('memory')} icon={Brain} label="Memory" />
            <NavButton active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} icon={Wallet} label="Sui Wallet" />
          </nav>

          <div className="hidden lg:flex items-center gap-sm">
            <div className="px-md py-xs rounded-md bg-tertiary border border-secondary text-xs flex items-center gap-xs">
              <span className={`w-2 h-2 rounded-full ${memoryError ? 'bg-error-secondary' : 'bg-brand-solid animate-pulse'}`}></span>
              <span className="text-secondary font-medium">{networkLabel}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-xl py-2xl space-y-xl">
        {memoryError && <ErrorBox message={`Walrus Memory: ${memoryError}`} />}
        {learned && (
              <div className="p-lg rounded-md bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 text-sm space-y-xxs">
                <div className="font-semibold flex items-center gap-xs">
                  <Sparkles className="w-4 h-4" /> Receipts learned something and wrote it to Walrus
                </div>
                {learned.map((l, i) => (
                  <p key={i} className="text-xs">{l}</p>
                ))}
                <button onClick={() => setLearned(null)} className="text-xs underline">Dismiss</button>
              </div>
            )}

        {/* ================= FEED ================= */}
        {activeTab === 'feed' && (
          <div className="space-y-2xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-lg">
              <StatCard label="Total Logged" value={`${picks.length} Picks`} hint={`Across ${stats.length} source${stats.length === 1 ? '' : 's'}`} />
              <StatCard
                label="Win Rate"
                value={graded.length ? `${((won / graded.length) * 100).toFixed(1)}%` : '—'}
                hint={graded.length ? `${won}W - ${graded.length - won}L (${pending} open)` : `${pending} open, graded after each event settles`}
                brand
              />
              <StatCard label="Stored on Walrus" value={`${picks.filter((p) => p.blobId).length}`} hint="Picks with a Walrus blob" brand />
              <StatCard label="Most Active Source" value={busiest?.source ?? '—'} hint={busiest ? `${busiest.total} picks logged` : 'Log your first pick'} />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md border-b border-secondary pb-lg">
              <div>
                <h1 className="text-heading-sm font-bold">Pick Journal Feed</h1>
                <p className="text-sm text-secondary">Every pick is written to Walrus Memory before the event, so nothing gets quietly deleted</p>
              </div>
              <div className="flex flex-wrap items-center gap-xs">
                {(['all', 'Sports', 'Polymarket', 'Crypto', 'Macro'] as FeedFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFeedFilter(f)}
                    className={`px-md py-xs rounded-sm text-xs font-medium border ${
                      feedFilter === f ? 'bg-brand-solid text-primary-on-brand border-transparent' : 'bg-secondary text-secondary border-secondary hover:text-primary'
                    }`}
                  >
                    {f === 'all' ? 'All Picks' : f}
                  </button>
                ))}
                <button onClick={loadPicks} className="p-xs rounded-sm border border-secondary bg-secondary text-secondary hover:text-primary" title="Refresh">
                  <RefreshCw className={`w-3.5 h-3.5 ${picksLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {picksError && <ErrorBox message={picksError} />}
            {!picksLoading && !picksError && filteredPicks.length === 0 && (
              <div className="p-2xl rounded-md bg-secondary border border-secondary text-center space-y-sm">
                <p className="text-sm text-secondary">No picks yet. Log one before kickoff and it becomes a permanent receipt.</p>
                <button onClick={() => setActiveTab('log')} className="px-lg py-xs rounded-md bg-brand-solid text-primary-on-brand text-sm font-semibold">
                  Log a pick
                </button>
              </div>
            )}

            <div className="space-y-md">
              {filteredPicks.map((pick) => (
                <div
                  key={pick.id}
                  className="p-xl rounded-md bg-secondary border border-secondary hover:border-primary transition-all flex flex-col md:flex-row md:items-center justify-between gap-lg"
                >
                  <div className="space-y-xs">
                    <div className="flex flex-wrap items-center gap-sm">
                      <span className="px-xs py-xxs rounded-sm bg-tertiary border border-secondary text-xs text-secondary font-medium">{pick.league ?? pick.category}</span>
                      <span className="text-xs text-tertiary flex items-center gap-xxs">
                        <Clock className="w-3 h-3" />
                        {timeAgo(pick.loggedAt)}
                      </span>
                      <span className="text-xs font-medium text-brand-primary">{pick.source}</span>
                      {pick.blobId ? (
                        <ProofLink url={pick.explorerUrl} blobId={pick.blobId} />
                      ) : (
                        <span className="text-xs text-tertiary flex items-center gap-xxs">
                          <Loader2 className="w-3 h-3 animate-spin" /> storing
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-sm">
                      <h3 className="text-base font-bold text-primary">{pick.event}</h3>
                      <span className="text-xs text-tertiary">({pick.market})</span>
                    </div>
                    {pick.notes && <p className="text-xs text-secondary italic">&ldquo;{pick.notes}&rdquo;</p>}
                    {pick.status === 'pending' && pick.advice && pick.advice.length > 0 && <AdviceList advice={pick.advice} />}
                  </div>

                  <div className="flex items-center gap-xl border-t md:border-t-0 pt-md md:pt-0 border-secondary">
                    <div className="text-right min-w-[120px]">
                      <div className="text-xs text-tertiary uppercase font-medium">Selected Side</div>
                      <div className="text-sm font-bold text-primary">{pick.side}</div>
                      <div className="text-xs text-secondary font-mono">{pick.odds || '—'}</div>
                    </div>
                    <div className="min-w-[80px] text-center">
                      <div className="text-xs text-tertiary uppercase font-medium">Source Trust</div>
                      <div className="text-sm font-bold text-brand-primary">{pick.trust ?? '—'}</div>
                      <div className="w-16 h-1.5 bg-tertiary rounded-full overflow-hidden mx-auto mt-xxs">
                        <div className="h-full bg-brand-solid" style={{ width: `${pick.trust ?? 0}%` }}></div>
                      </div>
                    </div>
                    <div className="min-w-[120px] flex flex-col items-end gap-xs">
                      <StatusBadge status={pick.status} />
                      {pick.status === 'pending' && pick.blobId && (
                        <GradeButtons busy={gradingId === pick.id} onGrade={(result) => handleGrade(pick, result)} />
                      )}
                      {pick.grade?.blobId && <ProofLink url={pick.grade.explorerUrl} blobId={pick.grade.blobId} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= LOG PICK ================= */}
        {activeTab === 'log' && (
          <div className="max-w-2xl mx-auto space-y-xl">
            <div className="border-b border-secondary pb-md">
              <h1 className="text-heading-sm font-bold">Log New Pick (Receipt)</h1>
              <p className="text-sm text-secondary">Record the pick before the event starts. It is stored on Walrus with a Sui-backed timestamp.</p>
            </div>

            <div className="p-xl rounded-md bg-secondary border border-secondary space-y-md">
              <div className="flex items-center gap-xs text-sm font-semibold">
                <ClipboardPaste className="w-4 h-4 text-brand-primary" /> Paste a tip
              </div>
              <textarea
                rows={3}
                placeholder="Paste a tipster's post from X, Telegram or WhatsApp, e.g. “@StatViper Celtics vs Knicks: Celtics -4.5 (-110) 3u”"
                value={tipText}
                onChange={(e) => setTipText(e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleParseTip}
                disabled={parsing || !tipText.trim()}
                className="px-lg py-xs rounded-md bg-tertiary border border-secondary text-xs font-semibold text-primary hover:bg-secondary-hover disabled:opacity-50 flex items-center gap-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-primary" /> {parsing ? 'Reading…' : 'Fill the form from this tip'}
              </button>
              <p className="text-xs text-tertiary">Check the fields below before saving. Nothing is stored until you commit.</p>
            </div>

            {saveJob && (
              <div className="p-lg rounded-md bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 text-sm font-medium flex items-center gap-sm">
                {saveJob.status === 'done' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />}
                <span>
                  {saveJob.status === 'done' ? 'Receipt stored on Walrus. ' : `Storing on Walrus (${saveJob.status})… `}
                  <ProofLink url={saveJob.explorerUrl} blobId={saveJob.blobId} />
                </span>
              </div>
            )}
            {formError && <ErrorBox message={formError} />}

            <form onSubmit={handleCreatePick} className="p-2xl rounded-md bg-secondary border border-secondary space-y-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Category</label>
                  <select value={form.category} onChange={(e) => updateForm('category', e.target.value as Category)} className={inputClass}>
                    <option value="Sports">Sports (NBA, NFL, Soccer, etc.)</option>
                    <option value="Polymarket">Polymarket / Prediction Market</option>
                    <option value="Crypto">Crypto Price Binary</option>
                    <option value="Macro">Macro / Politics</option>
                  </select>
                </div>
                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Source Handle</label>
                  <input type="text" placeholder="@tipster or @me" value={form.source} onChange={(e) => updateForm('source', e.target.value)} className={inputClass} required />
                </div>
              </div>

              <div className="space-y-xs">
                <label className="text-xs font-medium text-secondary uppercase tracking-wider">Event / Matchup</label>
                <input type="text" placeholder="e.g. Chiefs vs 49ers, or Senate control after the midterms" value={form.event} onChange={(e) => updateForm('event', e.target.value)} className={inputClass} required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Market Type</label>
                  <input type="text" placeholder="Spread, Total, Moneyline, Yes/No" value={form.market} onChange={(e) => updateForm('market', e.target.value)} className={inputClass} required />
                </div>
                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Side / Pick</label>
                  <input type="text" placeholder="Chiefs -3.5 or YES" value={form.side} onChange={(e) => updateForm('side', e.target.value)} className={inputClass} required />
                </div>
                <div className="space-y-xs">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Odds / Price</label>
                  <input type="text" placeholder="-110, 1.91 or 0.65" value={form.odds} onChange={(e) => updateForm('odds', e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="space-y-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-secondary uppercase tracking-wider">Confidence Level</label>
                  <span className="text-xs font-bold text-brand-primary">{form.confidence}%</span>
                </div>
                <input type="range" min="50" max="100" value={form.confidence} onChange={(e) => updateForm('confidence', Number(e.target.value))} className="w-full cursor-pointer" />
              </div>

              <div className="space-y-xs">
                <label className="text-xs font-medium text-secondary uppercase tracking-wider">Notes &amp; Rationale</label>
                <textarea rows={3} placeholder="Injury news, line movement, the tipster's reasoning…" value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} className={inputClass}></textarea>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-md rounded-md bg-brand-solid hover:bg-brand-solid-hover disabled:bg-disabled-subtle text-primary-on-brand font-semibold text-sm transition-colors border border-transparent shadow-xs flex items-center justify-center gap-xs"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                {saving ? 'Writing to Walrus…' : 'Commit Receipt to Walrus'}
              </button>
            </form>
          </div>
        )}

        {/* ================= SOURCES ================= */}
        {activeTab === 'sources' && (
          <div className="space-y-xl">
            <div className="border-b border-secondary pb-md">
              <h1 className="text-heading-sm font-bold">Source Credibility</h1>
              <p className="text-sm text-secondary">
                Trust is scored per source and league from graded receipts, and every change is written to Walrus as a new memory.
              </p>
            </div>
            {learningError && <ErrorBox message={learningError} />}

            {credBoard.length === 0 ? (
              <p className="text-sm text-secondary">No graded picks yet. Grade an open pick in the feed and its source gets a score here.</p>
            ) : (
              <div className="rounded-md border border-secondary overflow-x-auto bg-secondary">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-secondary bg-tertiary text-xs font-medium text-tertiary uppercase tracking-wider">
                      <th className="py-md px-lg">Rank</th>
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
                        <td className="py-md px-lg font-bold">
                          {i === 0 ? (
                            <span className="flex items-center gap-xs text-brand-primary">
                              <Award className="w-4 h-4 text-fg-brand-primary" /> #1
                            </span>
                          ) : (
                            `#${i + 1}`
                          )}
                        </td>
                        <td className="py-md px-lg font-medium text-primary">{c.source}</td>
                        <td className="py-md px-lg text-secondary text-xs">{c.league}</td>
                        <td className="py-md px-lg">
                          <span className="font-semibold text-brand-primary">{c.trust}</span> <TrustDelta from={c.prevTrust} to={c.trust} />
                        </td>
                        <td className="py-md px-lg font-mono text-xs">
                          {c.won}W-{c.lost}L{c.push ? `-${c.push}P` : ''}
                        </td>
                        <td className={`py-md px-lg text-xs font-semibold ${c.roi >= 0 ? 'text-utility-success-700' : 'text-utility-error-700'}`}>{pct(c.roi)}</td>
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
                <h2 className="text-base font-bold">Waiting for results</h2>
                <div className="flex flex-wrap gap-xs">
                  {stats
                    .filter((s) => !credBoard.some((c) => c.source.toLowerCase() === s.source.toLowerCase()))
                    .map((s) => (
                      <span key={s.source} className="px-md py-xxs rounded-sm bg-secondary border border-secondary text-xs text-secondary">
                        {s.source} · {s.pending} open
                      </span>
                    ))}
                </div>
              </div>
            )}

            {credHistory.length > 0 && (
              <div className="space-y-sm">
                <h2 className="text-base font-bold">How Receipts changed its mind</h2>
                <p className="text-xs text-tertiary">Append-only: each line is its own Walrus memory and names the score it replaced.</p>
                <ol className="space-y-xs">
                  {credHistory.map((h) => (
                    <li key={h.blobId} className="p-md rounded-md bg-secondary border border-secondary text-xs flex flex-col md:flex-row md:items-center justify-between gap-xs">
                      <span className="text-secondary">
                        <span className="text-tertiary">{new Date(h.recordedAt).toLocaleString()} · </span>
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

        {/* ================= MEMORY INSPECTOR ================= */}
        {activeTab === 'memory' && (
          <div className="space-y-xl">
            <div className="border-b border-secondary pb-md flex items-center justify-between gap-md">
              <div>
                <h1 className="text-heading-sm font-bold">Memory Inspector</h1>
                <p className="text-sm text-secondary">Every memory Receipts has written to Walrus, with a link to its blob</p>
              </div>
              <button
                onClick={loadMemories}
                className="px-lg py-xs rounded-md bg-secondary border border-secondary text-xs font-semibold text-primary hover:bg-tertiary transition-colors flex items-center gap-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-brand-primary ${memoriesLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              <StatCard label="Network" value={networkLabel} hint={network === 'mainnet' ? 'Counts toward the submission' : 'Switch to mainnet before submitting'} />
              <StatCard label="Memories Stored" value={`${memories.length}`} hint="Picks, grades, credibility and profile" brand />
              <div className="p-xl rounded-md bg-secondary border border-secondary">
                <span className="text-xs text-tertiary uppercase font-semibold tracking-wider">Mainnet Requirement</span>
                <div className="text-heading-sm font-bold mt-xs">
                  {network === 'mainnet' ? Math.min(memories.length, MAINNET_MEMORY_GOAL) : 0} / {MAINNET_MEMORY_GOAL}
                </div>
                <div className="w-full h-1.5 bg-tertiary rounded-full overflow-hidden mt-sm">
                  <div
                    className="h-full bg-brand-solid"
                    style={{ width: `${network === 'mainnet' ? Math.min(100, (memories.length / MAINNET_MEMORY_GOAL) * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="p-xl rounded-md bg-secondary border border-secondary space-y-md">
              <div className="flex items-center gap-xs text-base font-bold">
                <Brain className="w-4 h-4 text-brand-primary" /> What Receipts knows about you
              </div>
              {learningError && <ErrorBox message={learningError} />}
              {profile && profile.patterns.length === 0 && (
                <p className="text-xs text-secondary">
                  No strong patterns yet. Receipts calls something a pattern once 5 graded picks in a league, market or price range are clearly winning or losing.
                </p>
              )}
              {profile?.patterns.map((p) => (
                <div key={p.key} className={`text-xs px-sm py-xs rounded-sm border flex flex-wrap items-center gap-xs ${ADVICE_STYLES[p.verdict === 'leak' ? 'warn' : 'good']}`}>
                  <span>{p.text}</span>
                  <ProofLink url={p.explorerUrl} blobId={p.blobId} />
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-sm text-xs text-secondary pt-xs border-t border-secondary">
                <span>Warn me after</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  className="w-16 px-sm py-xxs rounded-sm bg-tertiary border border-secondary text-primary"
                />
                <span>losing picks in one day</span>
                <button onClick={handleSetLimit} className="px-md py-xxs rounded-sm bg-brand-solid text-primary-on-brand font-semibold">
                  Remember this
                </button>
                {profile?.limit?.maxDailyLosses && (
                  <span className="text-tertiary">
                    Current: {profile.limit.maxDailyLosses} · <ProofLink url={profile.limit.explorerUrl} blobId={profile.limit.blobId} />
                  </span>
                )}
              </div>
            </div>

            {memoriesError && <ErrorBox message={memoriesError} />}
            {!memoriesLoading && !memoriesError && memories.length === 0 && <p className="text-sm text-secondary">No memories yet. Log a pick to write the first one.</p>}
            {memories.length > 0 && (
              <div className="rounded-md border border-secondary overflow-x-auto bg-secondary">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-secondary bg-tertiary text-xs font-medium text-tertiary uppercase tracking-wider">
                      <th className="py-md px-lg">Namespace</th>
                      <th className="py-md px-lg">Walrus Blob</th>
                      <th className="py-md px-lg">Written</th>
                      <th className="py-md px-lg">Size</th>
                      <th className="py-md px-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary text-sm">
                    {memories.map((m) => (
                      <tr key={m.memoryId} className="hover:bg-secondary-hover transition-colors">
                        <td className="py-md px-lg">
                          <span className="px-xs py-xxs rounded-sm bg-tertiary border border-secondary text-xs font-mono">{m.namespace.replace('receipts-', '')}</span>
                        </td>
                        <td className="py-md px-lg">
                          <ProofLink url={m.explorerUrl} blobId={m.blobId} />
                        </td>
                        <td className="py-md px-lg text-secondary text-xs">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}</td>
                        <td className="py-md px-lg text-secondary text-xs">{m.size ? `${(m.size / 1024).toFixed(1)} KB` : '—'}</td>
                        <td className="py-md px-lg text-secondary text-xs">{m.status ?? '—'}</td>
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
          <div className="max-w-3xl mx-auto space-y-xl">
            <div className="border-b border-secondary pb-md">
              <h1 className="text-heading-sm font-bold">Sui Wallet Reader</h1>
              <p className="text-sm text-secondary">Read real-time SUI and USDC balances on Sui Mainnet powered by Tatum RPC Gateway</p>
            </div>

            <div className="p-2xl rounded-md bg-secondary border border-secondary space-y-xl">
              <div className="space-y-xs">
                <label className="text-xs font-medium text-secondary uppercase tracking-wider">Sui Wallet Address</label>
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

              {walletError && <ErrorBox message={walletError} />}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg pt-md">
                <div className="p-xl rounded-md bg-tertiary border border-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-tertiary uppercase font-medium">Native Asset</span>
                    <span className="px-xs py-xxs rounded-sm bg-secondary text-xs font-mono text-secondary">0x2::sui::SUI</span>
                  </div>
                  <div className="text-heading-md font-bold mt-sm text-primary">{suiBalance !== null ? `${suiBalance} SUI` : '—'}</div>
                  <p className="text-xs text-secondary mt-xxs">Gas currency on Sui Mainnet</p>
                </div>
                <div className="p-xl rounded-md bg-tertiary border border-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-tertiary uppercase font-medium">Stablecoin</span>
                    <span className="px-xs py-xxs rounded-sm bg-secondary text-xs font-mono text-secondary">USDC (Native)</span>
                  </div>
                  <div className="text-heading-md font-bold mt-sm text-primary">{usdcBalance !== null ? `${usdcBalance} USDC` : '—'}</div>
                  <p className="text-xs text-secondary mt-xxs">Pays for pay-per-pick unlocks</p>
                </div>
              </div>

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
