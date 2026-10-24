import React, { useState, useEffect, useRef } from 'react';
import { MuseumCanvas } from './components/MuseumCanvas';
import { TopBar } from './components/TopBar';
import { BottomDock } from './components/BottomDock';
import { ExhibitModal } from './components/ExhibitModal';
import { MuseumPassModal } from './components/MuseumPassModal';
import { ImportNftModal } from './components/ImportNftModal';
import { GuestbookModal } from './components/GuestbookModal';
import { TransactionLedgerModal } from './components/TransactionLedgerModal';
import { MuseumScene } from './three/MuseumScene';
import {
  ExhibitData,
  WalletState,
  MuseumPass,
  VisitorLogEntry,
  ChainTransaction,
  ContractDeployment,
} from './types';
import { SUPPORTED_NETWORKS } from './contracts/MuseumPassContract';
import {
  subscribeToMuseumPasses,
  subscribeToExhibits,
  subscribeToDeployments,
  subscribeToGuestbook,
  subscribeToTransactions,
  seedInitialExhibitIfMissing,
} from './firebase/service';
import { sound } from './audio/soundEffects';

const INITIAL_EXHIBITS: ExhibitData[] = [
  {
    id: 'nft-1',
    title: 'Genesis Monolith // #001',
    artist: 'Satoshi Algorists',
    creatorAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
    ownerAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
    contractAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
    tokenId: '1',
    description: 'A mathematical singularity encoded into autonomous recursive geometry. The primary genesis artifact of the museum.',
    rarity: 'Mythic',
    edition: '1 of 1',
    tags: ['Generative', 'Sacred Math', 'On-Chain'],
    currentBid: 2.45,
    bidsCount: 14,
    likesCount: 128,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    room: 'rotunda',
    accentColor: '#38bdf8',
  },
  {
    id: 'nft-2',
    title: 'Cybernetic Seraphim // #002',
    artist: 'Aiko Neuromancer',
    creatorAddress: '0x3cE47E648B47833e8aA6fa840Eb901B6305a4130',
    ownerAddress: '0x3cE47E648B47833e8aA6fa840Eb901B6305a4130',
    contractAddress: '0x3cE47E648B47833e8aA6fa840Eb901B6305a4130',
    tokenId: '2',
    description: 'Biomechanical celestial synthesis forged with liquid platinum, gold logic traces, and synaptic ether wings.',
    rarity: 'Legendary',
    edition: '1 of 3',
    tags: ['Cyberpunk', 'Sculptural', 'PBR'],
    currentBid: 1.85,
    bidsCount: 9,
    likesCount: 96,
    position: [-6.5, 0, -3.5],
    rotation: [0, Math.PI / 6, 0],
    room: 'renaissance',
    accentColor: '#facc15',
  },
  {
    id: 'nft-3',
    title: 'Ethereal Nebula // #042',
    artist: 'Celeste Nova',
    creatorAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
    ownerAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
    contractAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
    tokenId: '42',
    description: 'Deep cosmic accretion cloud captured during interstellar spectroscopic mapping. Radiates vibrant magenta pulses.',
    rarity: 'Legendary',
    edition: '1 of 5',
    tags: ['Cosmic', 'Nebula', 'Astral'],
    currentBid: 1.20,
    bidsCount: 6,
    likesCount: 82,
    position: [6.5, 0, -3.5],
    rotation: [0, -Math.PI / 6, 0],
    room: 'cyberpunk',
    accentColor: '#e879f9',
  },
  {
    id: 'nft-4',
    title: 'Quantum Chronos // #004',
    artist: 'Vane Chronometry',
    creatorAddress: '0x19F301fD0A23Eb555A2F25a0bA0a3493E46FeE8D',
    ownerAddress: '0x19F301fD0A23Eb555A2F25a0bA0a3493E46FeE8D',
    contractAddress: '0x19F301fD0A23Eb555A2F25a0bA0a3493E46FeE8D',
    tokenId: '4',
    description: 'A multi-axis mechanical chronometer computing entropy across parallel timeline branches in real-time.',
    rarity: 'Rare',
    edition: '1 of 10',
    tags: ['Kinetic', 'Horology', '3D Motion'],
    currentBid: 0.85,
    bidsCount: 11,
    likesCount: 64,
    position: [-6.5, 0, 3.5],
    rotation: [0, Math.PI / 3, 0],
    room: 'renaissance',
    accentColor: '#38bdf8',
  },
  {
    id: 'nft-5',
    title: 'Sacred Tessellation // #005',
    artist: 'Al-Kindi Fractal Lab',
    creatorAddress: '0x52E9918a280F013459c03bBc91A206a4bB532bF3',
    ownerAddress: '0x52E9918a280F013459c03bBc91A206a4bB532bF3',
    contractAddress: '0x52E9918a280F013459c03bBc91A206a4bB532bF3',
    tokenId: '5',
    description: 'Harmonic emerald and 24K gold geometric manifold vibrating at theta wave frequencies.',
    rarity: 'Rare',
    edition: '1 of 7',
    tags: ['Islamic Art', 'Fractal', 'Golden Ratio'],
    currentBid: 0.95,
    bidsCount: 8,
    likesCount: 71,
    position: [6.5, 0, 3.5],
    rotation: [0, -Math.PI / 3, 0],
    room: 'cyberpunk',
    accentColor: '#34d399',
  },
  {
    id: 'nft-6',
    title: 'The Obsidian Relic // #006',
    artist: 'Master Archon',
    creatorAddress: '0x00000000000000000000000000000000000VAULT',
    ownerAddress: '0x00000000000000000000000000000000000VAULT',
    contractAddress: '0x00000000000000000000000000000000000VAULT',
    tokenId: '6',
    description: 'The sealed crown jewel housed within the Obsidian VIP Vault. Accessible exclusively to Patron and Curator Museum Pass holders.',
    rarity: 'Mythic',
    edition: '1 of 1 Unique',
    tags: ['VIP Vault', 'Masterpiece', 'Pass Gated'],
    currentBid: 5.50,
    bidsCount: 22,
    likesCount: 215,
    requiresTier: 'PATRON',
    position: [0, 0, -19.5],
    rotation: [0, 0, 0],
    room: 'vault',
    accentColor: '#c084fc',
  },
];

