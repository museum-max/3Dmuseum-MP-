import React, { useState } from 'react';
import {
  ShoppingBag,
  Tag,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  X,
  Filter,
  ArrowUpDown,
  Ticket,
  DollarSign,
  PlusCircle,
  Ban,
  Wallet,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MarketplaceListing, WalletState, ExhibitData, MuseumPass } from '../types';
import { formatAddress, generateMockTxHash } from '../contracts/MuseumPassContract';
import {
  createMarketplaceListing,
  buyMarketplaceListing,
  cancelMarketplaceListing,
  updateExhibitMetadata,
  transferMuseumPass,
  logChainTransaction,
} from '../firebase/service';
import { sound } from '../audio/soundEffects';

interface MarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  listings: MarketplaceListing[];
  wallet: WalletState;
  onUpdateWallet: (updater: (prev: WalletState) => WalletState) => void;
  exhibits: ExhibitData[];
}

export const MarketplaceModal: React.FC<MarketplaceModalProps> = ({
  isOpen,
  onClose,
  listings,
  wallet,
  onUpdateWallet,
  exhibits,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'browse' | 'sell' | 'my-listings'>('browse');
  const [filterType, setFilterType] = useState<'ALL' | 'NFT' | 'MUSEUM_PASS'>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');

  // Sell Form State
  const [sellType, setSellType] = useState<'NFT' | 'MUSEUM_PASS'>('NFT');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [sellPrice, setSellPrice] = useState('0.15');
  const [isListing, setIsListing] = useState(false);
  const [listSuccess, setListSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Buy State
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  // Filter user's owned items available to sell
  const ownedNfts = exhibits.filter(
    (e) => e.ownerAddress?.toLowerCase() === wallet.address.toLowerCase()
  );
  const ownedPasses = wallet.ownedPasses.length > 0
    ? wallet.ownedPasses
    : (wallet.activePass ? [wallet.activePass] : []);

  // Filter listings
  const filteredListings = listings.filter((l) => {
    if (activeTab === 'my-listings') {
      return l.sellerAddress.toLowerCase() === wallet.address.toLowerCase();
    }
    if (l.status !== 'ACTIVE') return false;
    if (filterType !== 'ALL' && l.itemType !== filterType) return false;
    return true;
  });

  // Sort listings
  filteredListings.sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const priceNum = parseFloat(sellPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Please enter a valid price in ETH.');
      return;
    }

    setIsListing(true);
    sound.playClick();

    try {
      let title = '';
      let imageUrl = '';
      let itemId = selectedItemId;

      if (sellType === 'NFT') {
        const nft = ownedNfts.find((n) => n.id === selectedItemId) || ownedNfts[0];
        if (!nft) throw new Error('No owned NFT selected');
        itemId = nft.id;
        title = nft.title;
        imageUrl = nft.imageUrl || '';
      } else {
        const pass = ownedPasses.find((p) => p.id === selectedItemId) || ownedPasses[0];
        if (!pass) throw new Error('No owned Museum Pass selected');
        itemId = pass.id;
        title = `${pass.tier} Museum Pass #${pass.tokenId}`;
      }

      const listingId = `list-${Date.now()}`;
      const newListing: MarketplaceListing = {
        id: listingId,
        itemId,
        title,
        imageUrl,
        itemType: sellType,
        price: priceNum,
        sellerAddress: wallet.address,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      await createMarketplaceListing(newListing);

      const txHash = generateMockTxHash();
      await logChainTransaction({
        id: `tx-${Date.now()}`,
        txHash,
        method: `createMarketplaceListing("${title}", ${priceNum} ETH)`,
        from: wallet.address,
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        gasUsed: '52,100',
        blockNumber: 5892220,
      });

      sound.playMintFanfare();
      setListSuccess(true);
      setTimeout(() => {
        setListSuccess(false);
        setActiveTab('browse');
      }, 1800);
    } catch (err) {
      console.error('Listing creation error:', err);
      alert('Failed to list item on marketplace.');
    } finally {
      setIsListing(false);
    }
  };

  const handleBuy = async (listing: MarketplaceListing) => {
    if (wallet.balanceETH < listing.price) {
      alert(`Insufficient testnet funds (${wallet.balanceETH.toFixed(2)} ${wallet.network.currency}). Use the Faucet in Pass Terminal to claim testnet ETH.`);
      return;
    }

    if (listing.sellerAddress.toLowerCase() === wallet.address.toLowerCase()) {
      alert('You cannot buy your own listing!');
      return;
    }

    setPurchasingId(listing.id);
    sound.playClick();

    try {
      const txHash = generateMockTxHash();

      // 1. Update listing in Firestore
      await buyMarketplaceListing(listing.id, wallet.address);

      // 2. Transfer item ownership in Firestore
      if (listing.itemType === 'NFT') {
        await updateExhibitMetadata(listing.itemId, {
          ownerAddress: wallet.address,
        });
      } else {
        await transferMuseumPass(listing.itemId, wallet.address, txHash);
      }

      // 3. Log on-chain transaction
      await logChainTransaction({
        id: `tx-${Date.now()}`,
        txHash,
        method: `buyMarketplaceItem("${listing.title}", ${listing.price} ETH)`,
        from: wallet.address,
        to: listing.sellerAddress,
        status: 'CONFIRMED',
        timestamp: new Date().toISOString(),
        gasUsed: '58,400',
        blockNumber: 5892230,
      });

      // 4. Update buyer wallet balance
      onUpdateWallet((prev) => ({
        ...prev,
        balanceETH: Math.max(0, prev.balanceETH - listing.price),
      }));

      sound.playMintFanfare();
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#38bdf8', '#10b981', '#ffffff']
      });
    } catch (err) {
      console.error('Purchase error:', err);
      setActionError('Failed to complete purchase on testnet.');
    } finally {
      setPurchasingId(null);
    }
  };

  const handleCancel = async (listingId: string) => {
    sound.playClick();
    try {
      await cancelMarketplaceListing(listingId);
    } catch (err) {
      console.error('Cancel listing error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Aetheria Decentralized Marketplace
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                P2P Trade for NFTs &amp; Museum Passes (MP) • Verified On-Chain
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

        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-800 px-6 bg-slate-950/30 gap-3 py-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('browse')}
              className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'browse'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Browse All</span>
            </button>

            <button
              onClick={() => setActiveTab('sell')}
              className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'sell'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>List for Sale</span>
            </button>

            <button
              onClick={() => setActiveTab('my-listings')}
              className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'my-listings'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>My Listings</span>
            </button>
          </div>

          {activeTab === 'browse' && (
            <div className="flex items-center gap-2">
              {/* Type Filter */}
              <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-2 py-1 rounded font-mono text-[11px] ${filterType === 'ALL' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('NFT')}
                  className={`px-2 py-1 rounded font-mono text-[11px] ${filterType === 'NFT' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                >
                  NFTs
                </button>
                <button
                  onClick={() => setFilterType('MUSEUM_PASS')}
                  className={`px-2 py-1 rounded font-mono text-[11px] ${filterType === 'MUSEUM_PASS' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                >
                  Passes
                </button>
              </div>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'price-low' | 'price-high')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-white focus:outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1 & 3: BROWSE / MY LISTINGS */}
          {(activeTab === 'browse' || activeTab === 'my-listings') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>ACTIVE LISTINGS: {filteredListings.length}</span>
                <span>YOUR BALANCE: <strong className="text-amber-300 font-mono">{wallet.balanceETH.toFixed(2)} {wallet.network.currency}</strong></span>
              </div>

              {filteredListings.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-800/30 border border-dashed border-slate-700/60 space-y-2">
                  <ShoppingBag className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No active listings found.</p>
                  <p className="text-xs text-slate-500">
                    {activeTab === 'my-listings'
                      ? 'You have not listed any items for sale yet. Switch to "List for Sale" to sell an NFT or Museum Pass!'
                      : 'Be the first user to list an NFT or Museum Pass for sale!'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredListings.map((item) => {
                    const isMyItem = item.sellerAddress.toLowerCase() === wallet.address.toLowerCase();

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 hover:border-slate-600 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="h-36 rounded-lg bg-slate-950 overflow-hidden relative flex items-center justify-center border border-slate-800">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-slate-500">
                                {item.itemType === 'MUSEUM_PASS' ? (
                                  <Ticket className="w-10 h-10 text-amber-400" />
                                ) : (
                                  <Sparkles className="w-10 h-10 text-sky-400" />
                                )}
                                <span className="text-[10px] font-mono uppercase tracking-wider">{item.itemType}</span>
                              </div>
                            )}

                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/90 text-amber-300 font-mono text-[10px] border border-amber-500/30">
                              {item.itemType === 'MUSEUM_PASS' ? 'MP PASS' : 'NFT ART'}
                            </span>

                            {item.status === 'SOLD' && (
                              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                <span className="px-3 py-1 rounded bg-rose-600 text-white font-bold font-mono text-xs uppercase tracking-wider">
                                  SOLD
                                </span>
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-white tracking-tight truncate">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Seller: {formatAddress(item.sellerAddress)} {isMyItem && '(You)'}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-mono text-slate-400 block">Price</span>
                            <span className="text-base font-bold font-mono text-amber-300">
                              {item.price.toFixed(2)} ETH
                            </span>
                          </div>

                          {isMyItem ? (
                            <button
                              onClick={() => handleCancel(item.id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-mono transition-colors flex items-center gap-1"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Delist</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBuy(item)}
                              disabled={purchasingId === item.id || item.status !== 'ACTIVE'}
                              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-md shadow-amber-900/30"
                            >
                              {purchasingId === item.id ? 'Purchasing...' : 'Buy Now'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIST ITEM FOR SALE */}
          {activeTab === 'sell' && (
            <div className="max-w-xl mx-auto space-y-5">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  List an Item on the Open Marketplace
                </h4>
                <p className="text-xs text-slate-400">
                  Every connected user can list their owned NFTs or Museum Passes for sale at any custom price in testnet ETH.
                </p>
              </div>

              <form onSubmit={handleCreateListing} className="space-y-4 p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
                {/* Type Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Item Type to Sell:</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSellType('NFT');
                        setSelectedItemId(ownedNfts[0]?.id || '');
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 ${
                        sellType === 'NFT'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Exhibited NFT</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSellType('MUSEUM_PASS');
                        setSelectedItemId(ownedPasses[0]?.id || '');
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 ${
                        sellType === 'MUSEUM_PASS'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>Museum Pass (MP)</span>
                    </button>
                  </div>
                </div>

                {/* Item Select */}
                {sellType === 'NFT' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Select Owned NFT:</label>
                    {ownedNfts.length === 0 ? (
                      <p className="text-xs text-rose-400 font-mono p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/50">
                        You do not currently own any exhibited NFTs. Switch to &apos;Museum Pass&apos; or curate an NFT in the museum first!
                      </p>
                    ) : (
                      <select
                        value={selectedItemId || ownedNfts[0]?.id}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      >
                        {ownedNfts.map((nft) => (
                          <option key={nft.id} value={nft.id}>
                            {nft.title} — {nft.artist} (Token #{nft.tokenId || 1})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Select Owned Museum Pass:</label>
                    {ownedPasses.length === 0 ? (
                      <p className="text-xs text-rose-400 font-mono p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/50">
                        You do not own any Museum Passes yet. Mint a pass first in the Pass Terminal!
                      </p>
                    ) : (
                      <select
                        value={selectedItemId || ownedPasses[0]?.id}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                      >
                        {ownedPasses.map((pass) => (
                          <option key={pass.id} value={pass.id}>
                            {pass.tier} Pass (Token #{pass.tokenId})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Price Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-300">Listing Price in ETH:</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      required
                      className="w-full pl-3 pr-14 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-amber-400 pointer-events-none">
                      ETH
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isListing || (sellType === 'NFT' ? ownedNfts.length === 0 : ownedPasses.length === 0)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-md shadow-amber-900/30"
                >
                  {isListing ? 'Creating Listing on Testnet...' : 'List Item on Marketplace'}
                </button>

                {listSuccess && (
                  <p className="text-xs text-emerald-400 font-mono text-center">
                    ✓ Item listed successfully on the decentralized marketplace!
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
