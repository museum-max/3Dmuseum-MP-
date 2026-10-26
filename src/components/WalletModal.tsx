import React, { useState } from 'react';
import {
  Wallet,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Droplet,
  RefreshCw,
  X,
  AlertCircle,
  UserCheck,
  ArrowRight,
} from 'lucide-react';
import { WalletState, TestnetNetwork } from '../types';
import { SUPPORTED_NETWORKS, formatAddress } from '../contracts/MuseumPassContract';
import { sound } from '../audio/soundEffects';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState;
  onUpdateWallet: (updater: (prev: WalletState) => WalletState) => void;
}

interface TestnetPersona {
  id: string;
  name: string;
  role: string;
  address: string;
  defaultBalance: number;
  description: string;
}

const TESTNET_PERSONAS: TestnetPersona[] = [
  {
    id: 'patron',
    name: 'Patron Collector (Genesis VIP)',
    role: 'VIP Patron & Genesis Collector',
    address: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
    defaultBalance: 2.5,
    description: 'Holds VIP Museum Pass and access to the Obsidian Vault.',
  },
  {
    id: 'deployer',
    name: 'Satoshi Algorist (Curator)',
    role: 'Smart Contract Deployer & Curator',
    address: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
    defaultBalance: 5.0,
    description: 'Creator of the Genesis Monolith with full museum administration privileges.',
  },
  {
    id: 'artist',
    name: 'Aiko Neuromancer (Artist)',
    role: 'Resident 3D Cybernetic Sculptor',
    address: '0x3cE47E648B47833e8aA6fa840Eb901B6305a4130',
    defaultBalance: 1.85,
    description: 'Creator of Cybernetic Seraphim in the West Gallery.',
  },
  {
    id: 'horologist',
    name: 'Vane Chronometry',
    role: 'Kinetic Art Horologist',
    address: '0x19F301fD0A23Eb555A2F25a0bA0a3493E46FeE8D',
    defaultBalance: 1.2,
    description: 'Curator of the Quantum Chronos multi-axis timepiece.',
  },
  {
    id: 'visitor',
    name: 'New Museum Visitor',
    role: 'Standard Guest',
    address: '0x9924B889a7Fe88231c518cD3B20eB1A4240742dE',
    defaultBalance: 0.5,
    description: 'Fresh testnet wallet ready to mint their first Museum Pass.',
  },
];

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onUpdateWallet,
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [faucetClaimed, setFaucetClaimed] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [isConnectingExternal, setIsConnectingExternal] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectPersona = (persona: TestnetPersona) => {
    sound.playClick();
    onUpdateWallet((prev) => ({
      ...prev,
      address: persona.address,
      balanceETH: Math.max(prev.balanceETH, persona.defaultBalance),
      isSimulated: true,
      activePass: null,
      ownedPasses: [],
    }));
    setExternalError(null);
  };

  const handleClaimFaucet = () => {
    sound.playCoin();
    onUpdateWallet((prev) => ({
      ...prev,
      balanceETH: Number((prev.balanceETH + 1.0).toFixed(2)),
    }));
    setFaucetClaimed(true);
    setTimeout(() => setFaucetClaimed(false), 2500);
  };

  const handleConnectExternal = async () => {
    sound.playClick();
    setIsConnectingExternal(true);
    setExternalError(null);

    try {
      if (typeof window === 'undefined') {
        throw new Error('Window context unavailable');
      }

      const win = window as unknown as {
        ethereum?: {
          request: (args: { method: string; params?: unknown[] }) => Promise<string[]>;
        };
      };

      if (!win.ethereum) {
        setExternalError(
          'MetaMask extension was not detected. Running seamlessly with high-speed Firebase Testnet Node simulation.'
        );
        setIsConnectingExternal(false);
        return;
      }

      // Safe connection wrapped with timeout to prevent extension hanging inside iframes
      const connectPromise = win.ethereum.request({ method: 'eth_requestAccounts' });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Browser extensions are restricted in sandboxed iframes.')), 4000)
      );

      const accounts = await Promise.race([connectPromise, timeoutPromise]);

      if (accounts && accounts.length > 0) {
        onUpdateWallet((prev) => ({
          ...prev,
          address: accounts[0],
          isSimulated: false,
        }));
        setExternalError(null);
        sound.playVaultUnlock();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('External wallet connection fallback:', msg);
      setExternalError(
        'MetaMask connection was blocked by the browser iframe sandbox. Switched to simulated Web3 Testnet mode.'
      );
    } finally {
      setIsConnectingExternal(false);
    }
  };

  const handleCustomAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAddress.startsWith('0x') || customAddress.length !== 42) {
      alert('Please enter a valid 42-character Ethereum hex address starting with 0x.');
      return;
    }
    sound.playClick();
    onUpdateWallet((prev) => ({
      ...prev,
      address: customAddress,
      isSimulated: true,
      activePass: null,
      ownedPasses: [],
    }));
    setCustomAddress('');
    setExternalError(null);
  };

  const handleNetworkChange = (network: TestnetNetwork) => {
    sound.playClick();
    onUpdateWallet((prev) => ({
      ...prev,
      network,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-white overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Web3 Wallet &amp; Accounts
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {wallet.network.name} ({wallet.network.currency})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Active Account Card */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Connected Account
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {wallet.isSimulated ? 'Testnet Node' : 'Injected Web3'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="font-mono text-sm text-slate-200 select-all truncate">
                {wallet.address}
              </span>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors shrink-0"
                title="Copy Address"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono">Testnet Balance</span>
                <span className="text-base font-bold text-amber-300 font-mono">
                  {wallet.balanceETH.toFixed(2)} {wallet.network.currency}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono">Museum Passes</span>
                <span className="text-base font-bold text-sky-400 font-mono flex items-center gap-1">
                  {wallet.activePass ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>{wallet.activePass.tier} ({wallet.balanceMP})</span>
                    </>
                  ) : (
                    <span>0 Passes</span>
                  )}
                </span>
              </div>
            </div>

            {/* Testnet Faucet Button */}
            <button
              onClick={handleClaimFaucet}
              className="w-full py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Droplet className="w-3.5 h-3.5 text-amber-400" />
              <span>{faucetClaimed ? 'Claimed +1.0 tETH!' : 'Claim Faucet (+1.00 tETH Free)'}</span>
            </button>
          </div>

          {/* Iframe Fallback Notice if External Connection was Attempted */}
          {externalError && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-medium">{externalError}</p>
                <p className="text-[11px] text-amber-200/80">
                  Select one of the curated testnet accounts below to test buying, selling, curation, and VIP Vault exploration instantly.
                </p>
              </div>
            </div>
          )}

          {/* Switch Testnet Personas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                Switch Testnet Persona
              </span>
              <span className="text-[10px] text-slate-500 font-mono">1-Click Switch</span>
            </div>

            <div className="space-y-2">
              {TESTNET_PERSONAS.map((persona) => {
                const isActive = wallet.address.toLowerCase() === persona.address.toLowerCase();
                return (
                  <button
                    key={persona.id}
                    onClick={() => handleSelectPersona(persona)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-900/20'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {persona.name}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-mono font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {formatAddress(persona.address)} • {persona.role}
                      </span>
                    </div>

                    <ArrowRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-600'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connect Browser Extension Wallet (MetaMask) */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              Browser Extension (MetaMask)
            </span>

            <button
              onClick={handleConnectExternal}
              disabled={isConnectingExternal}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600/60 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isConnectingExternal ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 text-amber-400" />
                  <span>Connect Injected Browser Wallet</span>
                </>
              )}
            </button>
          </div>

          {/* Custom Hex Address Input */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Enter Custom Address
            </span>
            <form onSubmit={handleCustomAddressSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="0x..."
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition-colors"
              >
                Set
              </button>
            </form>
          </div>

          {/* Network Switcher */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Select Blockchain Network
            </span>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_NETWORKS.map((net) => (
                <button
                  key={net.id}
                  onClick={() => handleNetworkChange(net)}
                  className={`p-2 rounded-lg border text-left text-xs font-mono transition-colors ${
                    wallet.network.id === net.id
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold truncate">{net.name}</div>
                  <div className="text-[10px] text-slate-500">Chain ID: {net.chainId}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400">
            Node: Fast Web3 Firebase Simulator
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
