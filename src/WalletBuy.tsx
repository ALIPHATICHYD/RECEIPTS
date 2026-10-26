import { useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { Loader2, Wallet, ExternalLink } from 'lucide-react';
import { api, shortId, type SealedOffer, type WalletUnlock } from './api';

// A pick bought from the visitor's own wallet stays in their browser only.
const STORE = 'receipts:wallet-unlocks';
function loadUnlocks(): Record<string, WalletUnlock> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}');
  } catch {
    return {};
  }
}
function saveUnlock(id: string, unlock: WalletUnlock) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...loadUnlocks(), [id]: unlock }));
  } catch {}
}

export function ConnectWallet() {
  return <ConnectButton />;
}

// Pays an offer's x402 terms from the connected wallet, then asks the seller
// for the pick with the transaction digest as proof.
export function WalletBuyButton({ offer, mock, onError }: { offer: SealedOffer; mock: boolean; onError: (message: string | null) => void }) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [busy, setBusy] = useState<string | null>(null);
  const [unlock, setUnlock] = useState<WalletUnlock | null>(() => loadUnlocks()[offer.id] ?? null);

  if (unlock) {
    return (
      <div className="p-md rounded-md bg-utility-success-50 border border-utility-success-200 text-xs text-utility-success-700 flex flex-wrap items-center gap-xs">
        <span>
          Your pick: <strong>{unlock.pick.side}</strong> ({unlock.pick.market}){unlock.pick.odds ? ` at ${unlock.pick.odds}` : ''}.
        </span>
        <span className="opacity-80">Paid from your wallet in</span>
        {unlock.txUrl ? (
          <a href={unlock.txUrl} target="_blank" rel="noreferrer" className="font-mono underline inline-flex items-center gap-xxs">
            {shortId(unlock.digest)} <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="font-mono">{shortId(unlock.digest)}</span>
        )}
      </div>
    );
  }

  const buy = async () => {
    onError(null);
    try {
      setBusy('Reading the price…');
      const terms = await api.offerTerms(offer.id);
      let digest: string;
      if (mock) {
        // Offline demo: nothing is signed or paid.
        digest = `mock${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
      } else {
        setBusy('Approve in your wallet…');
        const tx = new Transaction();
        tx.transferObjects([coinWithBalance({ type: terms.asset, balance: BigInt(terms.maxAmountRequired) })], terms.payTo);
        const res = await dAppKit.signAndExecuteTransaction({ transaction: tx });
        if (res.$kind !== 'Transaction') throw new Error('The payment failed on chain, so nothing was unlocked.');
        digest = res.Transaction.digest;
      }
      setBusy('Checking the payment…');
      // The seller looks the transaction up through Tatum; give the node a moment to index it.
      let lastError: unknown;
      for (let i = 0; i < 6; i++) {
        try {
          const paid = await api.unlockWithPayment(offer.id, terms.network, digest);
          const result: WalletUnlock = { pick: paid.pick, digest, txUrl: paid.txUrl };
          saveUnlock(offer.id, result);
          setUnlock(result);
          return;
        } catch (err) {
          lastError = err;
          if (!/not found/i.test((err as Error).message)) break;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      throw new Error(`Paid in ${digest}, but the seller couldn't confirm it yet: ${(lastError as Error)?.message}. Try again in a minute; the same payment still counts.`);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (!account && !mock) return null;
  return (
    <button
      onClick={buy}
      disabled={busy !== null}
      className="px-md py-xs rounded-md border border-brand bg-primary text-brand-primary text-xs font-semibold flex items-center gap-xxs disabled:opacity-60"
      title={mock ? 'Mock mode: nothing is paid' : `Pay ${offer.price} USDC from ${account ? shortId(account.address) : 'your wallet'}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />} {busy ?? `Buy with my wallet`}
    </button>
  );
}
