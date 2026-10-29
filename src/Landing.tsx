import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { api, type AgentDecision, type CredibilityRecord, type PickRecord } from './api';
import { Logo, Row, Rule, Stamp, asciiBar, slipNumber } from './thermal';
import { SiteFooter } from './SiteFooter';

const STEPS = [
  { n: '001 / RECORD', title: 'Log the pick before kickoff', text: 'Paste a tip or link a live Polymarket market. It becomes a Walrus memory anyone can open.' },
  { n: '002 / GRADE', title: 'Settled by the market', text: "Tatum's prediction market API says who won, and Receipts grades the pick itself." },
  { n: '003 / LEARN', title: 'Trust moves per league', text: "Each result shifts the source's score, and the history shows every change of mind." },
  { n: '004 / PAY', title: 'An agent that only pays for proof', text: 'Sealed picks sit behind x402. The agent pays USDC on Sui only when trust clears the bar.' },
];

function pickNo(p: PickRecord) {
  return `#${String(slipNumber(p.id) % 10000).padStart(4, '0')}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

function HeroReceipt({ pick }: { pick: PickRecord | null }) {
  const p = pick;
  return (
    <div className="relative w-[320px] sm:w-[340px] max-w-full" style={{ transform: 'rotate(3deg)' }}>
      <div className="bg-slip text-primary font-mono text-[13px] px-2xl pt-2xl pb-lg flex flex-col gap-[9px]">
        <div className="text-center font-display text-[22px] normal-case">RECEIPTS</div>
        <div className="text-center text-tertiary">{p ? `PICK ${pickNo(p)} · ${shortDate(p.loggedAt)}` : 'PICK #0142 · SAMPLE'}</div>
        <div className="text-tertiary overflow-hidden whitespace-nowrap">================================</div>
        <Row label="EVENT"><span className="uppercase">{p?.event ?? 'Lakers v Suns'}</span></Row>
        <Row label="PICK"><span className="uppercase">{p?.side ?? 'Suns ML'}</span></Row>
        <Row label="ODDS">{p?.odds || '+120'}</Row>
        <Row label="SOURCE">{p?.source ?? '@filip-tomic'}</Row>
        <div className="text-tertiary overflow-hidden whitespace-nowrap">--------------------------------</div>
        <Row label={<span className="font-bold text-primary">TRUST {(p?.league ?? 'NBA').toUpperCase()}</span>}>
          <span className="font-bold">{p ? (p.trust ?? '—') : '66'}</span>
        </Row>
        <Row label="SETTLED VIA">{p ? (p.marketId ? 'TATUM' : 'BY HAND') : 'TATUM'}</Row>
        <Row label="STORED ON">WALRUS</Row>
        <div className="barcode h-10 mt-xs" aria-hidden="true" />
        <div className="text-center text-[11px] text-tertiary">THIS RECEIPT CANNOT BE EDITED</div>
      </div>
      <div className="zig" style={{ '--zig-bg': 'transparent' } as CSSProperties} aria-hidden="true" />
      <Stamp kind={p?.status ?? 'won'} size="lg" className="absolute right-md top-md" />
    </div>
  );
}

function LedgerStrip({ board }: { board: CredibilityRecord[] | null }) {
  const top = (board ?? []).slice().sort((a, b) => b.trust - a.trust).slice(0, 4);
  const latest = (board ?? []).reduce<string | null>((m, c) => (!m || c.recordedAt > m ? c.recordedAt : m), null);
  return (
    <div className="max-w-7xl mx-auto px-xl pb-5xl relative">
      <div className="bg-[#0A0A0A] border border-ink-line relative font-mono text-paper">
        <div className="flex flex-wrap justify-between gap-xs px-xl py-md border-b border-dashed border-ink-line text-xs text-muted-light tracking-[0.06em]">
          <span>
            <span className="text-stamp">●</span> LIVE LEDGER · TRUST BY SOURCE × LEAGUE
          </span>
          <span>
            RECALLED FROM WALRUS MEMORY{latest ? ` · ${new Date(latest).toISOString().slice(11, 16)} UTC` : ''}
          </span>
        </div>
        {board === null ? (
          <div className="px-xl py-2xl text-sm text-muted-light">Reading the ledger from Walrus…</div>
        ) : top.length === 0 ? (
          <div className="px-xl py-2xl text-sm text-muted-light">No graded picks yet. The ledger fills in as results come in.</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))]">
            {top.map((c, i) => {
              const delta = c.trust - c.prevTrust;
              return (
                <div key={c.key} className={`px-xl py-lg flex flex-col gap-sm min-w-0 ${i < top.length - 1 ? 'border-r border-ink-line' : ''}`}>
                  <div className="flex justify-between text-xs text-muted-light">
                    <span>
                      {String(i + 1).padStart(2, '0')} · {c.league.toUpperCase()}
                    </span>
                    <span>
                      {c.won}-{c.lost} W-L
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline gap-sm">
                    <span className="text-md font-bold truncate">{c.source}</span>
                    <span className="text-[30px] font-bold leading-none">
                      {c.trust}
                      <span className={`text-sm ml-xs ${delta > 0 ? 'text-carbon-light' : delta < 0 ? 'text-stamp' : 'text-muted-light'}`}>
                        {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '='}
                      </span>
                    </span>
                  </div>
                  <div className="text-sm text-[#D9D4C7] tracking-[0.04em]">{asciiBar(c.trust)}</div>
                </div>
              );
            })}
          </div>
        )}
        <div aria-hidden="true" className="scan absolute inset-0 pointer-events-none" />
      </div>
    </div>
  );
}

function Ticker({ picks, decisions }: { picks: PickRecord[]; decisions: AgentDecision[] }) {
  const items = useMemo(() => {
    const out: string[] = [];
    for (const p of picks.filter((p) => p.status !== 'pending').slice(0, 8)) {
      out.push(`${p.status.toUpperCase()}  ${p.source}  ${p.side.toUpperCase()}${p.trust != null ? `  ·  TRUST ${p.trust}` : ''}`);
    }
    for (const d of decisions.filter((d) => d.type === 'decision').slice(0, 4)) {
      out.push(d.decision === 'paid' ? `PAID  ${d.price} USDC  ·  ${d.source}  ·  SEALED ${d.league.toUpperCase()} PICK` : `SKIPPED  ${d.source}  ·  ${(d.reason ?? '').toUpperCase()}`);
    }
    for (const p of picks.filter((p) => p.status === 'pending').slice(0, 4)) out.push(`OPEN  ${p.source}  ${p.side.toUpperCase()}`);
    return out;
  }, [picks, decisions]);
  if (!items.length) return null;
  const line = items.join('  ///  ') + '  ///  ';
  return (
    <div className="border-y border-ink-line font-mono text-sm text-[#D9D4C7] py-md overflow-hidden whitespace-nowrap" aria-label="Recent results">
      <div className="ticker-track">
        <span className="px-xl">{line}</span>
        <span className="px-xl" aria-hidden="true">
          {line}
        </span>
      </div>
    </div>
  );
}

export function Landing({ picks }: { picks: PickRecord[] }) {
  const [board, setBoard] = useState<CredibilityRecord[] | null>(null);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);

  useEffect(() => {
    api.credibility().then((r) => setBoard(r.board)).catch(() => setBoard([]));
    api.agentDecisions().then((r) => setDecisions(r.records)).catch(() => {});
    api.listMemories().then((r) => setMemoryCount(r.memories.length)).catch(() => {});
  }, []);

  const graded = picks.filter((p) => p.status !== 'pending');
  const heroPick = graded.find((p) => p.status === 'won') ?? graded[0] ?? null;
  const sources = new Set((board ?? []).map((c) => c.source.toLowerCase())).size;
  const payments = decisions.filter((d) => d.decision === 'paid').length;
  const top = (board ?? []).slice().sort((a, b) => b.trust - a.trust).slice(0, 5);

  const stats: [string, string][] = [
    [memoryCount == null ? '…' : String(memoryCount), 'memories on Walrus Memory'],
    [String(graded.length), 'picks graded from results'],
    [board == null ? '…' : String(sources), 'sources with a trust score'],
    [String(payments), 'x402 payments by the agent'],
  ];

  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col">
      <header className="bg-ink text-paper">
        <div className="max-w-7xl mx-auto px-xl py-lg flex flex-wrap items-center justify-between gap-lg">
          <a href="#" className="flex items-center gap-md">
            <Logo size={26} />
            <span className="font-display text-[26px] tracking-wide">Receipts</span>
            <span className="hidden md:inline font-mono text-xs text-muted-light">PICK JOURNAL · WALRUS MAINNET</span>
          </a>
          <nav className="hidden md:flex gap-3xl text-md font-medium">
            <a href="#feed" className="hover:text-stamp">Feed</a>
            <a href="#sources" className="hover:text-stamp">Sources</a>
            <a href="#agent" className="hover:text-stamp">Agent</a>
            <a href="#memory" className="hover:text-stamp">Memory</a>
          </nav>
          <a href="#feed" className="btn bg-paper text-ink hover:bg-white">
            Open the journal <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      <section className="bg-ink text-paper">
        <div className="max-w-7xl mx-auto px-xl pt-7xl pb-6xl flex flex-wrap gap-6xl items-center">
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-3xl">
            <span className="kicker text-muted-light">Pick journal · Walrus Memory · Sui</span>
            <h1 className="font-display text-[clamp(60px,9vw,136px)] leading-[0.86]">
              Who was
              <br />
              <span className="dot-text text-paper">actually</span>
              <br />
              right?
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#D9D4C7]">
              Tipsters delete their losses and screenshot their wins. Receipts writes every pick to Walrus Memory before kickoff, grades it from the market
              result, and remembers who has earned your trust.
            </p>
            <div className="flex flex-wrap gap-md">
              <a href="#feed" className="btn-stamp text-md px-2xl min-h-[48px]">
                Browse the record
              </a>
              <a href="#agent" className="btn-line text-md px-2xl min-h-[48px]">
                Buy a sealed pick with your wallet
              </a>
            </div>
          </div>
          <div className="flex-[1_1_340px] flex justify-center relative py-2xl">
            <div className="halftone absolute -inset-x-lg inset-y-0 opacity-55" aria-hidden="true" />
            <HeroReceipt pick={heroPick} />
          </div>
        </div>
        <LedgerStrip board={board} />
        <Ticker picks={picks} decisions={decisions} />
      </section>

      <section className="max-w-7xl w-full mx-auto px-xl pt-7xl pb-3xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 border border-primary">
          {stats.map(([v, label], i) => (
            <div key={label} className={`p-2xl flex flex-col gap-xs border-primary ${i % 2 === 0 ? 'border-r' : 'lg:border-r'} ${i < 2 ? 'border-b lg:border-b-0' : ''} ${i === 3 ? 'lg:border-r-0' : ''}`}>
              <span className="font-mono text-[44px] font-bold leading-none">{v}</span>
              <span className="text-sm text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl w-full mx-auto px-xl py-7xl flex flex-col gap-5xl">
        <div className="flex flex-wrap justify-between items-end gap-3xl">
          <h2 className="font-display text-[clamp(44px,6vw,80px)]">
            Four lines
            <br />
            on every slip
          </h2>
          <p className="max-w-md text-md text-secondary">Nothing is overwritten. A grade, a correction or a new trust score is a new memory that names the one it replaces.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t-2 border-primary">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`py-3xl flex flex-col gap-md ${i === 0 ? 'lg:pr-3xl' : 'lg:px-3xl lg:border-l border-primary'} ${i % 2 === 1 ? 'sm:pl-3xl sm:border-l' : ''}`}>
              <span className="font-mono text-sm">{s.n}</span>
              <span className="text-[26px] font-bold leading-tight">{s.title}</span>
              <span className="text-md text-secondary">{s.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl w-full mx-auto px-xl pt-3xl pb-8xl flex flex-wrap gap-5xl items-start">
        <div className="flex-[1_1_360px] flex flex-col gap-lg">
          <span className="kicker">Top of the ledger</span>
          <h2 className="font-display text-[56px]">
            Earned,
            <br />
            not claimed.
          </h2>
          <p className="text-md text-secondary max-w-md">
            Trust starts at 50 and is pulled toward 50 until a source has enough graded picks, so one lucky call never makes a genius.
          </p>
          <a href="#sources" className="btn-ink w-fit">
            See every source <ArrowRight className="w-4 h-4" />
          </a>
        </div>
        <div className="flex-[999_1_560px] min-w-0 overflow-x-auto">
          {top.length === 0 ? (
            <div className="border-2 border-dashed border-primary p-3xl text-secondary">{board === null ? 'Reading the ledger…' : 'No source has a graded pick yet.'}</div>
          ) : (
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-primary text-left font-mono text-xs">
                  <th className="py-md px-sm">#</th>
                  <th className="py-md px-sm">SOURCE</th>
                  <th className="py-md px-sm">LEAGUE</th>
                  <th className="py-md px-sm">RECORD</th>
                  <th className="py-md px-sm">TRUST</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {top.map((c, i) => (
                  <tr key={c.key} className="border-b border-primary">
                    <td className="py-lg px-sm">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-lg px-sm font-sans font-bold text-md">{c.source}</td>
                    <td className="py-lg px-sm">{c.league.toUpperCase()}</td>
                    <td className="py-lg px-sm">
                      {c.won}-{c.lost}
                    </td>
                    <td className="py-lg px-sm whitespace-nowrap">
                      {asciiBar(c.trust)} {c.trust}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-lg">
            <Rule />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
