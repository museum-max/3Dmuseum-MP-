import React, { useState } from 'react';
import {
  Heart,
  Gavel,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  X,
  Tag,
  User,
  ShieldCheck,
  Send,
  Edit3,
} from 'lucide-react';
import { ExhibitData, WalletState } from '../types';
import { formatAddress, generateMockTxHash } from '../contracts/MuseumPassContract';
import {
  incrementExhibitLike,
  placeExhibitBidOnFirestore,
  updateExhibitMetadata,
  logChainTransaction,
} from '../firebase/service';
import { verifyOwnership } from '../services/nftMetadataService';
import { sound } from '../audio/soundEffects';

interface ExhibitModalProps {
  exhibit: ExhibitData | null;
  onClose: () => void;
  wallet: WalletState;
  onOpenPassModal: () => void;
  onOpenImportModal: () => void;
}

export const ExhibitModal: React.FC<ExhibitModalProps> = ({
  exhibit,
  onClose,
  wallet,
  onOpenPassModal,
  onOpenImportModal,
}) => {
  if (!exhibit) return null;

  const [bidAmount, setBidAmount] = useState((exhibit.currentBid + 0.1).toFixed(2));
  const [isBidding, setIsBidding] = useState(false);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  // Transfer State for verified owner
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Verification check
  const { isOwner, ownerAddress } = verifyOwnership(exhibit, wallet.address);

  const handleLike = async () => {
    if (hasLiked) return;
    sound.playClick();
    setHasLiked(true);
    try {
      await incrementExhibitLike(exhibit.id, exhibit);
    } catch (err) {
      console.error('Like sync error:', err);
    }
  };

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidError(null);
    const parsed = parseFloat(bidAmount);
    if (isNaN(parsed) || parsed <= exhibit.currentBid) {
      setBidError(`Bid must be greater than current bid (${exhibit.currentBid} ETH)`);
      return;
    }

    setIsBidding(true);
    sound.playClick();

    try {
      await placeExhibitBidOnFirestore(exhibit.id, parsed, exhibit);

      const txHash = generateMockTxHash();
      await logChainTransaction({
        id: `tx-${Date.now()}`,
        txHash,
        method: `bidExhibit("${exhibit.title}", ${parsed} ETH)`,
        from: wallet.address,
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        gasUsed: '54,200',
        blockNumber: 5892150 + Math.floor(Math.random() * 200),
      });

      sound.playMintFanfare();
      setBidSuccess(true);
      setTimeout(() => setBidSuccess(false), 3000);
    } catch (err) {
      console.error('Bid error:', err);
      setBidError('Failed to record bid to testnet Firestore ledger.');
    } finally {
      setIsBidding(false);
    }
  };

  const handleTransferNft = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    if (!transferRecipient.trim() || !transferRecipient.startsWith('0x')) {
      setTransferError('Please enter a valid Ethereum hex address (0x...)');
      return;
    }

    setIsTransferring(true);
    sound.playClick();

    try {
      const txHash = generateMockTxHash();

      // Update Firestore exhibit owner
      await updateExhibitMetadata(exhibit.id, {
        ownerAddress: transferRecipient.trim(),
      });

      // Log transaction
      await logChainTransaction({
        id: `tx-${Date.now()}`,
        txHash,
        method: `transferFrom(${wallet.address}, ${transferRecipient.trim()}, ${exhibit.tokenId || 1})`,
        from: wallet.address,
        to: transferRecipient.trim(),
        tokenId: exhibit.tokenId || '1',
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        gasUsed: '46,800',
        blockNumber: 5892190,
      });

      sound.playMintFanfare();
      setTransferSuccess(true);
      setTimeout(() => {
        setTransferSuccess(false);
        setShowTransfer(false);
      }, 2500);
    } catch (err) {
      console.error('Transfer error:', err);
      setTransferError('Failed to execute NFT transfer on testnet.');
    } finally {
      setIsTransferring(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(ownerAddress);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const isLocked = exhibit.requiresTier && (!wallet.activePass || (wallet.activePass.tier === 'STANDARD' && exhibit.requiresTier === 'PATRON'));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 flex flex-col md:flex-row overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Artwork Visual Header */}
        <div
          className="md:w-5/12 p-6 flex flex-col justify-between items-center text-center relative border-b md:border-b-0 md:border-r border-slate-800"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${exhibit.accentColor}25, #09090b 85%)`
          }}
        >
          <div className="w-full flex justify-between items-center text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-slate-800/90 text-amber-400 border border-amber-500/30">
              {exhibit.edition}
            </span>
            <span
              className="px-2 py-0.5 rounded font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${exhibit.accentColor}30`,
                color: exhibit.accentColor,
                border: `1px solid ${exhibit.accentColor}60`
              }}
            >
              {exhibit.rarity}
            </span>
          </div>

          <div className="my-6 relative">
            {exhibit.imageUrl ? (
              <div
                className="w-48 max-w-full aspect-[3/2] rounded-2xl overflow-hidden border-2 shadow-2xl relative bg-slate-950"
                style={{
                  borderColor: exhibit.accentColor || '#f97316',
                  boxShadow: `0 0 30px ${exhibit.accentColor || '#f97316'}45`,
                }}
              >
                <img
                  src={exhibit.imageUrl}
                  alt={exhibit.title}
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>
            ) : (
              <div
                className="w-36 h-36 rounded-2xl border-2 shadow-2xl flex items-center justify-center relative overflow-hidden"
                style={{
                  borderColor: exhibit.accentColor,
                  boxShadow: `0 0 35px ${exhibit.accentColor}40`
                }}
              >
                <Sparkles
                  className="w-16 h-16"
                  style={{ color: exhibit.accentColor }}
                />
              </div>
            )}

            {isOwner && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold font-mono text-[9px] uppercase tracking-wider shadow-lg flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                VERIFIED OWNER
              </div>
            )}
          </div>

          <div className="w-full space-y-1">
            <p className="text-xs text-slate-400 font-mono">Curated Wing</p>
            <p className="text-xs font-semibold capitalize text-slate-200">
              {exhibit.room.replace('_', ' ')} Gallery
            </p>
          </div>
        </div>

        {/* Right Side: Metadata & Actions */}
        <div className="md:w-7/12 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {exhibit.title}
                </h2>
                <button
                  onClick={onOpenImportModal}
                  title="Replace with custom external NFT"
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700 text-xs font-mono transition-colors flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Curate</span>
                </button>
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  {exhibit.artist}
                </span>
                <span>•</span>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1 font-mono hover:text-white transition-colors"
                  title="Copy Verified Owner Address"
                >
                  <span>Owner: {formatAddress(ownerAddress)}</span>
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Ownership Banner */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                isOwner
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${isOwner ? 'text-amber-400' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">
                    {isOwner ? 'Cryptographic Ownership Verified: You Own This NFT' : 'On-Chain Ownership Verified'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Token #{exhibit.tokenId || '1'} • Contract: {formatAddress(exhibit.contractAddress || '0x8A72...442A')}
                  </span>
                </div>
              </div>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowTransfer(!showTransfer)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] font-mono hover:bg-amber-400 transition-colors shrink-0"
                >
                  Transfer NFT
                </button>
              )}
            </div>

            {/* Transfer Section (Only when Owner clicks Transfer) */}
            {showTransfer && (
              <form onSubmit={handleTransferNft} className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 font-mono">
                    Transfer NFT Ownership
                  </span>
                  <span className="text-[10px] text-slate-400">ERC-721 transferFrom</span>
                </div>
                <input
                  type="text"
                  placeholder="Recipient Address (0x...)"
                  value={transferRecipient}
                  onChange={(e) => setTransferRecipient(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTransfer(false)}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isTransferring}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs font-mono disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isTransferring ? 'Broadcasting...' : 'Execute Transfer'}</span>
                  </button>
                </div>
                {transferError && (
                  <p className="text-[11px] text-rose-400 font-mono">
                    ⚠ {transferError}
                  </p>
                )}
                {transferSuccess && (
                  <p className="text-[11px] text-emerald-400 font-mono">
                    ✓ Ownership successfully transferred to {formatAddress(transferRecipient)}!
                  </p>
                )}
              </form>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              {exhibit.description}
            </p>

            {/* IPFS Token URI Link */}
            {exhibit.tokenURI && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-sky-950/40 border border-sky-500/30 text-xs font-mono">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold uppercase tracking-wider">
                    IPFS
                  </span>
                  <span className="text-slate-300 text-[11px] truncate">
                    {exhibit.tokenURI}
                  </span>
                </div>
                <a
                  href={`https://ipfs.io/ipfs/${exhibit.tokenURI.replace('ipfs://', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:text-sky-200 transition-colors shrink-0 ml-2"
                  title="View on IPFS Gateway"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* On-Chain Attributes / Metadata Traits */}
            {exhibit.attributes && exhibit.attributes.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                  Verified NFT Traits ({exhibit.attributes.length})
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {exhibit.attributes.map((attr, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center flex flex-col justify-center"
                    >
                      <span className="text-[9px] uppercase font-mono tracking-wider text-sky-400 truncate">
                        {attr.trait_type}
                      </span>
                      <span className="text-[11px] font-bold text-slate-100 font-mono truncate mt-0.5">
                        {String(attr.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {exhibit.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300 font-mono"
                >
                  <Tag className="w-2.5 h-2.5 text-slate-400" />
                  {tag}
                </span>
              ))}
            </div>

            {/* High Bid & Likes Row */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                  Current Top Bid
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg font-bold text-white font-mono">
                    {exhibit.currentBid.toFixed(2)}
                  </span>
                  <span className="text-xs text-amber-400 font-bold font-mono">ETH</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {exhibit.bidsCount} total verified bids
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                  Community Curation
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={handleLike}
                    disabled={hasLiked}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      hasLiked
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-default'
                        : 'bg-slate-700 text-slate-200 hover:bg-rose-600 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-rose-400 text-rose-400' : ''}`} />
                    <span>{exhibit.likesCount + (hasLiked ? 1 : 0)} Likes</span>
                  </button>
                </div>
              </div>
            </div>

            {/* VIP Pass Warning */}
            {isLocked && (
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/50 flex items-start gap-2.5 text-xs text-purple-200">
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-purple-300">
                    VIP Vault Artifact Restriction
                  </p>
                  <p className="text-[11px] text-purple-200/80">
                    This masterpiece is locked in the Obsidian Vault. Mint a Patron or Curator Museum Pass (MP) to bid or curate.
                  </p>
                  <button
                    onClick={onOpenPassModal}
                    className="mt-1 font-bold text-purple-300 hover:text-white underline text-[11px]"
                  >
                    Mint Patron Pass &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Place Bid Form */}
          <form onSubmit={handleBidSubmit} className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.05"
                  min={exhibit.currentBid + 0.05}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  disabled={isBidding || !!isLocked}
                  className="w-full pl-3 pr-14 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-mono text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-amber-400 pointer-events-none">
                  ETH
                </span>
              </div>

              <button
                type="submit"
                disabled={isBidding || !!isLocked}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-md shadow-amber-900/30 shrink-0"
              >
                <Gavel className="w-3.5 h-3.5" />
                <span>{isBidding ? 'Submitting...' : 'Place Bid'}</span>
              </button>
            </div>

            {bidError && (
              <p className="text-xs text-rose-400 font-mono">
                ⚠ {bidError}
              </p>
            )}
            {bidSuccess && (
              <p className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                <Check className="w-3.5 h-3.5" /> High bid broadcasted to testnet and synced with Firebase!
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
