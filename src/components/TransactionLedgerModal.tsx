import React from 'react';
import {
  History,
  ExternalLink,
  CheckCircle2,
  Clock,
  Layers,
  X,
  Fuel,
} from 'lucide-react';
import { ChainTransaction, WalletState } from '../types';
import { formatAddress } from '../contracts/MuseumPassContract';

interface TransactionLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: ChainTransaction[];
  wallet: WalletState;
}

export const TransactionLedgerModal: React.FC<TransactionLedgerModalProps> = ({
  isOpen,
  onClose,
  transactions,
  wallet,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                On-Chain Transaction Stream
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Museum Pass (MP) &amp; Curation Events • Indexed via Firebase Firestore
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
            <span>NETWORK: {wallet.network.name}</span>
            <span>TOTAL INDEXED: {transactions.length}</span>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-800/30 border border-dashed border-slate-700/60 text-slate-400 text-xs">
              No on-chain activity recorded yet. Mint a Museum Pass or place an exhibit bid to see verified transaction blocks stream here!
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-300">
                        {tx.method}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        {tx.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span>Caller: {formatAddress(tx.from)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-500" />
                        Block #{tx.blockNumber || 5892140}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-slate-500" />
                        {tx.gasUsed || '42,150'} gas
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="font-mono text-[11px] text-slate-500">
                      {tx.txHash ? `${tx.txHash.slice(0, 8)}...` : ''}
                    </span>
                    <a
                      href={wallet.network.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 transition-colors"
                      title="View on Testnet Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
