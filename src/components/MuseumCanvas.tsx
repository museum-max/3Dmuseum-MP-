import React, { useEffect, useRef } from 'react';
import { MuseumScene } from '../three/MuseumScene';
import { ExhibitData, NavigationMode } from '../types';

interface MuseumCanvasProps {
  onSelectExhibit: (exhibit: ExhibitData | null) => void;
  onHoverExhibit: (exhibit: ExhibitData | null) => void;
  onVaultDoorTrigger?: () => void;
  onNearbyExhibit?: (exhibit: ExhibitData | null) => void;
  onModeChange?: (mode: NavigationMode) => void;
  vaultUnlocked: boolean;
  sceneRef: React.MutableRefObject<MuseumScene | null>;
}

export const MuseumCanvas: React.FC<MuseumCanvasProps> = ({
  onSelectExhibit,
  onHoverExhibit,
  onVaultDoorTrigger,
  onNearbyExhibit,
  onModeChange,
  vaultUnlocked,
  sceneRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const sceneInstance = new MuseumScene(mountRef.current, {
      onSelectExhibit,
      onHoverExhibit,
      onVaultDoorTrigger,
      onNearbyExhibit,
      onModeChange,
    });

    sceneRef.current = sceneInstance;

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

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full overflow-hidden select-none bg-slate-950"
      style={{ touchAction: 'none' }}
    />
  );
};
