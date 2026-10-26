import * as THREE from 'three';

export interface CryptoChainInfo {
  id: string;
  name: string;
  symbol: string;
  color: string;
  accentColor: string;
  category: 'Layer 1' | 'Layer 2' | 'Oracle' | 'Stablecoin' | 'Meme';
  tps: string;
  marketCapRank: number;
  description: string;
}

export const CRYPTO_CHAINS: CryptoChainInfo[] = [
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    color: '#f7931a',
    accentColor: '#ffedd5',
    category: 'Layer 1',
    tps: '7 TPS',
    marketCapRank: 1,
    description: 'Decentralized digital gold & sound money. Integrated into WORLD CORE cross-chain liquidity vaults.',
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    color: '#627eea',
    accentColor: '#c7d2fe',
    category: 'Layer 1',
    tps: '30+ TPS (L1) / 10K+ (Rollups)',
    marketCapRank: 2,
    description: 'The world computer & foundational smart contract standard powering ERC-721/1155 artifacts.',
  },
  {
    id: 'sol',
    name: 'Solana',
    symbol: 'SOL',
    color: '#14f195',
    accentColor: '#9945ff',
    category: 'Layer 1',
    tps: '3,500+ TPS',
    marketCapRank: 3,
    description: 'High-throughput parallelized execution engine synchronized with WORLD CORE state channels.',
  },
  {
    id: 'bnb',
    name: 'BNB Chain',
    symbol: 'BNB',
    color: '#f3ba2c',
    accentColor: '#fef08a',
    category: 'Layer 1',
    tps: '2,000+ TPS',
    marketCapRank: 4,
    description: 'High-speed EVM-compatible ecosystem connecting decentralized exchanges and Web3 game economies.',
  },
  {
    id: 'xrp',
    name: 'XRP Ledger',
    symbol: 'XRP',
    color: '#008ce7',
    accentColor: '#bae6fd',
    category: 'Layer 1',
    tps: '1,500 TPS',
    marketCapRank: 5,
    description: 'Ultra-fast global settlement network powering institutional cross-border liquidity conduits.',
  },
  {
    id: 'doge',
    name: 'Dogecoin',
    symbol: 'DOGE',
    color: '#c2a633',
    accentColor: '#fef9c3',
    category: 'Meme',
    tps: '33 TPS',
    marketCapRank: 6,
    description: 'The pioneering community-driven meme currency bridging social engagement and instant micro-payments.',
  },
  {
    id: 'ada',
    name: 'Cardano',
    symbol: 'ADA',
    color: '#0033ad',
    accentColor: '#93c5fd',
    category: 'Layer 1',
    tps: '250 TPS',
    marketCapRank: 7,
    description: 'Peer-reviewed proof-of-stake blockchain built on formal verification and EUTXO state models.',
  },
  {
    id: 'avax',
    name: 'Avalanche',
    symbol: 'AVAX',
    color: '#e84142',
    accentColor: '#fecaca',
    category: 'Layer 1',
    tps: '4,500 TPS',
    marketCapRank: 8,
    description: 'Subnet architecture with sub-second finality connecting customized institutional application chains.',
  },
  {
    id: 'pol',
    name: 'Polygon',
    symbol: 'POL',
    color: '#8247e5',
    accentColor: '#e9d5ff',
    category: 'Layer 2',
    tps: '7,000+ TPS',
    marketCapRank: 9,
    description: 'Aggregated zero-knowledge Ethereum scaling network unifying fragmented blockchain liquidity.',
  },
  {
    id: 'link',
    name: 'Chainlink',
    symbol: 'LINK',
    color: '#375bd2',
    accentColor: '#bfdbfe',
    category: 'Oracle',
    tps: 'Multi-Chain',
    marketCapRank: 10,
    description: 'Decentralized oracle standard transmitting verifiable off-chain data and CCIP cross-chain messaging.',
  },
  {
    id: 'trx',
    name: 'TRON',
    symbol: 'TRX',
    color: '#ef0027',
    accentColor: '#fca5a5',
    category: 'Layer 1',
    tps: '2,000 TPS',
    marketCapRank: 11,
    description: 'Global decentralized entertainment and digital asset settlement network with high USDT volume.',
  },
  {
    id: 'usdt',
    name: 'Tether USD',
    symbol: 'USDT',
    color: '#26a17b',
    accentColor: '#a7f3d0',
    category: 'Stablecoin',
    tps: 'Universal',
    marketCapRank: 12,
    description: 'Ubiquitous cross-chain digital dollar providing atomic price stability across global crypto markets.',
  },
];

/**
 * Creates a high-fidelity 2D canvas texture for a specific crypto logo.
 */
