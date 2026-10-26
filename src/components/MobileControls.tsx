import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Zap,
  Eye,
  Footprints,
  Sparkles,
  Compass,
  RotateCcw,
  Check,
  ChevronRight,
} from 'lucide-react';
import { ExhibitData, NavigationMode } from '../types';
import { MuseumScene } from '../three/MuseumScene';
import { sound } from '../audio/soundEffects';

interface MobileControlsProps {
  sceneRef: React.MutableRefObject<MuseumScene | null>;
  navMode: NavigationMode;
  onToggleNavMode: (mode: NavigationMode) => void;
  nearbyExhibit: ExhibitData | null;
  onSelectExhibit: (exhibit: ExhibitData | null) => void;
  onJumpRoom: (room: 'rotunda' | 'renaissance' | 'cyberpunk' | 'vault') => void;
  onResetView: () => void;
  vaultUnlocked: boolean;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  sceneRef,
  navMode,
  onToggleNavMode,
  nearbyExhibit,
  onSelectExhibit,
  onJumpRoom,
  onResetView,
  vaultUnlocked,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);
  const [isSprint, setIsSprint] = useState(false);
  const joystickPointerId = useRef<number | null>(null);

  // Quick Room Jump Drawer
  const [showRoomPicker, setShowRoomPicker] = useState(false);

  // Send joystick vector to 3D scene
  const updateJoystickVector = useCallback(
    (dx: number, dy: number, sprintActive: boolean) => {
      if (sceneRef.current) {
        sceneRef.current.setVirtualJoystick({ x: dx, y: dy }, sprintActive);
      }
    },
    [sceneRef]
  );

  const handleJoystickStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    joystickPointerId.current = e.pointerId;
    setIsDraggingJoystick(true);

    if (joystickBaseRef.current) {
      joystickBaseRef.current.setPointerCapture(e.pointerId);
      calcKnob(e.clientX, e.clientY);
    }
  };

  const calcKnob = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const maxRadius = rect.width / 2 - 10;
    const distance = Math.hypot(rawDx, rawDy);

    let clampedX = rawDx;
    let clampedY = rawDy;

    if (distance > maxRadius) {
      clampedX = (rawDx / distance) * maxRadius;
      clampedY = (rawDy / distance) * maxRadius;
    }

    setKnobPos({ x: clampedX, y: clampedY });

    // Normalized vector (-1 to 1)
    const normX = clampedX / maxRadius;
    const normY = clampedY / maxRadius; // Note: -1 is forward (up)

    updateJoystickVector(normX, normY, isSprint);
  };

  const handleJoystickMove = (e: React.PointerEvent) => {
    if (isDraggingJoystick && e.pointerId === joystickPointerId.current) {
      e.stopPropagation();
      calcKnob(e.clientX, e.clientY);
    }
  };

  const handleJoystickEnd = (e: React.PointerEvent) => {
    if (e.pointerId === joystickPointerId.current) {
      e.stopPropagation();
      if (joystickBaseRef.current && joystickBaseRef.current.hasPointerCapture(e.pointerId)) {
        try {
          joystickBaseRef.current.releasePointerCapture(e.pointerId);
        } catch {
          // ignore if already released
        }
      }
      setIsDraggingJoystick(false);
      joystickPointerId.current = null;
      setKnobPos({ x: 0, y: 0 });
      updateJoystickVector(0, 0, false);
    }
  };

  const toggleSprint = () => {
    sound.playClick();
    setIsSprint((prev) => {
      const next = !prev;
      // Re-trigger joystick vector with new sprint flag
      if (sceneRef.current && (knobPos.x !== 0 || knobPos.y !== 0)) {
        const rect = joystickBaseRef.current?.getBoundingClientRect();
        const maxRadius = rect ? rect.width / 2 - 10 : 40;
        updateJoystickVector(knobPos.x / maxRadius, knobPos.y / maxRadius, next);
      }
      return next;
    });
  };

  // Clean up joystick on unmount
  useEffect(() => {
    return () => {
      if (sceneRef.current) {
        sceneRef.current.setVirtualJoystick({ x: 0, y: 0 }, false);
      }
    };
  }, [sceneRef]);

  return (
    <div className="fixed inset-0 pointer-events-none z-20 sm:hidden select-none">
      {/* Dynamic Proximity Action Button (Upper/Mid Right) */}
      {nearbyExhibit && (
        <div className="absolute bottom-36 right-4 pointer-events-auto animate-bounce">
          <button
            onClick={() => {
              sound.playInspect();
              onSelectExhibit(nearbyExhibit);
            }}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-2xl shadow-amber-500/50 border border-amber-300 ring-4 ring-amber-400/20 active:scale-95 transition-transform"
          >
            <Sparkles className="w-4 h-4 text-slate-950 animate-spin" style={{ animationDuration: '4s' }} />
            <div className="flex flex-col text-left">
              <span className="text-[10px] opacity-75 font-mono">TAP TO INSPECT</span>
              <span className="truncate max-w-[140px] font-bold">{nearbyExhibit.title}</span>
            </div>
          </button>
        </div>
      )}

      {/* Floating Analog Joystick on Bottom Left (Only in WALK mode) */}
      {navMode === 'WALK' && (
        <div className="absolute bottom-20 left-4 pointer-events-auto flex flex-col items-center gap-2">
          {/* Sprint Toggle Pill */}
          <button
            onClick={toggleSprint}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold border transition-all ${
              isSprint
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/40'
                : 'bg-slate-900/85 text-slate-300 border-slate-700/80 active:bg-slate-800'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isSprint ? 'text-slate-950 fill-slate-950' : 'text-amber-400'}`} />
            <span>{isSprint ? 'SPRINT ON' : 'SPRINT'}</span>
          </button>

          {/* 360-degree Touch Joystick Base */}
          <div
            ref={joystickBaseRef}
            onPointerDown={handleJoystickStart}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickEnd}
            onPointerCancel={handleJoystickEnd}
            className="relative w-28 h-28 rounded-full bg-slate-950/80 backdrop-blur-md border-2 border-slate-700/80 flex items-center justify-center shadow-2xl shadow-black/80 touch-none active:border-amber-500/60"
            style={{ touchAction: 'none' }}
          >
            {/* Directional Guides */}
            <div className="absolute top-1.5 w-1 h-2 bg-slate-600 rounded-full" />
            <div className="absolute bottom-1.5 w-1 h-2 bg-slate-600 rounded-full" />
            <div className="absolute left-1.5 h-1 w-2 bg-slate-600 rounded-full" />
            <div className="absolute right-1.5 h-1 w-2 bg-slate-600 rounded-full" />

            {/* Analog Knob */}
            <div
              className={`w-12 h-12 rounded-full border flex items-center justify-center transition-shadow ${
                isDraggingJoystick
                  ? 'bg-amber-400 border-white shadow-[0_0_15px_rgba(251,191,36,0.8)] scale-105'
                  : 'bg-slate-800/90 border-slate-600 shadow-md'
              }`}
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                transition: isDraggingJoystick ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  isDraggingJoystick ? 'bg-slate-950' : 'bg-amber-400/80'
                }`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Mode Toggle & Room Jump Shortcuts on Bottom Right */}
      <div className="absolute bottom-20 right-4 pointer-events-auto flex flex-col items-end gap-2">
        {/* Room Picker Drawer */}
        {showRoomPicker && (
          <div className="p-2 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-slate-700/80 shadow-2xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <span className="text-[10px] font-mono uppercase text-amber-400 px-2 pt-1 font-bold">
              Teleport to Wing:
            </span>
            <button
              onClick={() => {
                onJumpRoom('rotunda');
                setShowRoomPicker(false);
              }}
              className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl text-xs text-slate-200 hover:bg-slate-800 active:bg-amber-500/20 text-left font-medium"
            >
              <span>Rotunda</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button
              onClick={() => {
                onJumpRoom('renaissance');
                setShowRoomPicker(false);
              }}
              className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl text-xs text-slate-200 hover:bg-slate-800 active:bg-amber-500/20 text-left font-medium"
            >
              <span>Renaissance</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button
              onClick={() => {
                onJumpRoom('cyberpunk');
                setShowRoomPicker(false);
              }}
              className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl text-xs text-slate-200 hover:bg-slate-800 active:bg-amber-500/20 text-left font-medium"
            >
              <span>Cyberpunk</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button
              onClick={() => {
                onJumpRoom('vault');
                setShowRoomPicker(false);
              }}
              className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl text-xs text-slate-200 hover:bg-slate-800 active:bg-purple-900/30 text-left font-medium"
            >
              <span className={vaultUnlocked ? 'text-emerald-400' : 'text-purple-300'}>VIP Vault</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-700/80 shadow-xl">
          {/* Quick Rooms Button */}
          <button
            onClick={() => {
              sound.playClick();
              setShowRoomPicker(!showRoomPicker);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 text-amber-300 text-xs font-mono font-medium hover:bg-slate-700 active:bg-amber-500 active:text-slate-950"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Rooms</span>
          </button>

          {/* Nav Mode Switcher */}
          <button
            onClick={() => {
              sound.playClick();
              onToggleNavMode(navMode === 'WALK' ? 'ORBIT' : 'WALK');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              navMode === 'WALK'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-sky-500 text-slate-950 shadow-md'
            }`}
          >
            {navMode === 'WALK' ? (
              <>
                <Footprints className="w-3.5 h-3.5" />
                <span>Walk</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Orbit</span>
              </>
            )}
          </button>

          {/* Reset Camera */}
          <button
            onClick={onResetView}
            title="Reset View"
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white active:bg-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
