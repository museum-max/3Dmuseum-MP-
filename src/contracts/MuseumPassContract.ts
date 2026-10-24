import { TestnetNetwork, PassTier, ContractDeployment } from '../types';

export const SUPPORTED_NETWORKS: TestnetNetwork[] = [
  {
    id: 'firebase_testnet',
    name: 'Firebase Testnet Node (Fast Mining)',
    chainId: 31337,
    currency: 'tETH',
    rpcUrl: 'firebase://ai-studio-nftmuseumbuilder-9b4cdae1-3d4a-4c00-958c-a779418fc829',
    contractAddress: '0xMP721PassFirebaseNode9b4cdae13d4a4c00958c',
    explorerUrl: 'https://console.firebase.google.com',
    isCustomNode: true
  },
  {
    id: 'sepolia',
    name: 'Ethereum Sepolia Testnet',
    chainId: 11155111,
    currency: 'SepoliaETH',
    rpcUrl: 'https://rpc.sepolia.org',
    contractAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
    explorerUrl: 'https://sepolia.etherscan.io'
  },
  {
    id: 'amoy',
    name: 'Polygon Amoy Testnet',
    chainId: 80002,
    currency: 'POL',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    contractAddress: '0x3cE47E648B47833e8aA6fa840Eb901B6305a4130',
    explorerUrl: 'https://amoy.polygonscan.com'
  },
  {
    id: 'arbitrum_sepolia',
    name: 'Arbitrum Sepolia Testnet',
    chainId: 421614,
    currency: 'ETH',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    contractAddress: '0x19F301fD0A23Eb555A2F25a0bA0a3493E46FeE8D',
    explorerUrl: 'https://sepolia.arbiscan.io'
  }
];

export const PASS_TIER_DETAILS: Record<PassTier, {
  name: string;
  priceETH: number;
  perks: string[];
  badgeColor: string;
  vaultAccess: boolean;
}> = {
  STANDARD: {
    name: 'Standard Visitor Pass',
    priceETH: 0.01,
    perks: ['Full 3D Museum Wing Access', 'Spatial Web Audio Soundscape', 'Guestbook Verified Badge', 'Transferable'],
    badgeColor: '#38bdf8',
    vaultAccess: false
  },
  PATRON: {
    name: 'Patron VIP Pass',
    priceETH: 0.05,
    perks: ['Unlocked Obsidian VIP Vault', 'Exclusive Holographic Artifact Previews', '2x Community Vote Weight', 'Transferable'],
    badgeColor: '#a855f7',
    vaultAccess: true
  },
  CURATOR: {
    name: 'Curator Genesis Pass',
    priceETH: 0.15,
    perks: ['Unlimited VIP Vault Access', 'Direct Art Curation & Bidding', 'Genesis Golden Stanchion Emblem', 'Creator Royalty Share', 'Transferable'],
    badgeColor: '#eab308',
    vaultAccess: true
  }
};

