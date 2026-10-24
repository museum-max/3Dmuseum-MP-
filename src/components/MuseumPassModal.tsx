import React, { useState } from 'react';
import {
  Ticket,
  CheckCircle2,
  Lock,
  Unlock,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  X,
  Code2,
  Droplet,
  Layers,
  ShieldCheck,
  Send,
  Rocket,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WalletState, PassTier, MuseumPass, ContractDeployment } from '../types';
import {
  SUPPORTED_NETWORKS,
  PASS_TIER_DETAILS,
  MUSEUM_PASS_ERC721_SOURCE,
  MUSEUM_PASS_ERC1155_SOURCE,
  MUSEUM_PASS_ABI,
  generateMockTxHash,
  generateContractAddress,
  formatAddress,
} from '../contracts/MuseumPassContract';
import {
  saveMuseumPass,
  transferMuseumPass,
  logChainTransaction,
  saveContractDeployment,
} from '../firebase/service';
import { sound } from '../audio/soundEffects';

interface MuseumPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: WalletState;
  onUpdateWallet: (updater: (prev: WalletState) => WalletState) => void;
  initialTab?: 'mint' | 'transfer' | 'deploy' | 'contract';
  deployments: ContractDeployment[];
}

export const MuseumPassModal: React.FC<MuseumPassModalProps> = ({
  isOpen,
  onClose,
  wallet,
  onUpdateWallet,
  initialTab = 'mint',
  deployments,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'mint' | 'transfer' | 'deploy' | 'contract'>(initialTab);
  const [selectedTier, setSelectedTier] = useState<PassTier>('PATRON');
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState<MuseumPass | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [faucetClaimed, setFaucetClaimed] = useState(false);

  // Transfer State
  const [selectedPassId, setSelectedPassId] = useState<string>(wallet.ownedPasses[0]?.id || wallet.activePass?.id || '');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);

  // Deployment State
  const [deployStandard, setDeployStandard] = useState<'ERC-721' | 'ERC-1155'>('ERC-721');
  const [deployName, setDeployName] = useState('Museum Pass');
  const [deploySymbol, setDeploySymbol] = useState('MP');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<ContractDeployment | null>(null);

  // Contract Code Tab
  const [codeStandard, setCodeStandard] = useState<'ERC-721' | 'ERC-1155'>('ERC-721');

  const tierInfo = PASS_TIER_DETAILS[selectedTier];
  const userPasses = wallet.ownedPasses.length > 0 ? wallet.ownedPasses : (wallet.activePass ? [wallet.activePass] : []);

  const handleMintPass = async () => {
    if (wallet.balanceETH < tierInfo.priceETH) {
      alert(`Insufficient testnet funds (${wallet.balanceETH.toFixed(2)} ${wallet.network.currency}). Use the Testnet Faucet below to claim free testnet tokens!`);
      return;
    }

    setIsMinting(true);
    sound.playClick();

    try {
      const tokenId = String(Math.floor(1000 + Math.random() * 9000));
      const txHash = generateMockTxHash();
      const newPass: MuseumPass = {
        id: `pass-${tokenId}`,
        tokenId,
        ownerAddress: wallet.address,
        tier: selectedTier,
        mintTime: new Date().toISOString(),
        txHash,
        network: wallet.network.name,
        tokenURI: `ipfs://bafybeimpass/${tokenId}.json`,
      };

      await saveMuseumPass(newPass);

      await logChainTransaction({
        id: `tx-${Date.now()}`,
        txHash,
        method: `mintPass(tier: ${selectedTier})`,
        from: wallet.address,
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        tier: selectedTier,
        tokenId,
        gasUsed: '84,120',
        blockNumber: 5892160 + Math.floor(Math.random() * 100),
      });

      onUpdateWallet((prev) => ({
        ...prev,
        balanceETH: Math.max(0, prev.balanceETH - tierInfo.priceETH),
        balanceMP: prev.balanceMP + 1,
        activePass: newPass,
        ownedPasses: [...prev.ownedPasses, newPass],
      }));

      sound.playMintFanfare();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#38bdf8', '#a855f7', '#ffffff']
      });

      setMintSuccess(newPass);
    } catch (err) {
      console.error('Minting error:', err);
      alert('Error recording pass mint to Firebase.');
    } finally {
      setIsMinting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferRecipient.trim() || !transferRecipient.startsWith('0x')) {
      alert('Please enter a valid Ethereum hex address (0x...)');
      return;
    }

    const passToTransfer = userPasses.find((p) => p.id === selectedPassId) || userPasses[0];
    if (!passToTransfer) {
      alert('No pass available to transfer.');
      return;
    }

    setIsTransferring(true);
    sound.playClick();

    try {
      const txHash = generateMockTxHash();

      // 1. Update owner in Firestore
      await transferMuseumPass(passToTransfer.id, transferRecipient.trim(), txHash);

      // 2. Log Blockchain Transfer event
      await logChainTransaction({
        id: `tx-${Date.now()}`,
        txHash,
        method: `transferFrom(${wallet.address}, ${transferRecipient.trim()}, ${passToTransfer.tokenId})`,
        from: wallet.address,
        to: transferRecipient.trim(),
        tokenId: passToTransfer.tokenId,
        tier: passToTransfer.tier,
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        gasUsed: '46,200',
        blockNumber: 5892200,
      });

      // 3. Update local wallet state
      onUpdateWallet((prev) => {
        const remaining = prev.ownedPasses.filter((p) => p.id !== passToTransfer.id);
        const newActive = remaining.length > 0 ? remaining[0] : null;
        return {
          ...prev,
          balanceMP: Math.max(0, prev.balanceMP - 1),
          ownedPasses: remaining,
          activePass: newActive,
        };
      });

      sound.playMintFanfare();
      setTransferSuccess(true);
      setTimeout(() => setTransferSuccess(false), 2500);
    } catch (err) {
      console.error('Transfer error:', err);
      alert('Failed to execute pass transfer.');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDeployContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeploying(true);
    sound.playClick();

    try {
      const contractAddress = generateContractAddress(deployStandard, wallet.address);
      const txHash = generateMockTxHash();

      const newDeployment: ContractDeployment = {
        id: `deploy-${Date.now()}`,
        contractAddress,
        name: deployName.trim(),
        symbol: deploySymbol.trim(),
        standard: deployStandard,
        deployer: wallet.address,
        txHash,
        deployedAt: new Date().toISOString(),
        totalSupply: 0,
      };

      // 1. Save to Firebase Testnet contract deployments
      await saveContractDeployment(newDeployment);

      // 2. Log deployment transaction
      await logChainTransaction({
        id: `tx-${Date.now()}`,
        txHash,
        method: `deployContract("${deployName}", "${deploySymbol}", ${deployStandard})`,
        from: wallet.address,
        to: contractAddress,
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        gasUsed: '1,420,500',
        blockNumber: 5892210,
      });

      // 3. Update active network contract address
      onUpdateWallet((prev) => ({
        ...prev,
        network: {
          ...prev.network,
          contractAddress,
        }
      }));

      sound.playMintFanfare();
      setDeploySuccess(newDeployment);
    } catch (err) {
      console.error('Deploy error:', err);
      alert('Failed to deploy contract to Firebase testnet.');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleClaimFaucet = () => {
    sound.playClick();
    onUpdateWallet((prev) => ({
      ...prev,
      balanceETH: prev.balanceETH + 0.50,
    }));
    setFaucetClaimed(true);
    setTimeout(() => setFaucetClaimed(false), 2500);
  };

  const currentSoliditySource =
    codeStandard === 'ERC-721' ? MUSEUM_PASS_ERC721_SOURCE : MUSEUM_PASS_ERC1155_SOURCE;

  const handleCopySolidity = () => {
    navigator.clipboard.writeText(currentSoliditySource);
    setCopiedCode(true);
    sound.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyContractAddress = () => {
    navigator.clipboard.writeText(wallet.network.contractAddress);
    setCopiedAddress(true);
    sound.playClick();
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Museum Pass (MP) Smart Contract Terminal
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                ERC-721 / ERC-1155 Token Engine • Firebase Testnet Integration
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/30 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('mint')}
            className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'mint'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mint Pass</span>
          </button>

          <button
            onClick={() => setActiveTab('transfer')}
            className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'transfer'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Transfer Pass</span>
          </button>

          <button
            onClick={() => setActiveTab('deploy')}
            className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'deploy'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Deploy Contract</span>
          </button>

          <button
            onClick={() => setActiveTab('contract')}
            className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'contract'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Solidity &amp; ABI</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: MINT PASS */}
          {activeTab === 'mint' && (
            <>
              {/* Network and Faucet Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <span className="text-xs font-mono text-slate-400">Network:</span>
                  <select
                    value={wallet.network.id}
                    onChange={(e) => {
                      const net = SUPPORTED_NETWORKS.find((n) => n.id === e.target.value);
                      if (net) {
                        onUpdateWallet((prev) => ({ ...prev, network: net }));
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  >
                    {SUPPORTED_NETWORKS.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Balance</span>
                    <span className="text-xs font-bold font-mono text-amber-300">
                      {wallet.balanceETH.toFixed(2)} {wallet.network.currency}
                    </span>
                  </div>

                  <button
                    onClick={handleClaimFaucet}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-900/40 border border-sky-500/40 text-sky-300 hover:bg-sky-800/50 hover:text-white text-xs font-mono transition-colors"
                  >
                    <Droplet className="w-3.5 h-3.5 text-sky-400" />
                    <span>{faucetClaimed ? 'Claimed +0.50!' : '+0.50 Testnet Faucet'}</span>
                  </button>
                </div>
              </div>

              {/* Tier Cards Grid */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block font-mono">
                  Select Museum Pass (MP) Tier
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(Object.keys(PASS_TIER_DETAILS) as PassTier[]).map((tierKey) => {
                    const info = PASS_TIER_DETAILS[tierKey];
                    const isSelected = selectedTier === tierKey;

                    return (
                      <div
                        key={tierKey}
                        onClick={() => {
                          setSelectedTier(tierKey);
                          sound.playClick();
                        }}
                        className={`relative p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-slate-800/90 border-amber-400 shadow-xl shadow-amber-500/10 ring-1 ring-amber-400'
                            : 'bg-slate-800/40 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800/60'
                        }`}
                      >
                        {info.vaultAccess && (
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40">
                            <Unlock className="w-3 h-3 text-purple-400" />
                            <span>VAULT</span>
                          </div>
                        )}

                        <div>
                          <div
                            className="w-2.5 h-2.5 rounded-full mb-2"
                            style={{ backgroundColor: info.badgeColor }}
                          />
                          <h4 className="text-sm font-bold text-white tracking-tight">
                            {info.name}
                          </h4>
                          <div className="flex items-baseline gap-1 mt-1 mb-3">
                            <span className="text-xl font-bold font-mono text-white">
                              {info.priceETH}
                            </span>
                            <span className="text-xs text-amber-400 font-bold font-mono">
                              ETH / MP
                            </span>
                          </div>

                          <ul className="space-y-1.5 text-xs text-slate-300 mb-4">
                            {info.perks.map((p) => (
                              <li key={p} className="flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                                <span className="text-[11px] leading-tight">{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-2 border-t border-slate-700/60 text-center">
                          <span className={`text-[11px] font-mono font-semibold ${isSelected ? 'text-amber-400' : 'text-slate-400'}`}>
                            {isSelected ? 'Selected Tier' : 'Choose Tier'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mint Action Panel */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 w-full sm:w-auto text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-400 font-mono">
                    <span>Recipient:</span>
                    <span className="text-slate-200 font-semibold">{formatAddress(wallet.address)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Mints 1 MP Token on testnet and registers pass to Firebase ledger.
                  </p>
                </div>

                <button
                  onClick={handleMintPass}
                  disabled={isMinting}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Ticket className="w-4 h-4" />
                  <span>{isMinting ? 'Minting on Testnet...' : `Mint ${selectedTier} Pass (${tierInfo.priceETH} ETH)`}</span>
                </button>
              </div>

              {mintSuccess && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-start gap-3 text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-emerald-300">
                      Museum Pass (MP) Minted Successfully!
                    </p>
                    <p className="text-[11px] text-emerald-300/80">
                      Token ID: <span className="font-mono font-bold">#{mintSuccess.tokenId}</span> • Tier: <span className="font-mono font-bold">{mintSuccess.tier}</span>
                    </p>
                    <p className="text-[11px] font-mono text-emerald-400/90 break-all">
                      Tx: {mintSuccess.txHash}
                    </p>
                    {tierInfo.vaultAccess && (
                      <p className="text-[11px] font-bold text-amber-300 pt-1">
                        ✨ VIP Obsidian Vault access unlocked in the 3D gallery!
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: TRANSFER PASS */}
          {activeTab === 'transfer' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-amber-400" />
                  Peer-to-Peer Museum Pass (MP) Transfer
                </h4>
                <p className="text-xs text-slate-400">
                  Transfer full access rights and NFT ownership to any Ethereum address. Executed on the testnet via <code className="text-amber-300">transferFrom</code> and synced with Firestore.
                </p>
              </div>

              {userPasses.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-800/30 border border-dashed border-slate-700/60 text-slate-400 text-xs">
                  You do not currently own any Museum Passes to transfer. Mint a pass first in the Mint Pass tab!
                </div>
              ) : (
                <form onSubmit={handleTransfer} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">
                      Select Pass to Transfer:
                    </label>
                    <select
                      value={selectedPassId}
                      onChange={(e) => setSelectedPassId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    >
                      {userPasses.map((p) => (
                        <option key={p.id} value={p.id}>
                          Token #{p.tokenId} — {p.tier} Pass (Tx: {formatAddress(p.txHash)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">
                      Recipient Ethereum Address:
                    </label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={transferRecipient}
                      onChange={(e) => setTransferRecipient(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Sender: {formatAddress(wallet.address)}
                    </span>

                    <button
                      type="submit"
                      disabled={isTransferring || !transferRecipient.trim()}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isTransferring ? 'Transferring...' : 'Transfer Pass Token'}</span>
                    </button>
                  </div>

                  {transferSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs font-mono">
                      ✓ Pass transferred successfully to {formatAddress(transferRecipient)}!
                    </div>
                  )}
                </form>
              )}
            </div>
          )}

          {/* TAB 3: DEPLOY CONTRACT */}
          {activeTab === 'deploy' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-amber-400" />
                  Deploy Museum Pass Smart Contract to Firebase Testnet
                </h4>
                <p className="text-xs text-slate-400">
                  Deploy a new instance of an ERC-721 or ERC-1155 token contract to the persistent Firebase testnet node.
                </p>
              </div>

              <form onSubmit={handleDeployContract} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Token Standard</label>
                    <select
                      value={deployStandard}
                      onChange={(e) => setDeployStandard(e.target.value as 'ERC-721' | 'ERC-1155')}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="ERC-721">ERC-721 (Non-Fungible)</option>
                      <option value="ERC-1155">ERC-1155 (Multi-Token)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Token Name</label>
                    <input
                      type="text"
                      value={deployName}
                      onChange={(e) => setDeployName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-slate-300">Symbol</label>
                    <input
                      type="text"
                      value={deploySymbol}
                      onChange={(e) => setDeploySymbol(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Deployer: {formatAddress(wallet.address)}
                  </span>

                  <button
                    type="submit"
                    disabled={isDeploying}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>{isDeploying ? 'Deploying to Testnet...' : 'Deploy Smart Contract'}</span>
                  </button>
                </div>

                {deploySuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs space-y-1 font-mono">
                    <p className="font-bold text-emerald-300">✓ Contract Deployed Successfully!</p>
                    <p>Address: <strong className="text-white">{deploySuccess.contractAddress}</strong></p>
                    <p>Tx Hash: {deploySuccess.txHash}</p>
                    <p className="text-[11px] text-amber-300">Active testnet contract updated in museum environment.</p>
                  </div>
                )}
              </form>

              {/* Previously Deployed Contracts on Firebase */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  Firebase Testnet Deployed Contracts ({deployments.length})
                </span>

                {deployments.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono">
                    Genesis contract actively running at {wallet.network.contractAddress}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {deployments.map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-white">{d.name} ({d.symbol})</span>
                          <span className="font-mono text-[11px] text-amber-300 block">{d.contractAddress}</span>
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          {d.standard}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SOLIDITY & ABI */}
          {activeTab === 'contract' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div className="flex items-center gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Active Testnet Contract</span>
                    <span className="font-mono text-xs text-amber-300 font-bold">
                      {wallet.network.contractAddress}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyContractAddress}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={codeStandard}
                    onChange={(e) => setCodeStandard(e.target.value as 'ERC-721' | 'ERC-1155')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none"
                  >
                    <option value="ERC-721">ERC-721 Standard</option>
                    <option value="ERC-1155">ERC-1155 Standard</option>
                  </select>

                  <button
                    onClick={handleCopySolidity}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-white transition-colors border border-slate-600"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 overflow-x-auto max-h-[380px]">
                <pre className="text-[11px] font-mono text-slate-300 leading-relaxed">
                  <code>{currentSoliditySource}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
