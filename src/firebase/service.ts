import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './config';
import {
  MuseumPass,
  ExhibitData,
  VisitorLogEntry,
  ChainTransaction,
  ContractDeployment,
  MarketplaceListing,
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ================= MUSEUM PASSES =================

export async function saveMuseumPass(pass: MuseumPass): Promise<void> {
  const path = `museum_passes/${pass.id}`;
  try {
    await setDoc(doc(db, 'museum_passes', pass.id), {
      id: pass.id,
      tokenId: pass.tokenId,
      ownerAddress: pass.ownerAddress,
      tier: pass.tier,
      mintTime: pass.mintTime,
      txHash: pass.txHash,
      network: pass.network ?? 'Sepolia Testnet',
      tokenURI: pass.tokenURI ?? `ipfs://bafybeimpass/${pass.tokenId}.json`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function transferMuseumPass(passId: string, toAddress: string, txHash: string): Promise<void> {
  const path = `museum_passes/${passId}`;
  try {
    await updateDoc(doc(db, 'museum_passes', passId), {
      ownerAddress: toAddress,
      txHash: txHash,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeToMuseumPasses(callback: (passes: MuseumPass[]) => void): Unsubscribe {
  const path = 'museum_passes';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: MuseumPass[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as MuseumPass);
      });
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ================= EXHIBITS & NFT METADATA =================

export async function seedInitialExhibitIfMissing(exhibit: ExhibitData): Promise<void> {
  const path = `exhibits/${exhibit.id}`;
  try {
    const docRef = doc(db, 'exhibits', exhibit.id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        id: exhibit.id,
        title: exhibit.title,
        artist: exhibit.artist,
        description: exhibit.description,
        currentBid: exhibit.currentBid,
        likesCount: exhibit.likesCount,
        bidsCount: exhibit.bidsCount,
        creatorAddress: exhibit.creatorAddress,
        ownerAddress: exhibit.ownerAddress || exhibit.creatorAddress,
        contractAddress: exhibit.contractAddress || '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        tokenId: exhibit.tokenId || exhibit.id.replace('nft-', ''),
        imageUrl: exhibit.imageUrl || '',
        tokenURI: exhibit.tokenURI || '',
        attributes: exhibit.attributes || [],
        rarity: exhibit.rarity,
        edition: exhibit.edition,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.debug('Exhibit init sync:', err);
  }
}

export async function updateExhibitMetadata(exhibitId: string, data: Partial<ExhibitData>): Promise<void> {
  const path = `exhibits/${exhibitId}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (data.title !== undefined) payload.title = data.title;
    if (data.artist !== undefined) payload.artist = data.artist;
    if (data.description !== undefined) payload.description = data.description;
    if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl;
    if (data.ownerAddress !== undefined) payload.ownerAddress = data.ownerAddress;

    await updateDoc(doc(db, 'exhibits', exhibitId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function incrementExhibitLike(exhibitId: string, fallbackData?: ExhibitData): Promise<void> {
  const path = `exhibits/${exhibitId}`;
  try {
    const docRef = doc(db, 'exhibits', exhibitId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        likesCount: increment(1)
      });
    } else if (fallbackData) {
      await setDoc(docRef, {
        id: exhibitId,
        title: fallbackData.title,
        artist: fallbackData.artist,
        description: fallbackData.description,
        currentBid: fallbackData.currentBid,
        likesCount: (fallbackData.likesCount || 0) + 1,
        bidsCount: fallbackData.bidsCount || 0,
        creatorAddress: fallbackData.creatorAddress,
        ownerAddress: fallbackData.ownerAddress || fallbackData.creatorAddress,
        contractAddress: fallbackData.contractAddress || '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        tokenId: fallbackData.tokenId || exhibitId.replace('nft-', ''),
        imageUrl: fallbackData.imageUrl || '',
        tokenURI: fallbackData.tokenURI || '',
        attributes: fallbackData.attributes || [],
        rarity: fallbackData.rarity,
        edition: fallbackData.edition,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function placeExhibitBidOnFirestore(exhibitId: string, newBid: number, fallbackData?: ExhibitData): Promise<void> {
  const path = `exhibits/${exhibitId}`;
  try {
    const docRef = doc(db, 'exhibits', exhibitId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        currentBid: newBid,
        bidsCount: increment(1),
        updatedAt: new Date().toISOString()
      });
    } else if (fallbackData) {
      await setDoc(docRef, {
        id: exhibitId,
        title: fallbackData.title,
        artist: fallbackData.artist,
        description: fallbackData.description,
        currentBid: newBid,
        likesCount: fallbackData.likesCount || 0,
        bidsCount: (fallbackData.bidsCount || 0) + 1,
        creatorAddress: fallbackData.creatorAddress,
        ownerAddress: fallbackData.ownerAddress || fallbackData.creatorAddress,
        contractAddress: fallbackData.contractAddress || '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        tokenId: fallbackData.tokenId || exhibitId.replace('nft-', ''),
        imageUrl: fallbackData.imageUrl || '',
        tokenURI: fallbackData.tokenURI || '',
        attributes: fallbackData.attributes || [],
        rarity: fallbackData.rarity,
        edition: fallbackData.edition,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeToExhibits(callback: (exhibits: Record<string, Partial<ExhibitData>>) => void): Unsubscribe {
  const path = 'exhibits';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const map: Record<string, Partial<ExhibitData>> = {};
      snapshot.forEach((docSnap) => {
        map[docSnap.id] = docSnap.data() as Partial<ExhibitData>;
      });
      callback(map);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ================= MARKETPLACE LISTINGS =================

export async function createMarketplaceListing(listing: MarketplaceListing): Promise<void> {
  const path = `marketplace_listings/${listing.id}`;
  try {
    await setDoc(doc(db, 'marketplace_listings', listing.id), {
      id: listing.id,
      itemId: listing.itemId,
      title: listing.title,
      imageUrl: listing.imageUrl || '',
      itemType: listing.itemType,
      price: listing.price,
      sellerAddress: listing.sellerAddress,
      status: 'ACTIVE',
      createdAt: listing.createdAt,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function buyMarketplaceListing(listingId: string, buyerAddress: string): Promise<void> {
  const path = `marketplace_listings/${listingId}`;
  try {
    await updateDoc(doc(db, 'marketplace_listings', listingId), {
      buyerAddress: buyerAddress,
      status: 'SOLD',
      soldAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function cancelMarketplaceListing(listingId: string): Promise<void> {
  const path = `marketplace_listings/${listingId}`;
  try {
    await updateDoc(doc(db, 'marketplace_listings', listingId), {
      status: 'CANCELLED',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeToMarketplaceListings(callback: (listings: MarketplaceListing[]) => void): Unsubscribe {
  const path = 'marketplace_listings';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: MarketplaceListing[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as MarketplaceListing);
      });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ================= CONTRACT DEPLOYMENTS =================

export async function saveContractDeployment(deployment: ContractDeployment): Promise<void> {
  const path = `contract_deployments/${deployment.id}`;
  try {
    await setDoc(doc(db, 'contract_deployments', deployment.id), {
      id: deployment.id,
      contractAddress: deployment.contractAddress,
      name: deployment.name,
      symbol: deployment.symbol,
      standard: deployment.standard,
      deployer: deployment.deployer,
      txHash: deployment.txHash,
      deployedAt: deployment.deployedAt,
      totalSupply: deployment.totalSupply,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeToDeployments(callback: (deployments: ContractDeployment[]) => void): Unsubscribe {
  const path = 'contract_deployments';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: ContractDeployment[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ContractDeployment);
      });
      items.sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime());
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ================= GUESTBOOK =================

export async function addGuestbookSign(entry: VisitorLogEntry): Promise<void> {
  const path = `guestbook/${entry.id}`;
  try {
    await setDoc(doc(db, 'guestbook', entry.id), {
      id: entry.id,
      address: entry.address,
      nickname: entry.nickname,
      passTier: entry.passTier || 'STANDARD',
      message: entry.message,
      timestamp: entry.timestamp
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeToGuestbook(callback: (entries: VisitorLogEntry[]) => void): Unsubscribe {
  const path = 'guestbook';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: VisitorLogEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as VisitorLogEntry);
      });
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ================= TRANSACTIONS =================

export async function logChainTransaction(tx: ChainTransaction): Promise<void> {
  const path = `transactions/${tx.id}`;
  try {
    const payload: Record<string, unknown> = {
      id: tx.id,
      txHash: tx.txHash,
      method: tx.method,
      from: tx.from,
      status: tx.status,
      timestamp: tx.timestamp,
      gasUsed: tx.gasUsed ?? '48,150',
      blockNumber: tx.blockNumber ?? 5892140
    };
    if (tx.to) payload.to = tx.to;
    if (tx.tier) payload.tier = tx.tier;
    if (tx.tokenId) payload.tokenId = tx.tokenId;

    await setDoc(doc(db, 'transactions', tx.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeToTransactions(callback: (txs: ChainTransaction[]) => void): Unsubscribe {
  const path = 'transactions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: ChainTransaction[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ChainTransaction);
      });
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
