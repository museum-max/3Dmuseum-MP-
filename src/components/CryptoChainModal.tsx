import React from 'react';
import { X, Activity, Zap, ExternalLink, Globe, Compass, ShieldCheck } from 'lucide-react';
import { CryptoChainInfo } from '../three/cryptoLogos';
import { sound } from '../audio/soundEffects';

interface CryptoChainModalProps {
  chain: CryptoChainInfo | null;
  onClose: () => void;
  onTeleportToCore: () => void;
  onInspectGenesisWall: () => void;
}

export const CryptoChainModal: React.FC<CryptoChainModalProps> = ({
  chain,
  onClose,
  onTeleportToCore,
  onInspectGenesisWall,
}) => {
  if (!chain) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden p-6 text-slate-100"
        style={{
          boxShadow: `0 0 35px ${chain.color}33, inset 0 0 15px ${chain.color}11`,
        }}
      >
        {/* Top Header Background Glow */}
        <div
          className="absolute -top-20 -right-20 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: chain.color }}
        />

        {/* Close Button */}
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl border shadow-lg relative overflow-hidden"
            style={{
              backgroundColor: `${chain.color}1a`,
              borderColor: `${chain.color}66`,
              color: chain.accentColor,
            }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: `radial-gradient(circle, ${chain.color} 0%, transparent 70%)`,
              }}
            />
            {chain.symbol}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-700/50">
                RANK #{chain.marketCapRank}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                {chain.category}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
              {chain.name}
              <span className="text-slate-400 font-mono text-base font-normal">({chain.symbol})</span>
            </h2>
          </div>
        </div>

        {/* Status Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 mb-5">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Connected to WORLD CORE
          </div>
          <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono">
            <Activity className="w-3.5 h-3.5" />
            {chain.tps}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          {chain.description}
        </p>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
              <Globe className="w-3.5 h-3.5 text-cyan-400" /> Interoperability
            </div>
            <div className="text-sm font-semibold text-slate-200">
              One World, All Chains
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Security Standard
            </div>
            <div className="text-sm font-semibold text-slate-200">
              Zero-Knowledge Relay
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onTeleportToCore();
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4" /> Orbit Central Planet
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onInspectGenesisWall();
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" /> View Wall Genesis #001
          </button>
        </div>
      </div>
    </div>
  );
};