export default function App() {
  const sceneRef = useRef<MuseumScene | null>(null);

  // Active state
  const [exhibits, setExhibits] = useState<ExhibitData[]>(INITIAL_EXHIBITS);
  const [activeExhibit, setActiveExhibit] = useState<ExhibitData | null>(null);
  const [hoveredExhibit, setHoveredExhibit] = useState<ExhibitData | null>(null);

  // Modals
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passModalTab, setPassModalTab] = useState<'mint' | 'transfer' | 'deploy' | 'contract'>('mint');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [guestbookOpen, setGuestbookOpen] = useState(false);
  const [transactionsOpen, setTransactionsOpen] = useState(false);

  // Firestore-synced data
  const [guestbookEntries, setGuestbookEntries] = useState<VisitorLogEntry[]>([]);
  const [chainTransactions, setChainTransactions] = useState<ChainTransaction[]>([]);
  const [deployments, setDeployments] = useState<ContractDeployment[]>([]);

  // Web3 Wallet & Pass State
  const [wallet, setWallet] = useState<WalletState>({
    connected: true,
    address: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
    balanceETH: 1.50,
    balanceMP: 0,
    activePass: null,
    ownedPasses: [],
    network: SUPPORTED_NETWORKS[0],
    isSimulated: true,
  });

  const vaultUnlocked =
    wallet.activePass?.tier === 'PATRON' || wallet.activePass?.tier === 'CURATOR';

  useEffect(() => {
    // 1. Initial exhibit seeds
    INITIAL_EXHIBITS.forEach((ex) => {
      seedInitialExhibitIfMissing(ex).catch(() => {});
    });

    // 2. Listen to Exhibits updates (metadata, likes, bids)
    const unsubExhibits = subscribeToExhibits((map) => {
      setExhibits((prev) => {
        const next = prev.map((item) => {
          if (map[item.id]) {
            return {
              ...item,
              ...map[item.id],
              position: item.position,
              rotation: item.rotation,
            };
          }
          return item;
        });

        if (sceneRef.current) {
          sceneRef.current.updateExhibits(next);
        }
        return next;
      });
    });

    // 3. Listen to Museum Passes
    const unsubPasses = subscribeToMuseumPasses((passes) => {
      const userOwned = passes.filter(
        (p) => p.ownerAddress.toLowerCase() === wallet.address.toLowerCase()
      );
      setWallet((prev) => ({
        ...prev,
        ownedPasses: userOwned,
        activePass: userOwned[0] || null,
        balanceMP: userOwned.length,
      }));
    });

    // 4. Listen to Contract Deployments
    const unsubDeployments = subscribeToDeployments((items) => {
      setDeployments(items);
    });

    // 5. Listen to Guestbook
    const unsubGuestbook = subscribeToGuestbook((entries) => {
      setGuestbookEntries(entries);
    });

    // 6. Listen to Transactions
    const unsubTx = subscribeToTransactions((txs) => {
      setChainTransactions(txs);
    });

    return () => {
      unsubExhibits();
      unsubPasses();
      unsubDeployments();
      unsubGuestbook();
      unsubTx();
    };
  }, [wallet.address]);

  // Sync 3D ownership whenever wallet or exhibits change
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateOwnershipState(wallet.address);
    }
  }, [wallet.address, exhibits]);

  const handleConnectWallet = async () => {
    sound.playClick();
    if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum) {
      try {
        const eth = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
        const accounts = await eth.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          setWallet((prev) => ({
            ...prev,
            address: accounts[0],
            isSimulated: false,
          }));
        }
      } catch (err) {
        console.debug('MetaMask fallback:', err);
      }
    } else {
      const mockAccounts = [
        '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
        '0x3cE47E648B47833e8aA6fa840Eb901B6305a4130',
        '0x8A72F67c132899479b12d5d852c00a0E341B442A',
      ];
      const nextIdx = (mockAccounts.indexOf(wallet.address) + 1) % mockAccounts.length;
      setWallet((prev) => ({
        ...prev,
        address: mockAccounts[nextIdx],
        activePass: null,
        ownedPasses: [],
      }));
    }
  };

  const handleSelectExhibit = (ex: ExhibitData | null) => {
    setActiveExhibit(ex);
  };

  const handleHoverExhibit = (ex: ExhibitData | null) => {
    setHoveredExhibit(ex);
  };

  const handleJumpRoom = (room: 'rotunda' | 'renaissance' | 'cyberpunk' | 'vault') => {
    if (sceneRef.current) {
      sceneRef.current.jumpToRoom(room);
    }
  };

  const handleResetView = () => {
    if (sceneRef.current) {
      sceneRef.current.resetView();
    }
    setActiveExhibit(null);
  };

  const handleVaultDoorTrigger = () => {
    if (!vaultUnlocked) {
      setPassModalTab('mint');
      setPassModalOpen(true);
    }
  };

  const currentActiveExhibitData = activeExhibit
    ? exhibits.find((e) => e.id === activeExhibit.id) || activeExhibit
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Layer */}
      <MuseumCanvas
        onSelectExhibit={handleSelectExhibit}
        onHoverExhibit={handleHoverExhibit}
        onVaultDoorTrigger={handleVaultDoorTrigger}
        vaultUnlocked={vaultUnlocked}
        sceneRef={sceneRef}
      />

      {/* Top Header Layer */}
      <TopBar
        wallet={wallet}
        onOpenPassModal={(tab) => {
          setPassModalTab(tab || 'mint');
          setPassModalOpen(true);
        }}
        onOpenImportModal={() => setImportModalOpen(true)}
        onOpenGuestbook={() => setGuestbookOpen(true)}
        onOpenTransactions={() => setTransactionsOpen(true)}
        onConnectWallet={handleConnectWallet}
      />

      {/* Collapsible Viewport-First Bottom Dock */}
      <BottomDock
        onJumpRoom={handleJumpRoom}
        onResetView={handleResetView}
        onOpenPassModal={() => {
          setPassModalTab('mint');
          setPassModalOpen(true);
        }}
        onOpenImportModal={() => setImportModalOpen(true)}
        activeExhibit={currentActiveExhibitData}
        hoveredExhibit={hoveredExhibit}
        vaultUnlocked={vaultUnlocked}
      />

      {/* Exhibit Inspection & Owner Transfer Modal */}
      <ExhibitModal
        exhibit={currentActiveExhibitData}
        onClose={() => setActiveExhibit(null)}
        wallet={wallet}
        onOpenPassModal={() => {
          setActiveExhibit(null);
          setPassModalTab('mint');
          setPassModalOpen(true);
        }}
        onOpenImportModal={() => {
          setActiveExhibit(null);
          setImportModalOpen(true);
        }}
      />

      {/* Museum Pass (MP) Smart Contract Terminal Modal */}
      <MuseumPassModal
        isOpen={passModalOpen}
        onClose={() => setPassModalOpen(false)}
        wallet={wallet}
        onUpdateWallet={setWallet}
        initialTab={passModalTab}
        deployments={deployments}
      />

      {/* Curate & Display NFT Modal */}
      <ImportNftModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        exhibits={exhibits}
        connectedAddress={wallet.address}
      />

      {/* Guestbook Modal */}
      <GuestbookModal
        isOpen={guestbookOpen}
        onClose={() => setGuestbookOpen(false)}
        entries={guestbookEntries}
        wallet={wallet}
        onOpenPassModal={() => {
          setGuestbookOpen(false);
          setPassModalTab('mint');
          setPassModalOpen(true);
        }}
      />

      {/* On-Chain Transaction Stream Modal */}
      <TransactionLedgerModal
        isOpen={transactionsOpen}
        onClose={() => setTransactionsOpen(false)}
        transactions={chainTransactions}
        wallet={wallet}
      />
    </div>
  );
}
