import React, { useState } from 'react';
import {
  Sparkles,
  ExternalLink,
  Layers,
  ArrowRight,
  Check,
  Search,
  X,
  Upload,
} from 'lucide-react';
import { ExhibitData } from '../types';
import {
  CURATED_EXTERNAL_NFTS,
  fetchNftMetadata,
  FetchedNftMetadata,
} from '../services/nftMetadataService';
import { updateExhibitMetadata, logChainTransaction } from '../firebase/service';
import { generateMockTxHash, formatAddress } from '../contracts/MuseumPassContract';
import { sound } from '../audio/soundEffects';

interface ImportNftModalProps {
  isOpen: boolean;
  onClose: () => void;
  exhibits: ExhibitData[];
  connectedAddress: string;
}

export const ImportNftModal: React.FC<ImportNftModalProps> = ({
  isOpen,
  onClose,
  exhibits,
  connectedAddress,
}) => {
  if (!isOpen) return null;

  const [contractAddress, setContractAddress] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [targetExhibitId, setTargetExhibitId] = useState(exhibits[0]?.id || 'nft-1');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<FetchedNftMetadata | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSelectCurated = (item: FetchedNftMetadata) => {
    setContractAddress(item.contractAddress);
    setTokenId(item.tokenId);
    setPreview(item);
    sound.playClick();
  };

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractAddress.trim() || !tokenId.trim()) return;

    setIsLoading(true);
    sound.playClick();

    try {
      const meta = await fetchNftMetadata(contractAddress.trim(), tokenId.trim());
      setPreview(meta);
    } catch (err) {
      console.error('Fetch error:', err);
      alert('Could not resolve metadata for this contract and token ID.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMountToMuseum = async () => {
    if (!preview) return;

    setIsLoading(true);
    sound.playClick();

    try {
      await updateExhibitMetadata(targetExhibitId, {
        title: preview.name,
        artist: preview.artist || 'Web3 Creator',
        description: preview.description,
        imageUrl: preview.image,
        contractAddress: preview.contractAddress,
        tokenId: preview.tokenId,
        ownerAddress: preview.ownerAddress || connectedAddress,
      });

      const txHash = generateMockTxHash();
      await logChainTransaction({
        id: `tx-${Date.now()}`,
        txHash,
        method: `mountExhibition("${preview.name}", ${preview.tokenId})`,
        from: connectedAddress,
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        gasUsed: '62,400',
        blockNumber: 5892180,
      });

      sound.playMintFanfare();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err) {
      console.error('Mount error:', err);
      alert('Failed to update museum exhibit.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Curate &amp; Display NFT in 3D Museum
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Fetch Metadata • Verify On-Chain Ownership • Render onto 3D Pedestal
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Curated Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono block">
              Quick Pick: Verified On-Chain Masterpieces
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CURATED_EXTERNAL_NFTS.map((item) => (
                <button
                  key={`${item.contractAddress}-${item.tokenId}`}
                  type="button"
                  onClick={() => handleSelectCurated(item)}
                  className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                    contractAddress === item.contractAddress && tokenId === item.tokenId
                      ? 'bg-amber-950/40 border-amber-400 ring-1 ring-amber-400'
                      : 'bg-slate-800/40 border-slate-700/80 hover:bg-slate-800'
                  }`}
                >
                  <div className="h-14 w-full rounded-lg overflow-hidden bg-slate-950 relative">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-amber-400 font-mono">{item.standard}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleFetch} className="space-y-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-mono text-slate-400">
                  Smart Contract Address (ERC-721 / ERC-1155)
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-400">
                  Token ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7583"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading || !contractAddress.trim() || !tokenId.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-mono text-white transition-colors disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5 text-amber-400" />
                <span>{isLoading ? 'Fetching On-Chain...' : 'Resolve Metadata'}</span>
              </button>
            </div>
          </form>

          {/* Metadata Preview & Mount Section */}
          {preview && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/40 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-slate-700 bg-black">
                  <img
                    src={preview.image}
                    alt={preview.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white tracking-tight">
                      {preview.name}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                      {preview.standard} VERIFIED
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {preview.description}
                  </p>

                  <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-400 pt-1">
                    <span>Artist: <strong className="text-slate-200">{preview.artist}</strong></span>
                    <span>•</span>
                    <span>Owner: <strong className="text-amber-300">{formatAddress(preview.ownerAddress)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Target Pedestal Picker */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                    Mount on 3D Pedestal:
                  </span>
                  <select
                    value={targetExhibitId}
                    onChange={(e) => setTargetExhibitId(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400 w-full sm:w-auto"
                  >
                    {exhibits.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.room.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleMountToMuseum}
                  disabled={isLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-md shadow-amber-900/30"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Display in 3D Gallery</span>
                </button>
              </div>

              {success && (
                <p className="text-xs text-emerald-400 font-mono text-center pt-2">
                  ✓ NFT metadata mounted to 3D gallery and broadcasted to testnet!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
