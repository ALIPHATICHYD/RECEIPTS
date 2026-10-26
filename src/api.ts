export type Category = 'Sports' | 'Polymarket' | 'Crypto' | 'Macro';
export type PickStatus = 'pending' | 'won' | 'lost' | 'push';

export interface PickRecord {
  id: string;
  event: string;
  market: string;
  side: string;
  odds: string;
  source: string;
  category: Category;
  confidence: number;
  notes: string;
  eventTime: string | null;
  league?: string;
  loggedAt: string;
  status: PickStatus;
  blobId?: string;
  storedAt?: string;
  explorerUrl?: string | null;
  grade?: { result: PickStatus; closingOdds: string | null; gradedAt: string; blobId?: string; explorerUrl?: string | null } | null;
  trust?: number | null;
  advice?: Advice[];
}

export interface MemoryRef {
  blobId: string;
  explorerUrl: string | null;
}

export interface Advice {
  tone: 'good' | 'warn' | 'info';
  text: string;
  memory?: MemoryRef;
}

export interface CredibilityRecord extends MemoryRef {
  key: string;
  source: string;
  league: string;
  n: number;
  won: number;
  lost: number;
  push: number;
  trust: number;
  prevTrust: number;
  roi: number;
  clv: number | null;
  reason: string;
  recordedAt: string;
  text: string;
}

export interface PatternRecord extends MemoryRef {
  key: string;
  label: string;
  n: number;
  won: number;
  lost: number;
  roi: number;
  verdict: 'leak' | 'edge' | 'neutral';
  recordedAt: string;
  text: string;
}

export interface ProfileData {
  patterns: PatternRecord[];
  limit: (MemoryRef & { maxDailyLosses: number | null; recordedAt: string }) | null;
  history: (MemoryRef & { type: string; recordedAt: string; text: string })[];
  segments: { key: string; label: string; n: number; won: number; lost: number; roi: number; verdict: string }[];
}

export type PickInput = Pick<PickRecord, 'event' | 'market' | 'side' | 'odds' | 'source' | 'category' | 'confidence' | 'notes'>;

export interface MemoryRow {
  memoryId: string;
  namespace: string;
  blobId: string;
  createdAt: string | null;
  size?: number;
  status?: string;
  explorerUrl: string | null;
}

export interface JobStatus {
  status: 'pending' | 'running' | 'uploaded' | 'done' | 'failed' | 'not_found';
  blobId: string | null;
  explorerUrl: string | null;
  error?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  memoryStatus: () => call<{ network: string; configured: boolean; error?: string }>('/api/memory/status'),
  listPicks: () => call<{ network: string; picks: PickRecord[] }>('/api/picks'),
  logPick: (input: PickInput) =>
    call<{ pick: PickRecord; jobId: string }>('/api/picks', { method: 'POST', body: JSON.stringify(input) }),
  jobStatus: (jobId: string) => call<JobStatus>(`/api/picks/jobs/${encodeURIComponent(jobId)}`),
  parseTip: (text: string, source?: string) =>
    call<{ draft: PickInput }>('/api/picks/parse', { method: 'POST', body: JSON.stringify({ text, source }) }),
  gradePick: (id: string, result: 'won' | 'lost' | 'push', closingOdds?: string) =>
    call<{ jobId: string; credibility: string; trust: number; prevTrust: number; patterns: string[] }>(
      `/api/picks/${encodeURIComponent(id)}/grade`,
      { method: 'POST', body: JSON.stringify({ result, closingOdds }) },
    ),
  credibility: () => call<{ network: string; board: CredibilityRecord[]; history: CredibilityRecord[] }>('/api/credibility'),
  profile: () => call<ProfileData>('/api/profile'),
  setLimit: (maxDailyLosses: number) =>
    call<{ jobId: string; sentence: string }>('/api/profile/limit', { method: 'POST', body: JSON.stringify({ maxDailyLosses }) }),
  listMemories: () => call<{ network: string; total: number; memories: MemoryRow[] }>('/api/memories'),
  suiBalance: (address: string) =>
    call<{ sui: string; usdc: string }>(`/api/sui/balance?address=${encodeURIComponent(address)}`),
};

// Poll a remember job until Walrus has the blob (or it fails). Relayer writes
// usually land within a few seconds; give up after ~90s and let the UI say so.
export async function waitForJob(jobId: string, onUpdate: (s: JobStatus) => void): Promise<JobStatus> {
  for (let i = 0; i < 45; i++) {
    const s = await api.jobStatus(jobId);
    onUpdate(s);
    if (s.status === 'done' || s.status === 'failed' || s.status === 'not_found') return s;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { status: 'pending', blobId: null, explorerUrl: null, error: 'Still storing; check the Memory tab shortly' };
}

export interface SourceStats {
  source: string;
  total: number;
  won: number;
  lost: number;
  pending: number;
  winRate: number | null;
  lastPickAt: string;
  categories: Category[];
}

export function sourceStats(picks: PickRecord[]): SourceStats[] {
  const map = new Map<string, SourceStats>();
  for (const p of picks) {
    const s = map.get(p.source) ?? { source: p.source, total: 0, won: 0, lost: 0, pending: 0, winRate: null, lastPickAt: p.loggedAt, categories: [] };
    s.total++;
    if (p.status === 'won') s.won++;
    else if (p.status === 'lost') s.lost++;
    else if (p.status === 'pending') s.pending++;
    if (p.loggedAt > s.lastPickAt) s.lastPickAt = p.loggedAt;
    if (!s.categories.includes(p.category)) s.categories.push(p.category);
    map.set(p.source, s);
  }
  for (const s of map.values()) {
    const graded = s.won + s.lost;
    s.winRate = graded ? (s.won / graded) * 100 : null;
  }
  // Graded record first (Phase 2 replaces this with remembered credibility), then volume.
  return [...map.values()].sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1) || b.total - a.total);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-6)}` : id;
}

export function pct(x: number): string {
  return `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
}