export function createCryptoLogoTexture(chain: CryptoChainInfo): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.45;

  // Background gradient disc
  const bgGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.2, chain.color);
  bgGrad.addColorStop(1, '#05070e');

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Outer glowing metallic border rim
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = chain.accentColor;
  ctx.stroke();

  // Inner subtle shadow ring
  ctx.beginPath();
  ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.stroke();

  // Draw authentic vector icon depending on crypto symbol
  ctx.save();
  ctx.translate(cx, cy);

  switch (chain.symbol) {
    case 'BTC': {
      // Bitcoin '₿' Symbol
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 125px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₿', 2, 4);
      break;
    }

    case 'ETH': {
      // Ethereum Diamond
      ctx.fillStyle = '#ffffff';
      // Upper diamond pyramid
      ctx.beginPath();
      ctx.moveTo(0, -68);
      ctx.lineTo(44, 4);
      ctx.lineTo(0, 24);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#c7d2fe';
      ctx.beginPath();
      ctx.moveTo(0, -68);
      ctx.lineTo(-44, 4);
      ctx.lineTo(0, 24);
      ctx.closePath();
      ctx.fill();

      // Lower inverted pyramid
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, 36);
      ctx.lineTo(44, 14);
      ctx.lineTo(0, 72);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#c7d2fe';
      ctx.beginPath();
      ctx.moveTo(0, 36);
      ctx.lineTo(-44, 14);
      ctx.lineTo(0, 72);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'SOL': {
      // Solana Three Parallel Angled Gradient Bars
      ctx.lineCap = 'round';
      ctx.lineWidth = 14;
      const barGrad = ctx.createLinearGradient(-45, 0, 45, 0);
      barGrad.addColorStop(0, '#14f195');
      barGrad.addColorStop(1, '#9945ff');
      ctx.strokeStyle = barGrad;

      // Top bar
      ctx.beginPath();
      ctx.moveTo(-42, -36);
      ctx.lineTo(42, -36);
      ctx.stroke();

      // Mid bar
      ctx.beginPath();
      ctx.moveTo(-42, 0);
      ctx.lineTo(42, 0);
      ctx.stroke();

      // Bottom bar
      ctx.beginPath();
      ctx.moveTo(-42, 36);
      ctx.lineTo(42, 36);
      ctx.stroke();
      break;
    }

    case 'BNB': {
      // BNB Four Interlocking Diamonds
      ctx.fillStyle = '#ffffff';

      // Center diamond
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(26, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(-26, 0);
      ctx.closePath();
      ctx.fill();

      // Top chevron
      ctx.beginPath();
      ctx.moveTo(0, -64);
      ctx.lineTo(24, -40);
      ctx.lineTo(0, -32);
      ctx.lineTo(-24, -40);
      ctx.closePath();
      ctx.fill();

      // Bottom chevron
      ctx.beginPath();
      ctx.moveTo(0, 64);
      ctx.lineTo(24, 40);
      ctx.lineTo(0, 32);
      ctx.lineTo(-24, 40);
      ctx.closePath();
      ctx.fill();

      // Left chevron
      ctx.beginPath();
      ctx.moveTo(-64, 0);
      ctx.lineTo(-40, 24);
      ctx.lineTo(-32, 0);
      ctx.lineTo(-40, -24);
      ctx.closePath();
      ctx.fill();

      // Right chevron
      ctx.beginPath();
      ctx.moveTo(64, 0);
      ctx.lineTo(40, 24);
      ctx.lineTo(32, 0);
      ctx.lineTo(40, -24);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'XRP': {
      // XRP Ripple Petals
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(-44, -38);
      ctx.bezierCurveTo(-20, -10, 20, -10, 44, -38);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-44, 38);
      ctx.bezierCurveTo(-20, 10, 20, 10, 44, 38);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'DOGE': {
      // Dogecoin 'Ð'
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 118px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Ð', 2, 4);
      break;
    }

    case 'ADA': {
      // Cardano Radial Dots
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      const numDots = 8;
      for (let i = 0; i < numDots; i++) {
        const ang = (i / numDots) * Math.PI * 2;
        const dx1 = Math.cos(ang) * 38;
        const dy1 = Math.sin(ang) * 38;
        ctx.beginPath();
        ctx.arc(dx1, dy1, 7, 0, Math.PI * 2);
        ctx.fill();

        const dx2 = Math.cos(ang + Math.PI / numDots) * 58;
        const dy2 = Math.sin(ang + Math.PI / numDots) * 58;
        ctx.beginPath();
        ctx.arc(dx2, dy2, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'AVAX': {
      // Avalanche Tri-mountain Chevron
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-48, 44);
      ctx.lineTo(0, -48);
      ctx.lineTo(48, 44);
      ctx.lineTo(26, 44);
      ctx.lineTo(0, -8);
      ctx.lineTo(-26, 44);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 22, 10, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'POL': {
      // Polygon / Matic Geometric Infinity
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-26, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(26, 0, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#8247e5';
      ctx.beginPath();
      ctx.arc(-26, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(26, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'LINK': {
      // Chainlink Hexagon
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#ffffff';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const hx = Math.cos(ang) * 50;
        const hy = Math.sin(ang) * 50;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, -28, 16, 56);
      break;
    }

    case 'TRX': {
      // TRON Angular Diamond
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -60);
      ctx.lineTo(48, 20);
      ctx.lineTo(0, 60);
      ctx.lineTo(-48, 20);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ef0027';
      ctx.beginPath();
      ctx.moveTo(0, -38);
      ctx.lineTo(30, 14);
      ctx.lineTo(0, 42);
      ctx.lineTo(-30, 14);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'USDT': {
      // Tether '₮'
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 125px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₮', 2, 4);
      break;
    }

    default: {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chain.symbol, 0, 0);
      break;
    }
  }

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a glowing billboard text label for the node.
 */
export function createCryptoLabelTexture(symbol: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(10, 15, 29, 0.85)';
  ctx.roundRect(4, 4, 248, 56, 12);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 128, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
