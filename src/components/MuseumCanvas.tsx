import React, { useEffect, useRef, useState } from 'react';
import { MuseumScene } from '../three/MuseumScene';
import { ExhibitData, NavigationMode } from '../types';
import { CryptoChainInfo } from '../three/cryptoLogos';
import { sound } from '../audio/soundEffects';

interface MuseumCanvasProps {
  onSelectExhibit: (exhibit: ExhibitData | null) => void;
  onHoverExhibit: (exhibit: ExhibitData | null) => void;
  onSelectCryptoChain?: (chain: CryptoChainInfo | null) => void;
  onHoverCryptoChain?: (chain: CryptoChainInfo | null) => void;
  onVaultDoorTrigger?: () => void;
  onNearbyExhibit?: (exhibit: ExhibitData | null) => void;
  onModeChange?: (mode: NavigationMode) => void;
  onXrStateChange?: (isPresenting: boolean) => void;
  vaultUnlocked: boolean;
  sceneRef: React.MutableRefObject<MuseumScene | null>;
}

const VrHeadsetIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-2a2 2 0 0 1-1.6-.8l-.8-1.2a1 1 0 0 0-.8-.4h-1.6a1 1 0 0 0-.8.4l-.8 1.2A2 2 0 0 1 7 18H5a4 4 0 0 1-4-4v-4z" />
    <circle cx="8.5" cy="12" r="1.75" />
    <circle cx="15.5" cy="12" r="1.75" />
  </svg>
);

export const MuseumCanvas: React.FC<MuseumCanvasProps> = ({
  onSelectExhibit,
  onHoverExhibit,
  onSelectCryptoChain,
  onHoverCryptoChain,
  onVaultDoorTrigger,
  onNearbyExhibit,
  onModeChange,
  onXrStateChange,
  vaultUnlocked,
  sceneRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [xrSupported, setXrSupported] = useState<boolean>(false);
  const [isXrPresenting, setIsXrPresenting] = useState<boolean>(false);
  const [xrNotice, setXrNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const sceneInstance = new MuseumScene(mountRef.current, {
      onSelectExhibit,
      onHoverExhibit,
      onSelectCryptoChain,
      onHoverCryptoChain,
      onVaultDoorTrigger,
      onNearbyExhibit,
      onModeChange,
      onXrStateChange: (presenting) => {
        setIsXrPresenting(presenting);
        if (onXrStateChange) onXrStateChange(presenting);
      },
    });

    sceneRef.current = sceneInstance;

    // Check WebXR device compatibility
    sceneInstance.isXrSupported().then((supported) => {
      setXrSupported(supported);
    });

    return () => {
      sceneInstance.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setVaultUnlocked(vaultUnlocked);
    }
  }, [vaultUnlocked]);

  const handleToggleXr = async () => {
    sound.playClick();
    if (!sceneRef.current) return;

    if (isXrPresenting) {
      await sceneRef.current.exitXr();
    } else {
      const ok = await sceneRef.current.enterXr();
      if (!ok) {
        sound.playError();
        setXrNotice('Connect an XR headset (Meta Quest, Vision Pro, HTC Vive, or WebXR emulator) to enter VR.');
        setTimeout(() => setXrNotice(null), 5000);
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full overflow-hidden select-none bg-slate-950"
        style={{ touchAction: 'none' }}
      />

      {/* WebXR Virtual Reality Control HUD */}
      <div className="absolute top-16 right-3 sm:right-4 z-20 flex flex-col items-end gap-1.5 pointer-events-none">
        <button
          onClick={handleToggleXr}
          className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all shadow-xl backdrop-blur-md cursor-pointer ${
            isXrPresenting
              ? 'bg-rose-950/90 border-rose-500/70 text-rose-200 shadow-rose-950/50 animate-pulse'
              : xrSupported
              ? 'bg-gradient-to-r from-purple-950/90 to-cyan-950/90 border-cyan-400/60 text-cyan-200 hover:border-cyan-300 hover:text-white shadow-cyan-950/40'
              : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
          title="Experience WORLCORE Museum in Immersive WebXR Virtual Reality"
        >
          <VrHeadsetIcon className={`w-4 h-4 ${isXrPresenting ? 'text-rose-400' : 'text-cyan-400'}`} />
          <span>
            {isXrPresenting
              ? 'EXIT VR'
              : xrSupported
              ? 'ENTER VR'
              : 'WEBXR VR'}
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-mono">
            6DOF
          </span>
        </button>

        {/* Informational WebXR Notice */}
        {xrNotice && (
          <div className="pointer-events-auto max-w-xs px-3 py-2 rounded-xl bg-slate-900/95 border border-amber-500/50 shadow-2xl text-[11px] font-mono text-amber-200 backdrop-blur-md animate-in fade-in slide-in-from-top-1">
            {xrNotice}
          </div>
        )}
      </div>
    </div>
  );
};
