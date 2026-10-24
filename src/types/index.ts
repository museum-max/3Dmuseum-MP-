export type PassTier = 'STANDARD' | 'PATRON' | 'CURATOR';

export type NavigationMode = 'ORBIT' | 'WALK';

export interface MuseumPass {
  id: string;
  tokenId: string;
  ownerAddress: string;
  tier: PassTier;
  mintTime: string;
  txHash: string;
  network?: string;
  tokenURI?: string;
}

export interface ExhibitData {
  id: string;
  title: string;
  artist: string;
  creatorAddress: string;
  ownerAddress?: string;
  contractAddress?: string;
  tokenId?: string;
  imageUrl?: string;
  tokenURI?: string;
  description: string;
  rarity: 'Common' | 'Rare' | 'Legendary' | 'Mythic';
  edition: string;
  tags: string[];
  currentBid: number;
  bidsCount: number;
  likesCount: number;
  requiresTier?: PassTier;
  position: [number, number, number];
  rotation: [number, number, number];
  room: 'rotunda' | 'renaissance' | 'cyberpunk' | 'vault';
  accentColor: string;
  updatedAt?: string;
}

export interface MarketplaceListing {
  id: string;
  itemId: string;
  title: string;
  imageUrl?: string;
  itemType: 'NFT' | 'MUSEUM_PASS';
  price: number;
  sellerAddress: string;
  buyerAddress?: string;
  status: 'ACTIVE' | 'SOLD' | 'CANCELLED';
  createdAt: string;
  soldAt?: string;
  passTier?: PassTier;
}

export interface ContractDeployment {
  id: string;
  contractAddress: string;
  name: string;
  symbol: string;
  standard: 'ERC-721' | 'ERC-1155';
  deployer: string;
  txHash: string;
  deployedAt: string;
  totalSupply: number;
}

export interface VisitorLogEntry {
  id: string;
  address: string;
  nickname: string;
  passTier?: string;
  message: string;
  timestamp: string;
}

export interface ChainTransaction {
  id: string;
  txHash: string;
  method: string;
  from: string;
  to?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  timestamp: string;
  tier?: string;
  tokenId?: string;
  gasUsed?: string;
  blockNumber?: number;
}

export interface TestnetNetwork {
  id: string;
  name: string;
  chainId: number;
  currency: string;
  rpcUrl: string;
  contractAddress: string;
  explorerUrl: string;
  isCustomNode?: boolean;
}

export interface WalletState {
  connected: boolean;
  address: string;
  balanceETH: number;
  balanceMP: number;
  activePass: MuseumPass | null;
  ownedPasses: MuseumPass[];
  network: TestnetNetwork;
  isSimulated: boolean;
}
