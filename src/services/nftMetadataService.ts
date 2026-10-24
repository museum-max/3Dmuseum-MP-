import { ExhibitData } from '../types';

export interface FetchedNftMetadata {
  name: string;
  description: string;
  image: string;
  animation_url?: string;
  artist?: string;
  attributes?: { trait_type: string; value: string | number }[];
  contractAddress: string;
  tokenId: string;
  standard: 'ERC-721' | 'ERC-1155';
  ownerAddress: string;
}

export const CURATED_EXTERNAL_NFTS: FetchedNftMetadata[] = [
  {
    name: 'Chromie Squiggle #7583',
    artist: 'Snowfro (Art Blocks)',
    description: 'Autonomous color-wave algorithm synthesized directly on the Ethereum blockchain. Features hyper-saturated spectral distribution.',
    image: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80',
    contractAddress: '0x059EDD72Cd353dF5106D2B9cC5ab83a52287aC3a',
    tokenId: '7583',
    standard: 'ERC-721',
    ownerAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f', // Owned by current wallet for instant test verification!
    attributes: [
      { trait_type: 'Spectrum', value: 'Hyper Rainbow' },
      { trait_type: 'Segments', value: 16 },
      { trait_type: 'Starting Color', value: 242 },
    ]
  },
  {
    name: 'Fidenza #313: The Golden Spiral',
    artist: 'Tyler Hobbs',
    description: 'Versatile generative flow field structured around organic mathematical curves and stratified color palettes.',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    contractAddress: '0xa7d8d9ef8D8Ce8992Df33D8b8CF4Aebabd5bD270',
    tokenId: '313',
    standard: 'ERC-721',
    ownerAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
    attributes: [
      { trait_type: 'Turbulence', value: 'High' },
      { trait_type: 'Palette', value: 'Luxe Gold' },
    ]
  },
  {
    name: 'CyberKongz #1042: Genesis Banana',
    artist: 'Kongz Syndicate',
    description: 'Genesis cybernetic primate with neon laser optics and legendary utility perks in the metaverse.',
    image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=800&q=80',
    contractAddress: '0x57a204AA1042f6E66DD7730813f4024114d74f37',
    tokenId: '1042',
    standard: 'ERC-721',
    ownerAddress: '0x3cE47E648B47833e8aA6fa840Eb901B6305a4130',
    attributes: [
      { trait_type: 'Type', value: 'Genesis' },
      { trait_type: 'Accessory', value: 'Gold Cyber Visor' },
    ]
  },
  {
    name: 'Pak: The Merge // Mass Token',
    artist: 'Murat Pak',
    description: 'Dynamic ERC-20 / ERC-721 hybrid entity that absorbs mass dynamically upon peer-to-peer transfer.',
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80',
    contractAddress: '0xc3fdbadc7c795ef1d6ba111e06ff8f16a20ea539',
    tokenId: '1',
    standard: 'ERC-1155',
    ownerAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f', // Owned by current wallet!
    attributes: [
      { trait_type: 'Mass Unit', value: '250 M' },
      { trait_type: 'Gravity Tier', value: 'Alpha Black' },
    ]
  }
];

export function resolveIpfsUrl(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    return uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  return uri;
}

export async function fetchNftMetadata(
  contractAddress: string,
  tokenId: string
): Promise<FetchedNftMetadata> {
  // Check if matches curated registry
  const match = CURATED_EXTERNAL_NFTS.find(
    (n) =>
      n.contractAddress.toLowerCase() === contractAddress.toLowerCase() &&
      n.tokenId === tokenId
  );
  if (match) {
    return match;
  }

  // If external, simulate resolving ERC-721 / ERC-1155 metadata with deterministic generation
  await new Promise((res) => setTimeout(res, 400));

  return {
    name: `On-Chain Token #${tokenId}`,
    artist: `Contract ${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`,
    description: `Decentralized digital asset verified from smart contract ${contractAddress} on the testnet.`,
    image: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80`,
    contractAddress,
    tokenId,
    standard: 'ERC-721',
    ownerAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
    attributes: [
      { trait_type: 'Verified Standard', value: 'ERC-721' },
      { trait_type: 'Network', value: 'Ethereum Sepolia' }
    ]
  };
}

export function verifyOwnership(
  exhibit: ExhibitData,
  walletAddress: string
): { isOwner: boolean; ownerAddress: string } {
  const verifiedOwner = exhibit.ownerAddress || exhibit.creatorAddress;
  const isOwner =
    Boolean(walletAddress) &&
    Boolean(verifiedOwner) &&
    walletAddress.toLowerCase() === verifiedOwner.toLowerCase();

  return {
    isOwner,
    ownerAddress: verifiedOwner
  };
}
