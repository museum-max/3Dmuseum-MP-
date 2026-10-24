import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Ticket,
  BookOpen,
  History,
  Code2,
  Wallet,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Upload,
  ShoppingBag,
} from 'lucide-react';
import { WalletState } from '../types';
import { sound } from '../audio/soundEffects';
import { formatAddress } from '../contracts/MuseumPassContract';

interface TopBarProps {
  wallet: WalletState;
  onOpenPassModal: (tab?: 'mint' | 'transfer' | 'deploy' | 'contract') => void;
  onOpenImportModal: () => void;
  onOpenMarketplace: () => void;
  onOpenGuestbook: () => void;
  onOpenTransactions: () => void;
  onConnectWallet: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  wallet,
  onOpenPassModal,
  onOpenImportModal,
  onOpenMarketplace,
  onOpenGuestbook,
  onOpenTransactions,
  onConnectWallet,
}) => {
  const [muted, setMuted] = useState(sound.getMuted());
  const [showHelp, setShowHelp] = useState(false);

  const toggleAudio = () => {
    sound.startAmbient();
    const newMuted = sound.toggleMute();
    setMuted(newMuted);
    sound.playClick();
  };

  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 pointer-events-none">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/30 shadow-lg shadow-black/40">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/20" />
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-widest uppercase text-white font-mono">
                AETHERIA
              </span>
              <span className="text-[10px] text-amber-300/80 font-mono tracking-tight -mt-0.5">
                3D NFT MUSEUM // MP TOKEN
              </span>
            </div>
          </div>

          {/* Testnet Badge */}
          <button
            onClick={() => onOpenPassModal('mint')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 text-xs hover:border-slate-500 transition-colors"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px] font-medium">{wallet.network.name}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* Right: Actions, Marketplace, Curate, Pass, Wallet */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Audio Synthesizer */}
          <button
            onClick={toggleAudio}
            title={muted ? 'Enable Ambient Gallery Audio' : 'Mute Sound'}
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Marketplace Button */}
          <button
            onClick={onOpenMarketplace}
            title="P2P Marketplace: Buy &amp; Sell NFTs and Passes"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900 hover:text-white transition-colors text-xs font-mono font-bold shadow-md shadow-emerald-950/30"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Marketplace</span>
          </button>

          {/* Curate / Display External NFT */}
          <button
            onClick={onOpenImportModal}
            title="Curate &amp; Display NFT on 3D Pedestal"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-amber-500/40 text-amber-300 hover:border-amber-400 hover:text-white transition-colors text-xs font-mono"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Curate</span>
          </button>

          {/* Guestbook */}
          <button
            onClick={onOpenGuestbook}
            title="Visitor Guestbook & Ledger"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-xs font-medium"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Guestbook</span>
          </button>

          {/* Transaction Ledger */}
          <button
            onClick={onOpenTransactions}
            title="Live Blockchain Event Stream"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-xs font-medium"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Ledger</span>
          </button>

          {/* Museum Pass (MP) Mint & Transfer Pill */}
          <button
            onClick={() => onOpenPassModal(wallet.activePass ? 'transfer' : 'mint')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              wallet.activePass
                ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 shadow-md shadow-amber-900/20 hover:border-amber-400'
                : 'bg-gradient-to-r from-amber-600 to-amber-500 border-amber-400 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-600/30'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            {wallet.activePass ? (
              <span className="flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                {wallet.activePass.tier} PASS ({wallet.balanceMP})
              </span>
            ) : (
              <span className="font-semibold tracking-wide">MINT PASS</span>
            )}
          </button>

          {/* Wallet Connect */}
          <button
            onClick={onConnectWallet}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-white text-xs hover:border-slate-500 transition-colors"
          >
            <Wallet className="w-3.5 h-3.5 text-sky-400" />
            <div className="flex flex-col text-left">
              <span className="font-mono text-[11px] font-semibold text-slate-200">
                {formatAddress(wallet.address)}
              </span>
              <span className="text-[9px] text-slate-400 font-mono -mt-0.5">
                {wallet.balanceETH.toFixed(2)} {wallet.network.currency}
              </span>
            </div>
          </button>

          {/* Help Button */}
          <button
            onClick={() => setShowHelp(true)}
            title="Museum Navigation Controls"
            className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-400 hover:text-white transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Navigation Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-amber-400">
                <Sparkles className="w-5 h-5" /> 3D Museum Controls &amp; Guide
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/60">
                <span className="font-mono text-xs px-2 py-1 rounded bg-slate-700 text-amber-300 font-bold">W S A D</span>
                <p className="text-xs">First-person walk navigation. W (forward), S (backward), A (left), D (right). Hold Shift to sprint!</p>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/60">
                <span className="font-mono text-xs px-2 py-1 rounded bg-slate-700 text-sky-300 font-bold">KEY &apos;E&apos;</span>
                <p className="text-xs">Inspect exhibit when walking close to a pedestal.</p>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/60">
                <span className="font-mono text-xs px-2 py-1 rounded bg-slate-700 text-emerald-300 font-bold">MARKET</span>
                <p className="text-xs">Decentralized P2P Marketplace where every user can buy and sell exhibited NFTs and Museum Passes.</p>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/60">
                <span className="font-mono text-xs px-2 py-1 rounded bg-slate-700 text-purple-300 font-bold">KEY &apos;H&apos;</span>
                <p className="text-xs">Toggle Cinema Mode to hide or show HUD controls.</p>
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Enter Exhibition
            </button>
          </div>
        </div>
      )}
    </>
  );
};
