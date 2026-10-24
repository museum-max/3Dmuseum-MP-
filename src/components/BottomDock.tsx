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
} from 'lucide-react';
import { ExhibitData } from '../types';

interface BottomDockProps {
  onJumpRoom: (room: 'rotunda' | 'renaissance' | 'cyberpunk' | 'vault') => void;
  onResetView: () => void;
  onOpenPassModal: () => void;
  onOpenImportModal: () => void;
  activeExhibit: ExhibitData | null;
  hoveredExhibit: ExhibitData | null;
  vaultUnlocked: boolean;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  onJumpRoom,
  onResetView,
  onOpenPassModal,
  onOpenImportModal,
  activeExhibit,
  hoveredExhibit,
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
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-transform duration-300 ease-out"
      style={{
        width: 'min(940px, 94vw)',
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
      <div className="pointer-events-auto p-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-black/80 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Gallery Wing Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => handleRoomClick('rotunda')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'rotunda'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Grand Rotunda</span>
          </button>

          <button
            onClick={() => handleRoomClick('renaissance')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'renaissance'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Digital Renaissance</span>
          </button>

          <button
            onClick={() => handleRoomClick('cyberpunk')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'cyberpunk'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Cyberpunk &amp; Nebula</span>
          </button>

          <button
            onClick={() => handleRoomClick('vault')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
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
            <span>VIP Obsidian Vault</span>
            {!vaultUnlocked && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 font-mono">
                PASS
              </span>
            )}
          </button>
        </div>

        {/* Center / Right: Hover/Active Info & Utility Actions */}
        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t md:border-t-0 border-slate-800 pt-2 md:pt-0">
          <div className="flex items-center gap-2 max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap">
            {hoveredExhibit || activeExhibit ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: (hoveredExhibit || activeExhibit)?.accentColor }}
                />
                <span className="text-xs font-mono text-white truncate">
                  {(hoveredExhibit || activeExhibit)?.title}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 font-mono hidden lg:inline">
                Click pedestal to inspect
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Curate NFT Button */}
            <button
              onClick={onOpenImportModal}
              title="Curate or Display NFT in 3D Museum"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 text-amber-300 hover:text-white hover:bg-slate-700 text-xs transition-colors font-mono"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Curate</span>
            </button>

            {/* Reset Camera View */}
            <button
              onClick={onResetView}
              title="Reset Gallery Camera View"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Pass Terminal Trigger */}
            <button
              onClick={onOpenPassModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-900/30"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Pass Terminal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
