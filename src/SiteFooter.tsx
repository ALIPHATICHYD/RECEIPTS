import { useEffect, useRef, useState } from 'react';
import { Logo } from './thermal';

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'App',
    links: [
      { label: 'Feed', href: '#feed' },
      { label: 'Sources', href: '#sources' },
      { label: 'Agent', href: '#agent' },
      { label: 'Memory', href: '#memory' },
      { label: 'Wallet', href: '#wallet' },
    ],
  },
  {
    title: 'Ecosystem',
    links: [
      { label: 'Walrus Memory', href: 'https://www.walrus.xyz', external: true },
      { label: 'Tatum', href: 'https://tatum.io', external: true },
      { label: 'Sui', href: 'https://sui.io', external: true },
      { label: 'x402', href: 'https://www.x402.org', external: true },
    ],
  },
  {
    title: 'Source',
    links: [{ label: 'GitHub', href: 'https://github.com/ALIPHATICHYD/RECEIPTS', external: true }],
  },
];

// The stadium is a large SVG, so it loads only when the footer scrolls near.
function Stadium() {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          import('./assets/footer-stadium.svg?raw').then((m) => setSvg(m.default));
        }
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      role="img"
      aria-label="A dithered stadium at night. A Receipts printer in the players' tunnel prints a receipt that rolls across the pitch."
      className="w-full overflow-hidden"
      style={{ minHeight: 'clamp(340px, 42vw, 600px)' }}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

export function SiteFooter({ full = true }: { full?: boolean }) {
  return (
    <footer className="bg-ink text-paper relative">
      <div className="max-w-6xl mx-auto px-xl pt-8xl pb-4xl flex flex-wrap gap-y-5xl gap-x-4xl justify-between">
        <div className="flex-1 basis-[320px] max-w-md space-y-3xl">
          <a href="#" className="flex items-center gap-md">
            <Logo size={28} />
            <span className="font-display text-[26px] tracking-wide">Receipts</span>
          </a>
          <p className="text-[24px] leading-tight font-medium text-[#D9D4C7]">Every pick prints a receipt. Nothing gets deleted, so trust has to be earned.</p>
        </div>
        <div className="flex-[2] basis-[480px] grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4xl">
          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-xl text-md">
              <span className="kicker text-muted-light tracking-[0.2em]">{col.title}</span>
              <span className="w-10 border-t-2 border-dashed border-stamp -mt-xs" aria-hidden="true" />
              {col.links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                  className="hover:text-stamp transition-colors w-fit"
                >
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="basis-full flex flex-wrap justify-between gap-md font-mono text-xs text-muted-light border-t border-dashed border-muted pt-2xl">
          <span>© 2026 RECEIPTS · BUILT ON WALRUS + TATUM</span>
          <span>NO PICK WAS EDITED IN THE MAKING OF THIS SITE</span>
        </div>
      </div>
      {full && <Stadium />}
    </footer>
  );
}
