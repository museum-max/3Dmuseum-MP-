import React, { useState, useEffect } from 'react';
import {
  Compass,
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Layers,
  Ticket,
  Upload,
  ShoppingBag,
  Footprints,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { ExhibitData, NavigationMode } from '../types';

interface BottomDockProps {
  onJumpRoom: (room: 'rotunda' | 'renaissance' | 'cyberpunk' | 'vault') => void;
  onResetView: () => void;
  onOpenPassModal: () => void;
  onOpenImportModal: () => void;
  onOpenMarketplace: () => void;
  onToggleNavMode: (mode: NavigationMode) => void;
  onVirtualKey: (key: string, pressed: boolean) => void;
  activeExhibit: ExhibitData | null;
  hoveredExhibit: ExhibitData | null;
  nearbyExhibit: ExhibitData | null;
  navMode: NavigationMode;
  vaultUnlocked: boolean;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  onJumpRoom,
  onResetView,
  onOpenPassModal,
  onOpenImportModal,
  onOpenMarketplace,
  onToggleNavMode,
  onVirtualKey,
  activeExhibit,
  hoveredExhibit,
  nearbyExhibit,
  navMode,
  vaultUnlocked,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'rotunda' | 'renaissance' | 'cyberpunk' | 'vault'>('rotunda');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRoomClick = (room: 'rotunda' | 'renaissance' | 'cyberpunk' | 'vault') => {
    setActiveTab(room);
    onJumpRoom(room);
  };

  return (
    <>
      {/* Walk Mode Floating HUD & Proximity Prompt */}
      {navMode === 'WALK' && !isCollapsed && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-2">
          {nearbyExhibit ? (
            <div className="pointer-events-auto px-4 py-2 rounded-2xl bg-amber-500/90 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 animate-bounce">
              <span className="px-2 py-0.5 rounded bg-slate-950 text-amber-300 font-mono text-[10px]">
                PRESS [E]
              </span>
              <span>Inspect {nearbyExhibit.title}</span>
            </div>
          ) : (
            <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-[11px] font-mono text-slate-300 shadow-lg">
              WASD or Arrows to Walk • Drag to Look • Shift to Sprint
            </div>
          )}
        </div>
      )}

      {/* Virtual Touch D-Pad for Mobile Walking */}
      {navMode === 'WALK' && (
        <div className="fixed bottom-28 left-4 z-30 pointer-events-auto flex flex-col items-center gap-1 sm:hidden opacity-80 select-none">
          <button
            onPointerDown={() => onVirtualKey('w', true)}
            onPointerUp={() => onVirtualKey('w', false)}
            className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center active:bg-amber-500 active:text-slate-950"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <div className="flex gap-1">
            <button
              onPointerDown={() => onVirtualKey('a', true)}
              onPointerUp={() => onVirtualKey('a', false)}
              className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center active:bg-amber-500 active:text-slate-950"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onPointerDown={() => onVirtualKey('s', true)}
              onPointerUp={() => onVirtualKey('s', false)}
              className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center active:bg-amber-500 active:text-slate-950"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
            <button
              onPointerDown={() => onVirtualKey('d', true)}
              onPointerUp={() => onVirtualKey('d', false)}
              className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center active:bg-amber-500 active:text-slate-950"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Bottom Dock */}
      <div
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-transform duration-300 ease-out"
        style={{
          width: 'min(980px, 96vw)',
          transform: isCollapsed ? 'translate(-50%, calc(100% - 32px))' : 'translate(-50%, 0)',
        }}
      >
        {/* Collapse/Expand Toggle Tab */}
        <div className="flex justify-center -mb-px">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-slate-900 border-t border-x border-slate-700/80 text-[11px] font-mono font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-md"
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isCollapsed ? 'Show Controls [H]' : 'Hide Controls [H]'}</span>
          </button>
        </div>

        {/* Main Unified Dock Surface */}
        <div className="pointer-events-auto p-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-black/80 flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Left: Mode Toggle & Gallery Wing Presets */}
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none">
            {/* Walk vs Orbit Mode Toggle */}
            <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 shrink-0">
              <button
                onClick={() => onToggleNavMode('WALK')}
                title="Walk exploration with WASD keys"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  navMode === 'WALK'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Walk [WASD]</span>
              </button>

              <button
                onClick={() => onToggleNavMode('ORBIT')}
                title="Orbit & Fly inspection mode"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  navMode === 'ORBIT'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Orbit</span>
              </button>
            </div>

            <div className="h-4 w-px bg-slate-700 shrink-0" />

            {/* Room Jumpers */}
            <button
              onClick={() => handleRoomClick('rotunda')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'rotunda'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Rotunda</span>
            </button>

            <button
              onClick={() => handleRoomClick('renaissance')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'renaissance'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Renaissance</span>
            </button>

            <button
              onClick={() => handleRoomClick('cyberpunk')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'cyberpunk'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Cyberpunk</span>
            </button>

            <button
              onClick={() => handleRoomClick('vault')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'vault'
                  ? 'bg-purple-900/40 text-purple-200 border border-purple-500/40'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {vaultUnlocked ? (
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-purple-400" />
              )}
              <span>VIP Vault</span>
            </button>
          </div>

          {/* Right: Marketplace, Curate, Reset, Pass */}
          <div className="flex items-center justify-between lg:justify-end gap-2 w-full lg:w-auto border-t lg:border-t-0 border-slate-800 pt-2 lg:pt-0">
            {/* Marketplace Button */}
            <button
              onClick={onOpenMarketplace}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold transition-all shadow-md shadow-emerald-950/30"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Marketplace</span>
            </button>

            {/* Curate NFT */}
            <button
              onClick={onOpenImportModal}
              title="Curate or Display NFT in 3D Museum"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 text-amber-300 hover:text-white hover:bg-slate-700 text-xs transition-colors font-mono"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Curate</span>
            </button>

            {/* Reset Camera */}
            <button
              onClick={onResetView}
              title="Reset Gallery Camera View"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Pass Terminal */}
            <button
              onClick={onOpenPassModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-900/30"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pass Terminal</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
