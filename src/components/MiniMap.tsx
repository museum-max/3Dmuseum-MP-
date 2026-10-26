import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Lock,
  Unlock,
  Sparkles,
  Footprints,
  Eye,
  Navigation,
} from 'lucide-react';
import { ExhibitData, PlayerTransform, NavigationMode } from '../types';
import { MuseumScene } from '../three/MuseumScene';
import { sound } from '../audio/soundEffects';

interface MiniMapProps {
  sceneRef: React.MutableRefObject<MuseumScene | null>;
  exhibits: ExhibitData[];
  activeExhibit: ExhibitData | null;
  onSelectExhibit: (exhibit: ExhibitData | null) => void;
  vaultUnlocked: boolean;
  navMode: NavigationMode;
}

type MiniMapSize = 'minimized' | 'standard' | 'expanded';

export const MiniMap: React.FC<MiniMapProps> = ({
  sceneRef,
  exhibits,
  activeExhibit,
  onSelectExhibit,
  vaultUnlocked,
  navMode,
}) => {
  const [size, setSize] = useState<MiniMapSize>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return 'minimized';
    }
    return 'standard';
  });
  const [hoveredExhibit, setHoveredExhibit] = useState<ExhibitData | null>(null);
  const [mouseMapCoords, setMouseMapCoords] = useState<{ x: number; z: number } | null>(null);

  // Player transform state (updated via subscription)
  const [player, setPlayer] = useState<PlayerTransform>({
    x: 0,
    z: 7.5,
    yaw: 0,
    pitch: 0,
    room: 'rotunda',
    navMode: 'WALK',
  });

  // Subscribe to MuseumScene player transform
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const connectListener = () => {
      if (sceneRef.current) {
        unsubscribe = sceneRef.current.subscribePlayer((transform) => {
          setPlayer(transform);
        });
      }
    };

    connectListener();

    // In case scene is still initializing, retry after short delay
    const retryInterval = setInterval(() => {
      if (sceneRef.current && !unsubscribe) {
        connectListener();
        if (unsubscribe) clearInterval(retryInterval);
      }
    }, 150);

    return () => {
      clearInterval(retryInterval);
      if (unsubscribe) unsubscribe();
    };
  }, [sceneRef]);

  // Keyboard shortcut 'M' to toggle mini-map modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'm' || e.key === 'M') {
        setSize((prev) => {
          if (prev === 'standard') return 'expanded';
          if (prev === 'expanded') return 'minimized';
          return 'standard';
        });
        sound.playClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Map coordinate conversion
  // World bounds: X in [-24, +24], Z in [-24, +24]
  // Dimensions for SVG viewport: 240 x 240
  const VIEWBOX_SIZE = 240;
  const PADDING = 18;
  const MAP_SPAN = VIEWBOX_SIZE - PADDING * 2; // 204
  const WORLD_SPAN = 48; // from -24 to +24

  const worldToMap = (wx: number, wz: number): { mx: number; my: number } => {
    const normX = (wx + 24) / WORLD_SPAN;
    const normZ = (wz + 24) / WORLD_SPAN;
    return {
      mx: PADDING + normX * MAP_SPAN,
      my: PADDING + normZ * MAP_SPAN,
    };
  };

  const mapToWorld = (mx: number, my: number): { wx: number; wz: number } => {
    const normX = (mx - PADDING) / MAP_SPAN;
    const normZ = (my - PADDING) / MAP_SPAN;
    return {
      wx: normX * WORLD_SPAN - 24,
      wz: normZ * WORLD_SPAN - 24,
    };
  };

  const playerMap = worldToMap(player.x, player.z);

  // Compute rotation angle in degrees for CSS/SVG (0 = North/Up)
  // yaw is in radians: 0 points toward -Z (North), PI/2 points toward -X (West)
  const playerDeg = (player.yaw * 180) / Math.PI;

  // Handle floor-plan click to teleport
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - svgRect.left) / svgRect.width) * VIEWBOX_SIZE;
    const clickY = ((e.clientY - svgRect.top) / svgRect.height) * VIEWBOX_SIZE;

    const { wx, wz } = mapToWorld(clickX, clickY);

    if (sceneRef.current) {
      sceneRef.current.teleportTo(wx, wz);
    }
  };

  const handleMapMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - svgRect.left) / svgRect.width) * VIEWBOX_SIZE;
    const clickY = ((e.clientY - svgRect.top) / svgRect.height) * VIEWBOX_SIZE;
    const { wx, wz } = mapToWorld(clickX, clickY);
    setMouseMapCoords({ x: Number(wx.toFixed(1)), z: Number(wz.toFixed(1)) });
  };

  // Exhibit click
  const handleExhibitMarkerClick = (ex: ExhibitData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sceneRef.current) {
      sceneRef.current.focusExhibit(ex);
    }
    onSelectExhibit(ex);
  };

  // Room jump handler
  const handleRoomJump = (room: 'rotunda' | 'renaissance' | 'cyberpunk' | 'vault', e: React.MouseEvent) => {
    e.stopPropagation();
    if (sceneRef.current) {
      sceneRef.current.jumpToRoom(room);
    }
  };

  // Friendly room title
  const getRoomTitle = (room: string) => {
    switch (room) {
      case 'rotunda':
        return 'Central Rotunda';
      case 'renaissance':
        return 'West Wing (Renaissance)';
      case 'cyberpunk':
        return 'East Wing (Cyberpunk)';
      case 'vault':
        return 'VIP Obsidian Vault';
      case 'entrance':
        return 'Grand Foyer';
      default:
        return 'Museum Gallery';
    }
  };

  // Calculate compass cardinal direction (e.g. N, NW, W, etc.)
  const getCompassHeading = (deg: number) => {
    const normalized = ((deg % 360) + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return 'N (0°)';
    if (normalized >= 22.5 && normalized < 67.5) return 'NW (45°)';
    if (normalized >= 67.5 && normalized < 112.5) return 'W (90°)';
    if (normalized >= 112.5 && normalized < 157.5) return 'SW (135°)';
    if (normalized >= 157.5 && normalized < 202.5) return 'S (180°)';
    if (normalized >= 202.5 && normalized < 247.5) return 'SE (225°)';
    if (normalized >= 247.5 && normalized < 292.5) return 'E (270°)';
    return 'NE (315°)';
  };

  // 1. Minimized View (Floating Radar Compass Pill)
  if (size === 'minimized') {
    return (
      <div className="fixed top-16 right-4 sm:right-6 z-20 pointer-events-auto select-none">
        <button
          onClick={() => {
            setSize('standard');
            sound.playClick();
          }}
          className="group flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-amber-500/40 shadow-xl shadow-black/50 text-white hover:border-amber-400 hover:bg-slate-900 transition-all"
          title="Open Mini-Map (Press M)"
        >
          {/* Rotating Compass Indicator */}
          <div className="relative w-7 h-7 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-75"
              style={{ transform: `rotate(${-playerDeg}deg)` }}
            >
              <Navigation className="w-4 h-4 text-amber-400 fill-amber-400" />
            </div>
          </div>

          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                Mini-Map
              </span>
              <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                [M]
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-300 max-w-[120px] truncate">
              {getRoomTitle(player.room)}
            </span>
          </div>

          <Maximize2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 ml-1 transition-colors" />
        </button>
      </div>
    );
  }

  // Width & height based on standard vs expanded
  const isExpanded = size === 'expanded';
  const containerWidthClass = isExpanded ? 'w-[320px] sm:w-[350px]' : 'w-[220px] sm:w-[240px]';

  return (
    <div
      className={`fixed top-16 right-3 sm:right-6 z-20 pointer-events-auto select-none ${containerWidthClass} transition-all duration-300`}
    >
      <div className="relative flex flex-col rounded-2xl bg-slate-950/90 backdrop-blur-md border border-amber-500/35 shadow-2xl shadow-black/80 overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-200 font-bold">
              Floor Plan // 2D Radar
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Mode toggle */}
            <button
              onClick={() => {
                setSize(isExpanded ? 'standard' : 'expanded');
                sound.playClick();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800/80 transition-colors"
              title={isExpanded ? 'Standard view (Press M)' : 'Expand blueprint (Press M)'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Minimize button */}
            <button
              onClick={() => {
                setSize('minimized');
                sound.playClick();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
              title="Minimize (Press M)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2D SVG Floor Plan Viewport */}
        <div className="relative w-full aspect-square bg-[#030712] overflow-hidden cursor-crosshair">
          <svg
            viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
            className="w-full h-full"
            onClick={handleMapClick}
            onMouseMove={handleMapMouseMove}
            onMouseLeave={() => setMouseMapCoords(null)}
          >
            <defs>
              {/* Subtle blueprint grid */}
              <pattern id="miniGrid" width="12" height="12" patternUnits="userSpaceOnUse">
                <path d="M 12 0 L 0 0 0 12" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
              </pattern>

              {/* Vision cone radial gradient */}
              <radialGradient id="visionConeGrad" cx="0%" cy="100%" r="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
                <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>

              {/* Radar beam pulse */}
              <linearGradient id="scanBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Blueprint Grid Background */}
            <rect width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} fill="#050814" />
            <rect width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} fill="url(#miniGrid)" />

            {/* Architectural Outer Boundary */}
            <rect
              x={worldToMap(-23, -23).mx}
              y={worldToMap(-23, -23).my}
              width={worldToMap(23, 23).mx - worldToMap(-23, -23).mx}
              height={worldToMap(23, 23).my - worldToMap(-23, -23).my}
              fill="rgba(15, 23, 42, 0.5)"
              stroke="#1e293b"
              strokeWidth="1.5"
              rx="10"
            />

            {/* Grand Foyer / Entrance Zone (South, Z: 12 to 23) */}
            <path
              d={`M ${worldToMap(-12, 13).mx} ${worldToMap(-12, 13).my}
                 L ${worldToMap(12, 13).mx} ${worldToMap(12, 13).my}
                 L ${worldToMap(10, 22.5).mx} ${worldToMap(10, 22.5).my}
                 L ${worldToMap(-10, 22.5).mx} ${worldToMap(-10, 22.5).my} Z`}
              fill="rgba(56, 189, 248, 0.04)"
              stroke="rgba(56, 189, 248, 0.2)"
              strokeDasharray="2,2"
              strokeWidth="0.8"
            />

            {/* West Wing: Renaissance Gallery (X: -22 to -3.5, Z: -12 to 12) */}
            <rect
              x={worldToMap(-22, -12).mx}
              y={worldToMap(-22, -12).my}
              width={worldToMap(-3.5, 12).mx - worldToMap(-22, -12).mx}
              height={worldToMap(-3.5, 12).my - worldToMap(-22, -12).my}
              fill="rgba(245, 158, 11, 0.05)"
              stroke={player.room === 'renaissance' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(245, 158, 11, 0.2)'}
              strokeWidth={player.room === 'renaissance' ? '1.5' : '1'}
              rx="6"
            />

            {/* East Wing: Cyberpunk Gallery (X: +3.5 to 22, Z: -12 to 12) */}
            <rect
              x={worldToMap(3.5, -12).mx}
              y={worldToMap(3.5, -12).my}
              width={worldToMap(22, 12).mx - worldToMap(3.5, -12).mx}
              height={worldToMap(22, 12).my - worldToMap(3.5, -12).my}
              fill="rgba(52, 211, 153, 0.05)"
              stroke={player.room === 'cyberpunk' ? 'rgba(52, 211, 153, 0.6)' : 'rgba(52, 211, 153, 0.2)'}
              strokeWidth={player.room === 'cyberpunk' ? '1.5' : '1'}
              rx="6"
            />

            {/* Central Rotunda (Radius = 11, Center at 0, 0) */}
            {(() => {
              const center = worldToMap(0, 0);
              const edge = worldToMap(11, 0);
              const r = edge.mx - center.mx;
              return (
                <g>
                  {/* Rotunda Floor Ring */}
                  <circle
                    cx={center.mx}
                    cy={center.my}
                    r={r}
                    fill={player.room === 'rotunda' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)'}
                    stroke={player.room === 'rotunda' ? 'rgba(56, 189, 248, 0.6)' : 'rgba(148, 163, 184, 0.3)'}
                    strokeDasharray="3,3"
                    strokeWidth="1.2"
                  />
                  {/* Inner Oculus Ring */}
                  <circle
                    cx={center.mx}
                    cy={center.my}
                    r={r * 0.35}
                    fill="none"
                    stroke="rgba(217, 119, 6, 0.3)"
                    strokeWidth="1"
                  />
                  {/* 8 Architectural Columns */}
                  {[...Array(8)].map((_, i) => {
                    const angle = (i / 8) * Math.PI * 2;
                    const colX = Math.cos(angle) * 11;
                    const colZ = Math.sin(angle) * 11;
                    const cp = worldToMap(colX, colZ);
                    return (
                      <circle
                        key={i}
                        cx={cp.mx}
                        cy={cp.my}
                        r="2.2"
                        fill="#cbd5e1"
                        stroke="#f59e0b"
                        strokeWidth="0.6"
                      />
                    );
                  })}
                </g>
              );
            })()}

            {/* North Wall Partition (Z = -15) */}
            {(() => {
              const wl1 = worldToMap(-13, -15);
              const wl2 = worldToMap(-3, -15);
              const wr1 = worldToMap(3, -15);
              const wr2 = worldToMap(13, -15);
              return (
                <g>
                  <line x1={wl1.mx} y1={wl1.my} x2={wl2.mx} y2={wl2.my} stroke="#475569" strokeWidth="3" />
                  <line x1={wr1.mx} y1={wr1.my} x2={wr2.mx} y2={wr2.my} stroke="#475569" strokeWidth="3" />
                </g>
              );
            })()}

            {/* North Chamber: VIP Obsidian Vault (X: -7 to 7, Z: -22.5 to -15) */}
            <rect
              x={worldToMap(-7, -22.5).mx}
              y={worldToMap(-7, -22.5).my}
              width={worldToMap(7, -15).mx - worldToMap(-7, -22.5).mx}
              height={worldToMap(7, -15).my - worldToMap(-7, -22.5).my}
              fill="rgba(168, 85, 247, 0.08)"
              stroke={vaultUnlocked ? '#10b981' : '#a855f7'}
              strokeWidth={player.room === 'vault' ? '1.5' : '1'}
              strokeDasharray={vaultUnlocked ? 'none' : '2,2'}
              rx="4"
            />

            {/* Vault Gate Indicator */}
            {(() => {
              const gateL = worldToMap(-2.8, -15);
              const gateR = worldToMap(2.8, -15);
              return (
                <line
                  x1={gateL.mx}
                  y1={gateL.my}
                  x2={gateR.mx}
                  y2={gateR.my}
                  stroke={vaultUnlocked ? '#10b981' : '#ef4444'}
                  strokeWidth="2.5"
                  strokeDasharray={vaultUnlocked ? '3,3' : 'none'}
                />
              );
            })()}

            {/* Room Labels (rendered when expanded or standard) */}
            {isExpanded && (
              <g className="text-[7px] font-mono font-bold select-none pointer-events-none opacity-60">
                <text x={worldToMap(0, -18.5).mx} y={worldToMap(0, -18.5).my - 7} fill="#c084fc" textAnchor="middle">
                  VIP VAULT
                </text>
                <text x={worldToMap(-12, 0).mx} y={worldToMap(-12, 0).my} fill="#f59e0b" textAnchor="middle">
                  WEST GALLERY
                </text>
                <text x={worldToMap(12, 0).mx} y={worldToMap(12, 0).my} fill="#34d399" textAnchor="middle">
                  EAST GALLERY
                </text>
                <text x={worldToMap(0, 0).mx} y={worldToMap(0, 0).my - 14} fill="#38bdf8" textAnchor="middle">
                  ROTUNDA
                </text>
                <text x={worldToMap(0, 18).mx} y={worldToMap(0, 18).my} fill="#94a3b8" textAnchor="middle">
                  FOYER
                </text>
              </g>
            )}

            {/* NFT Exhibit Markers */}
            {exhibits.map((ex) => {
              const pos = worldToMap(ex.position[0], ex.position[2]);
              const isSelected = activeExhibit?.id === ex.id;
              const isHovered = hoveredExhibit?.id === ex.id;
              const isVaultItem = ex.room === 'vault';

              return (
                <g
                  key={ex.id}
                  className="cursor-pointer transition-transform"
                  onClick={(e) => handleExhibitMarkerClick(ex, e)}
                  onMouseEnter={() => setHoveredExhibit(ex)}
                  onMouseLeave={() => setHoveredExhibit(null)}
                >
                  {/* Selection / Hover Glow Ring */}
                  {(isSelected || isHovered) && (
                    <circle
                      cx={pos.mx}
                      cy={pos.my}
                      r="9"
                      fill="none"
                      stroke={ex.accentColor || '#f59e0b'}
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                      className="animate-spin-slow origin-center"
                    />
                  )}

                  {/* Marker Pedestal Dot */}
                  <circle
                    cx={pos.mx}
                    cy={pos.my}
                    r={isSelected ? '5.5' : isHovered ? '5' : '4'}
                    fill={ex.accentColor || '#38bdf8'}
                    stroke="#020617"
                    strokeWidth="1.2"
                  />

                  {/* Central Center Accent Core */}
                  <circle cx={pos.mx} cy={pos.my} r="1.5" fill="#ffffff" />

                  {/* Lock badge for VIP Vault exhibit */}
                  {isVaultItem && !vaultUnlocked && (
                    <circle cx={pos.mx + 4} cy={pos.my - 4} r="2.2" fill="#ef4444" stroke="#000" strokeWidth="0.5" />
                  )}
                </g>
              );
            })}

            {/* User / Player Location Indicator & Radar Vision Cone */}
            <g
              transform={`translate(${playerMap.mx}, ${playerMap.my})`}
              className="pointer-events-none"
            >
              {/* Radar Vision Cone (Field-of-View beam) */}
              {/* When playerDeg = 0 (yaw = 0), looking at -Z (North/Up). */}
              <g transform={`rotate(${playerDeg})`}>
                {/* 60-degree vision cone spanning radius ~26px */}
                <path
                  d="M 0 0 L -14 -28 A 32 32 0 0 1 14 -28 Z"
                  fill="url(#visionConeGrad)"
                  stroke="rgba(245, 158, 11, 0.4)"
                  strokeWidth="0.8"
                />

                {/* Central line of sight */}
                <line x1="0" y1="0" x2="0" y2="-28" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="0.8" strokeDasharray="2,2" />
              </g>

              {/* Pulsing Beacon Wave */}
              <circle cx="0" cy="0" r="8" fill="none" stroke="#f59e0b" strokeWidth="1" className="opacity-75">
                <animate attributeName="r" values="3;12;3" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0;0.8" dur="2.4s" repeatCount="indefinite" />
              </circle>

              {/* Player Center Pin */}
              <circle cx="0" cy="0" r="3.8" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.2" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
            </g>

            {/* Compass Cardinal Indicators in Corners */}
            <g className="text-[7px] font-mono font-bold fill-slate-500 pointer-events-none select-none">
              <text x={VIEWBOX_SIZE / 2} y="11" textAnchor="middle">
                N
              </text>
              <text x={VIEWBOX_SIZE - 7} y={VIEWBOX_SIZE / 2 + 2.5} textAnchor="end">
                E
              </text>
              <text x={VIEWBOX_SIZE / 2} y={VIEWBOX_SIZE - 4} textAnchor="middle">
                S
              </text>
              <text x="7" y={VIEWBOX_SIZE / 2 + 2.5} textAnchor="start">
                W
              </text>
            </g>
          </svg>

          {/* Interactive Tooltip for hovered exhibit */}
          {hoveredExhibit && (
            <div className="absolute top-2 left-2 right-2 pointer-events-none z-30 px-2.5 py-1.5 rounded-xl bg-slate-950/95 border border-amber-500/40 shadow-xl backdrop-blur-md text-left flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-mono text-amber-300 font-bold truncate">
                  {hoveredExhibit.title}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {hoveredExhibit.rarity} • {hoveredExhibit.currentBid} ETH
                </span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono shrink-0">
                Click to inspect
              </span>
            </div>
          )}

          {/* Hover Crosshair Coordinates Display */}
          {mouseMapCoords && !hoveredExhibit && (
            <div className="absolute bottom-2 left-2 pointer-events-none z-20 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-[9px] font-mono text-slate-300">
              Target: X {mouseMapCoords.x} | Z {mouseMapCoords.z} • Click to walk
            </div>
          )}
        </div>

        {/* Telemetry & Quick Action Footer */}
        <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex flex-col gap-2">
          {/* Status Row */}
          <div className="flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-3 h-3 text-amber-400" />
              <span className="font-semibold text-white">{getRoomTitle(player.room)}</span>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <span>{getCompassHeading(playerDeg)}</span>
            </div>
          </div>

          {/* Coordinate Telemetry & Navigation Mode */}
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 px-1 py-1 rounded bg-slate-950/60 border border-slate-800">
            <span>
              POS: X <strong className="text-amber-300 font-medium">{player.x.toFixed(1)}</strong> Z{' '}
              <strong className="text-amber-300 font-medium">{player.z.toFixed(1)}</strong>
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              {navMode === 'WALK' ? (
                <>
                  <Footprints className="w-2.5 h-2.5 text-emerald-400" />
                  <span>WASD WALK</span>
                </>
              ) : (
                <>
                  <Eye className="w-2.5 h-2.5 text-sky-400" />
                  <span>ORBIT VIEW</span>
                </>
              )}
            </span>
          </div>

          {/* Quick Room Teleport Shortcuts */}
          <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
            <button
              onClick={(e) => handleRoomJump('rotunda', e)}
              className={`px-1.5 py-1 rounded-lg border text-center transition-colors ${
                player.room === 'rotunda'
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              Rotunda
            </button>
            <button
              onClick={(e) => handleRoomJump('renaissance', e)}
              className={`px-1.5 py-1 rounded-lg border text-center transition-colors ${
                player.room === 'renaissance'
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              West
            </button>
            <button
              onClick={(e) => handleRoomJump('cyberpunk', e)}
              className={`px-1.5 py-1 rounded-lg border text-center transition-colors ${
                player.room === 'cyberpunk'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              East
            </button>
            <button
              onClick={(e) => handleRoomJump('vault', e)}
              className={`px-1.5 py-1 rounded-lg border flex items-center justify-center gap-0.5 transition-colors ${
                player.room === 'vault'
                  ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
              title={vaultUnlocked ? 'VIP Vault Unlocked' : 'Requires Patron Museum Pass'}
            >
              {vaultUnlocked ? (
                <Unlock className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Lock className="w-2.5 h-2.5 text-rose-400" />
              )}
              <span>Vault</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