// ================= ERC-721 SOLIDITY CONTRACT =================
export const MUSEUM_PASS_ERC721_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MuseumPass (MP) - ERC-721 Standard
 * @author Aetheria Virtual Museum Engineering Team
 * @notice Deployed on Firebase Testnet & Ethereum Sepolia.
 *         Full implementation managing token ownership, minting, and peer-to-peer transfers.
 */

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MuseumPassERC721 is IERC721, IERC721Metadata, Ownable {
    using Strings for uint256;

    string public override name = "Museum Pass";
    string public override symbol = "MP";
    string public baseURI;
    uint256 public nextTokenId = 1;

    enum PassTier { STANDARD, PATRON, CURATOR }

    struct PassData {
        PassTier tier;
        uint256 mintedAt;
        uint256 expiresAt;
    }

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => PassData) public passInfo;

    event PassMinted(address indexed minter, uint256 indexed tokenId, PassTier tier, uint256 price);
    event PassTransferred(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor(string memory _initBaseURI) Ownable(msg.sender) {
        baseURI = _initBaseURI;
    }

    function balanceOf(address owner) public view override returns (uint256) {
        require(owner != address(0), "ERC721: address zero is not a valid owner");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: invalid token ID");
        return owner;
    }

    function mintPass(PassTier _tier) external payable returns (uint256) {
        uint256 price = _tier == PassTier.CURATOR ? 0.15 ether : (_tier == PassTier.PATRON ? 0.05 ether : 0.01 ether);
        require(msg.value >= price, "MP: Insufficient ETH sent for tier");

        uint256 tokenId = nextTokenId++;
        _owners[tokenId] = msg.sender;
        _balances[msg.sender] += 1;

        passInfo[tokenId] = PassData({
            tier: _tier,
            mintedAt: block.timestamp,
            expiresAt: block.timestamp + 365 days
        });

        emit Transfer(address(0), msg.sender, tokenId);
        emit PassMinted(msg.sender, tokenId, _tier, msg.value);

        return tokenId;
    }

    function transferFrom(address from, address to, uint256 tokenId) public override {
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: caller is not token owner or approved");
        require(ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");
        require(to != address(0), "ERC721: transfer to the zero address");

        delete _tokenApprovals[tokenId];
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
        emit PassTransferred(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public override {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory) public override {
        transferFrom(from, to, tokenId);
    }

    function approve(address to, uint256 tokenId) public override {
        address owner = ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "ERC721: approve caller is not owner");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view override returns (address) {
        require(_owners[tokenId] != address(0), "ERC721: approved query for nonexistent token");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public override {
        require(operator != msg.sender, "ERC721: approve to caller");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_owners[tokenId] != address(0), "ERC721: URI query for nonexistent token");
        return string(abi.encodePacked(baseURI, tokenId.toString(), ".json"));
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}`;

// ================= ERC-1155 SOLIDITY CONTRACT =================
export const MUSEUM_PASS_ERC1155_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MuseumPass (MP) - ERC-1155 Multi-Token Standard
 * @author Aetheria Virtual Museum Engineering Team
 * @notice Multi-token pass managing fungible and semi-fungible tiers on Firebase Testnet:
 *         ID 1: Standard Pass
 *         ID 2: Patron VIP Pass
 *         ID 3: Curator Genesis Pass
 */

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MuseumPassERC1155 is IERC1155, Ownable {
    string public name = "Museum Pass Multi-Token";
    string public symbol = "MP-1155";
    string public uriBase;

    uint256 public constant PASS_STANDARD = 1;
    uint256 public constant PASS_PATRON   = 2;
    uint256 public constant PASS_CURATOR  = 3;

    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    event PassMinted(address indexed to, uint256 indexed id, uint256 amount);
    event PassTransferred(address indexed from, address indexed to, uint256 indexed id, uint256 amount);

    constructor(string memory _uri) Ownable(msg.sender) {
        uriBase = _uri;
    }

    function balanceOf(address account, uint256 id) public view override returns (uint256) {
        require(account != address(0), "ERC1155: address zero is not a valid account");
        return _balances[id][account];
    }

    function balanceOfBatch(address[] memory accounts, uint256[] memory ids)
        public view override returns (uint256[] memory)
    {
        require(accounts.length == ids.length, "ERC1155: accounts and ids length mismatch");
        uint256[] memory batchBalances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = balanceOf(accounts[i], ids[i]);
        }
        return batchBalances;
    }

    function mint(uint256 id, uint256 amount) external payable {
        require(id >= 1 && id <= 3, "ERC1155: Invalid Pass ID");
        uint256 price = id == PASS_CURATOR ? 0.15 ether : (id == PASS_PATRON ? 0.05 ether : 0.01 ether);
        require(msg.value >= price * amount, "ERC1155: Insufficient ETH sent");

        _balances[id][msg.sender] += amount;
        emit TransferSingle(msg.sender, address(0), msg.sender, id, amount);
        emit PassMinted(msg.sender, id, amount);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory
    ) public override {
        require(from == msg.sender || isApprovedForAll(from, msg.sender), "ERC1155: caller is not token owner or approved");
        require(to != address(0), "ERC1155: transfer to the zero address");
        require(_balances[id][from] >= amount, "ERC1155: insufficient balance for transfer");

        _balances[id][from] -= amount;
        _balances[id][to] += amount;

        emit TransferSingle(msg.sender, from, to, id, amount);
        emit PassTransferred(from, to, id, amount);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory
    ) public override {
        require(from == msg.sender || isApprovedForAll(from, msg.sender), "ERC1155: caller is not token owner or approved");
        require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");
        require(to != address(0), "ERC1155: transfer to the zero address");

        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];
            uint256 amount = amounts[i];
            require(_balances[id][from] >= amount, "ERC1155: insufficient balance for transfer");
            _balances[id][from] -= amount;
            _balances[id][to] += amount;
        }

        emit TransferBatch(msg.sender, from, to, ids, amounts);
    }

    function setApprovalForAll(address operator, bool approved) public override {
        require(msg.sender != operator, "ERC1155: setting approval status for self");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address account, address operator) public view override returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function uri(uint256) public view returns (string memory) {
        return uriBase;
    }
}`;

export const MUSEUM_PASS_ABI = [
  {
    inputs: [{ internalType: 'uint8', name: '_tier', type: 'uint8' }],
    name: 'mintPass',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' }
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
];

export function generateMockTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export function generateContractAddress(standard: 'ERC-721' | 'ERC-1155', deployer: string): string {
  const prefix = standard === 'ERC-721' ? '0xMP721' : '0xMP1155';
  const cleanDeployer = deployer.replace('0x', '').slice(0, 8);
  const rand = Math.floor(10000000 + Math.random() * 90000000).toString(16);
  return `${prefix}${cleanDeployer}${rand}`.slice(0, 42);
}

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
