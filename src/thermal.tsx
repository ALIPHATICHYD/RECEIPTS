// Small building blocks for the Thermal look: every pick is a printed slip,
// results are rubber stamps, and trust is an ASCII bar.
import React from 'react';
import type { PickStatus } from './api';

export function Logo({ size = 28, paper = '#FFFDF7', ink = '#121212' }: { size?: number; paper?: string; ink?: string }) {
  return (
    <svg width={size} height={size * 1.13} viewBox="0 0 30 34" aria-hidden="true">
      <path d="M2 2h26v30l-4.33-3-4.33 3-4.34-3-4.33 3-4.34-3L2 32z" fill={paper} />
      <path d="M7 8h16M7 13h16M7 18h10" stroke={ink} strokeWidth="2.6" />
    </svg>
  );
}

const STAMP: Record<PickStatus | 'sealed' | 'paid' | 'skipped' | 'unlocked', { label: string; color: string; dashed?: boolean }> = {
  won: { label: 'Won', color: 'text-carbon' },
  lost: { label: 'Lost', color: 'text-stamp-text' },
  push: { label: 'Push', color: 'text-primary' },
  pending: { label: 'Open', color: 'text-primary', dashed: true },
  sealed: { label: 'Sealed', color: 'text-stamp' },
  paid: { label: 'Paid', color: 'text-carbon' },
  skipped: { label: 'Skipped', color: 'text-tertiary', dashed: true },
  unlocked: { label: 'Unlocked', color: 'text-carbon' },
};

export function Stamp({ kind, className = '', size = 'md' }: { kind: keyof typeof STAMP; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = STAMP[kind];
  const text = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-lg';
  return (
    <span className={`stamp ${s.color} ${text} ${className}`} style={s.dashed ? { borderStyle: 'dashed' } : undefined}>
      {s.label}
    </span>
  );
}

// [######----] 62. Ten cells, one per ten points of trust.
export function asciiBar(value: number | null | undefined, cells = 10) {
  if (value == null) return `[${'·'.repeat(cells)}]`;
  const filled = Math.max(0, Math.min(cells, Math.round(value / (100 / cells))));
  return `[${'#'.repeat(filled)}${'-'.repeat(cells - filled)}]`;
}

export function TrustBar({ value, className = '' }: { value: number | null | undefined; className?: string }) {
  return (
    <span className={`font-mono whitespace-nowrap ${className}`} title="Trust, 0 to 100. 50 is neutral.">
      {asciiBar(value)} {value ?? '—'}
    </span>
  );
}

export function Row({ label, children, className = '' }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex justify-between gap-md ${className}`}>
      <span className="text-tertiary flex-shrink-0">{label}</span>
      <span className="text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

export function Rule({ dark }: { dark?: boolean }) {
  return <div className={`border-t border-dashed ${dark ? 'border-ink-line' : 'border-muted'}`} aria-hidden="true" />;
}

// A printed slip with a torn bottom edge. `behind` is the colour under the tear.
export function Slip({
  children,
  dark,
  tilt = 0,
  className = '',
  behind = 'var(--paper)',
}: {
  children: React.ReactNode;
  dark?: boolean;
  tilt?: number;
  className?: string;
  behind?: string;
}) {
  return (
    <div
      className={`relative flex flex-col ${className}`}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined, filter: 'drop-shadow(0 2px 2px rgba(18, 18, 18, 0.14))' }}
    >
      <div className={`flex-1 font-mono text-sm ${dark ? 'bg-ink text-paper' : 'bg-slip text-primary'}`}>{children}</div>
      <div className="zig" style={{ '--zig-bg': behind, '--zig-fg': dark ? 'var(--ink)' : 'var(--slip)' } as React.CSSProperties} aria-hidden="true" />
    </div>
  );
}

export function PageHead({ kicker, title, children, actions }: { kicker: string; title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-lg border-b-2 border-primary pb-lg">
      <div className="space-y-sm min-w-0">
        <div className="kicker text-secondary">{kicker}</div>
        <h1 className="font-display text-[44px] sm:text-[64px]">{title}</h1>
        {children && <p className="text-md text-secondary max-w-2xl">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-xs">{actions}</div>}
    </div>
  );
}

// Deterministic pseudo-hash so each slip gets a stable number and tilt.
export function slipNumber(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
