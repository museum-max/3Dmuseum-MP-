import * as THREE from 'three';

/**
 * Procedural CanvasTexture generator for NFT artworks and architectural finishes.
 * Adheres strictly to Zero-External-Asset rule (No 404s, fully algorithmic).
 */

export function createMarbleFloorTexture(maxAnisotropy: number = 8): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base marble ivory/pearl white
  const baseGrad = ctx.createLinearGradient(0, 0, size, size);
  baseGrad.addColorStop(0, '#f8fafc');
  baseGrad.addColorStop(0.5, '#f1f5f9');
  baseGrad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Marble veining (soft grey & gold streaks)
  ctx.save();
  ctx.filter = 'blur(6px)';
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    let x = (i * 65) % size;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < size) {
      x += (Math.random() - 0.5) * 50;
      y += 20 + Math.random() * 40;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(100, 116, 139, 0.08)';
    ctx.lineWidth = 4 + Math.random() * 8;
    ctx.stroke();
  }
  ctx.restore();

  // Polished tile geometric brass border
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, size - 48, size - 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const radGrad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  radGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  radGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.35)');
  radGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.08)');
  radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function createPedestalBumpTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Brushed micro-scratches
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y + (Math.random() - 0.5) * 2);
    ctx.lineTo(size, y + (Math.random() - 0.5) * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  return texture;
}

export function createProceduralNftCanvas(id: string, maxAnisotropy: number = 8): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (id === 'nft-1') {
    // Genesis Monolith: Generative Neon Sacred Code
    const bg = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 1.4);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(0.5, '#0f172a');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Glowing concentric polygons
    const cx = size / 2;
    const cy = size / 2;
    for (let r = 80; r < 440; r += 32) {
      ctx.beginPath();
      const sides = 6 + (r % 4);
      for (let s = 0; s <= sides; s++) {
        const angle = (s / sides) * Math.PI * 2 + (r * 0.01);
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = r % 64 === 0 ? '#38bdf8' : '#818cf8';
      ctx.lineWidth = r % 64 === 0 ? 3 : 1.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.stroke();
    }

    // Core holographic cube
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.fillRect(-90, -90, 180, 180);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(-90, -90, 180, 180);
    ctx.restore();

    // Runic typography watermark
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#67e8f9';
    ctx.shadowBlur = 20;
    ctx.fillText('GENESIS MONOLITH // #001', 80, size - 80);
  } else if (id === 'nft-2') {
    // Cybernetic Seraphim: Chrome Wings & Gold Circuits
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#09090b');
    bg.addColorStop(0.5, '#18181b');
    bg.addColorStop(1, '#09090b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Gold circuit traces
    ctx.strokeStyle = '#eab308';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      let cx = 100 + i * 36;
      let cy = size / 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 40, cy - 120);
      ctx.lineTo(cx + 120, cy - 120);
      ctx.lineTo(cx + 160, cy - 240);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx + 160, cy - 240, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.fill();
    }

    // Cyber Wings
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2 + 100);
    ctx.bezierCurveTo(size / 2 - 350, size / 2 - 200, size / 2 - 200, size / 2 - 400, size / 2, size / 2 - 150);
    ctx.bezierCurveTo(size / 2 + 200, size / 2 - 400, size / 2 + 350, size / 2 - 200, size / 2, size / 2 + 100);
    ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#fef08a';
    ctx.fillText('CYBERNETIC SERAPHIM // #002', 80, size - 80);
  } else if (id === 'nft-3') {
    // Ethereal Nebula #042
    const bg = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size);
    bg.addColorStop(0, '#701a75');
    bg.addColorStop(0.4, '#4a044e');
    bg.addColorStop(0.8, '#030712');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Nebula dust particles
    for (let i = 0; i < 400; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const pr = Math.random() * 3 + 0.5;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = i % 4 === 0 ? '#f472b6' : (i % 2 === 0 ? '#c084fc' : '#ffffff');
      ctx.shadowColor = '#e879f9';
      ctx.shadowBlur = Math.random() * 8;
      ctx.fill();
    }

    // Golden accretion disk
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, 380, 120, Math.PI / 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 18;
    ctx.stroke();

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#f472b6';
    ctx.fillText('ETHEREAL NEBULA // #042', 80, size - 80);
  } else if (id === 'nft-4') {
    // Quantum Chronos: Mechanical Astrolabe
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;

    // Astrolabe rings
    for (let r = 100; r < 420; r += 50) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Degree tick marks
      const ticks = 36;
      for (let t = 0; t < ticks; t++) {
        const angle = (t / ticks) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * (r - 6);
        const y1 = cy + Math.sin(angle) * (r - 6);
        const x2 = cx + Math.cos(angle) * (r + 6);
        const y2 = cy + Math.sin(angle) * (r + 6);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Center Golden Sun
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 30;
    ctx.fill();

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('QUANTUM CHRONOS // #004', 80, size - 80);
  } else if (id === 'nft-5') {
    // Sacred Tessellation: Emerald & Gold Islamic Geometric fractal
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;

    for (let step = 0; step < 8; step++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((step * Math.PI) / 4);

      ctx.beginPath();
      ctx.rect(-160, -160, 320, 320);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, 260, 90, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText('SACRED TESSELLATION // #005', 80, size - 80);
  } else {
    // NFT #6: The Obsidian Diamond (VIP Vault Artifact)
    const bg = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 1.2);
    bg.addColorStop(0, '#2e1065');
    bg.addColorStop(0.6, '#0f0728');
    bg.addColorStop(1, '#000000');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Prismatic Diamond Ray facets
    const cx = size / 2;
    const cy = size / 2;
    const facets = [
      [-120, -180, 0, -320, 120, -180],
      [-120, -180, -260, 0, -140, 200],
      [120, -180, 260, 0, 140, 200],
      [-140, 200, 0, 320, 140, 200],
      [-120, -180, 0, 0, 120, -180],
      [0, 0, -140, 200, 140, 200]
    ];

    facets.forEach((f, idx) => {
      ctx.beginPath();
      ctx.moveTo(cx + f[0], cy + f[1]);
      ctx.lineTo(cx + f[2], cy + f[3]);
      ctx.lineTo(cx + f[4], cy + f[5]);
      ctx.closePath();
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(168, 85, 247, 0.45)' : 'rgba(236, 72, 153, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 15;
      ctx.stroke();
    });

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#e9d5ff';
    ctx.fillText('VIP OBSIDIAN RELIC // #006', 80, size - 80);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}
