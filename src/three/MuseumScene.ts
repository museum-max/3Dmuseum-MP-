import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createMarbleFloorTexture,
  createContactShadowTexture,
  createPedestalBumpTexture,
  createProceduralNftCanvas,
} from './proceduralArt';
import { ExhibitData, NavigationMode } from '../types';
import { sound } from '../audio/soundEffects';

const _vec3 = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();

export interface MuseumSceneCallbacks {
  onSelectExhibit: (exhibit: ExhibitData | null) => void;
  onHoverExhibit: (exhibit: ExhibitData | null) => void;
  onVaultDoorTrigger?: () => void;
  onNearbyExhibit?: (exhibit: ExhibitData | null) => void;
  onModeChange?: (mode: NavigationMode) => void;
}

interface ExhibitMeshRecord {
  collider: THREE.Object3D;
  data: ExhibitData;
  artMesh: THREE.Mesh;
  ownerBadge: THREE.Group;
  accentLight: THREE.SpotLight;
}

export class MuseumScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private callbacks: MuseumSceneCallbacks;
  private isSoftwareGl: boolean = false;

  private animationFrameId: number = 0;
  private isDisposed: boolean = false;
  private timer = new THREE.Timer();

  // Navigation Mode (ORBIT or WALK)
  private navMode: NavigationMode = 'WALK';

  // Walk physics & keyboard state
  private keysPressed: Record<string, boolean> = {};
  private walkVelocity = new THREE.Vector3();
  private walkYaw = 0; // Horizontal look angle in radians
  private walkPitch = 0; // Vertical look angle in radians
  private walkStep = 0; // Head bob accumulator
  private isSprint = false;

  // Interactive targets
  private exhibitRecords: ExhibitMeshRecord[] = [];
  private interactiveObjects: THREE.Object3D[] = [];
  private kineticSculptures: THREE.Group[] = [];
  private vaultDoors: { left: THREE.Mesh; right: THREE.Mesh; openAmount: number; targetOpen: number } | null = null;
  private currentConnectedAddress: string = '';
  private isVaultUnlocked: boolean = false;

  // Camera damping state for Orbit mode
  private cameraTargetPosition = new THREE.Vector3(0, 1.7, 7.5);
  private cameraTargetLookAt = new THREE.Vector3(0, 1.5, 0);
  private cameraCurrentLookAt = new THREE.Vector3(0, 1.5, 0);
  private isUserInteracting = false;
  private pointerDownPos = { x: 0, y: 0 };
  private spherical = { radius: 8, theta: 0, phi: Math.PI / 2.2 };
  private activeExhibit: ExhibitData | null = null;

  constructor(container: HTMLElement, callbacks: MuseumSceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#030712');
    this.scene.fog = new THREE.FogExp2('#030712', 0.024);

    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      120
    );
    this.camera.position.set(0, 1.7, 7.5);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.buildLighting();
    this.buildArchitecture();
    this.buildHeroExhibits();

    this.bindEvents();

    if (typeof document !== 'undefined') {
      this.timer.connect(document);
    }

    this.tick = this.tick.bind(this);
    this.tick();
  }

  private buildLighting() {
    const hemiLight = new THREE.HemisphereLight('#cbd5e1', '#0f172a', 0.65);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fffbeb', 1.8);
    keyLight.position.set(10, 18, 12);
    keyLight.castShadow = !this.isSoftwareGl;
    if (keyLight.shadow) {
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 45;
      const d = 18;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0001;
      keyLight.shadow.normalBias = 0;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.6);
    rimLight.position.set(-12, 10, -10);
    this.scene.add(rimLight);
  }

  private buildArchitecture() {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorTex = createMarbleFloorTexture(maxAnisotropy);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.18,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floorMesh);

    const columnCount = 8;
    const rotundaRadius = 11;
    const columnMaterial = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.35,
      metalness: 0.15,
    });
    const goldTrimMaterial = new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.2,
      metalness: 0.9,
    });

    for (let i = 0; i < columnCount; i++) {
      const angle = (i / columnCount) * Math.PI * 2;
      const x = Math.cos(angle) * rotundaRadius;
      const z = Math.sin(angle) * rotundaRadius;

      const colGroup = new THREE.Group();
      colGroup.position.set(x, 0, z);

      const baseGeo = new THREE.CylinderGeometry(0.7, 0.8, 0.4, 24);
      const baseMesh = new THREE.Mesh(baseGeo, columnMaterial);
      baseMesh.position.y = 0.2;
      baseMesh.castShadow = !this.isSoftwareGl;
      baseMesh.receiveShadow = !this.isSoftwareGl;
      colGroup.add(baseMesh);

      const ringGeo = new THREE.TorusGeometry(0.65, 0.06, 16, 32);
      const ringMesh = new THREE.Mesh(ringGeo, goldTrimMaterial);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.45;
      colGroup.add(ringMesh);

      const shaftGeo = new THREE.CylinderGeometry(0.5, 0.55, 6.2, 24);
      const shaftMesh = new THREE.Mesh(shaftGeo, columnMaterial);
      shaftMesh.position.y = 3.55;
      shaftMesh.castShadow = !this.isSoftwareGl;
      shaftMesh.receiveShadow = !this.isSoftwareGl;
      colGroup.add(shaftMesh);

      const capGeo = new THREE.CylinderGeometry(0.8, 0.55, 0.5, 24);
      const capMesh = new THREE.Mesh(capGeo, goldTrimMaterial);
      capMesh.position.y = 6.9;
      capMesh.castShadow = !this.isSoftwareGl;
      colGroup.add(capMesh);

      this.scene.add(colGroup);
    }

    const oculusGroup = new THREE.Group();
    oculusGroup.position.set(0, 7.8, 0);

    const ringOuterGeo = new THREE.TorusGeometry(rotundaRadius, 0.35, 16, 48);
    const ringOuter = new THREE.Mesh(ringOuterGeo, goldTrimMaterial);
    ringOuter.rotation.x = Math.PI / 2;
    oculusGroup.add(ringOuter);

    const skylightGeo = new THREE.CircleGeometry(rotundaRadius - 0.5, 32);
    const skylightMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const skylight = new THREE.Mesh(skylightGeo, skylightMat);
    skylight.rotation.x = Math.PI / 2;
    oculusGroup.add(skylight);

    this.scene.add(oculusGroup);

    const wallMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.7,
      metalness: 0.2,
    });
    const goldWallTrimMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      roughness: 0.2,
      metalness: 0.85,
    });

    const northWallLeft = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.8), wallMat);
    northWallLeft.position.set(-8, 3, -15);
    northWallLeft.castShadow = !this.isSoftwareGl;
    northWallLeft.receiveShadow = !this.isSoftwareGl;
    this.scene.add(northWallLeft);

    const northWallRight = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.8), wallMat);
    northWallRight.position.set(8, 3, -15);
    northWallRight.castShadow = !this.isSoftwareGl;
    northWallRight.receiveShadow = !this.isSoftwareGl;
    this.scene.add(northWallRight);

    const archHeader = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.8, 0.9), goldWallTrimMat);
    archHeader.position.set(0, 5.1, -15);
    archHeader.castShadow = !this.isSoftwareGl;
    this.scene.add(archHeader);

    const doorMat = new THREE.MeshStandardMaterial({
      color: '#1e1b4b',
      metalness: 0.9,
      roughness: 0.15,
    });
    const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.2, 0.2), doorMat);
    doorLeft.position.set(-1.4, 2.1, -15);
    doorLeft.castShadow = !this.isSoftwareGl;
    this.scene.add(doorLeft);

    const doorRight = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.2, 0.2), doorMat);
    doorRight.position.set(1.4, 2.1, -15);
    doorRight.castShadow = !this.isSoftwareGl;
    this.scene.add(doorRight);

    this.vaultDoors = {
      left: doorLeft,
      right: doorRight,
      openAmount: 0,
      targetOpen: 0,
    };

    const portalRingGeo = new THREE.TorusGeometry(1.6, 0.05, 16, 48);
    const portalRingMat = new THREE.MeshBasicMaterial({ color: '#a855f7' });
    const portalRing = new THREE.Mesh(portalRingGeo, portalRingMat);
    portalRing.position.set(0, 2.2, -14.8);
    this.scene.add(portalRing);
  }

  private buildHeroExhibits() {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createContactShadowTexture();
    const bumpTex = createPedestalBumpTexture();

    const exhibitDefinitions: ExhibitData[] = [
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

    exhibitDefinitions.forEach((exhibit) => {
      const exhibitGroup = new THREE.Group();
      exhibitGroup.position.set(...exhibit.position);
      exhibitGroup.rotation.set(...exhibit.rotation);

      const shadowGeo = new THREE.PlaneGeometry(3.2, 3.2);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.y = 0.015;
      exhibitGroup.add(shadowMesh);

      const pedestalGroup = new THREE.Group();

      const plinthGeo = new THREE.BoxGeometry(1.4, 0.25, 1.4);
      const plinthMat = new THREE.MeshStandardMaterial({
        color: '#09090b',
        roughness: 0.25,
        metalness: 0.8,
        bumpMap: bumpTex,
        bumpScale: 0.02,
      });
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.y = 0.125;
      plinth.castShadow = !this.isSoftwareGl;
      plinth.receiveShadow = !this.isSoftwareGl;
      pedestalGroup.add(plinth);

      const collarGeo = new THREE.BoxGeometry(1.25, 0.08, 1.25);
      const collarMat = new THREE.MeshStandardMaterial({
        color: '#d97706',
        roughness: 0.18,
        metalness: 0.95,
      });
      const collar = new THREE.Mesh(collarGeo, collarMat);
      collar.position.y = 0.29;
      pedestalGroup.add(collar);

      const colGeo = new THREE.BoxGeometry(1.1, 0.85, 1.1);
      const colMat = new THREE.MeshStandardMaterial({
        color: '#18181b',
        roughness: 0.15,
        metalness: 0.5,
      });
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.y = 0.75;
      col.castShadow = !this.isSoftwareGl;
      col.receiveShadow = !this.isSoftwareGl;
      pedestalGroup.add(col);

      const capGeo = new THREE.BoxGeometry(1.2, 0.08, 1.2);
      const cap = new THREE.Mesh(capGeo, collarMat);
      cap.position.y = 1.21;
      pedestalGroup.add(cap);

      const glassGeo = new THREE.BoxGeometry(1.15, 1.5, 1.15);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      });
      const glassVitrine = new THREE.Mesh(glassGeo, glassMat);
      glassVitrine.position.y = 2.0;
      pedestalGroup.add(glassVitrine);

      exhibitGroup.add(pedestalGroup);

      const nftTexture = createProceduralNftCanvas(exhibit.id, maxAnisotropy);
      const canvasGeo = new THREE.BoxGeometry(1.5, 1.5, 0.08);
      const frameMat = new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        roughness: 0.2,
        metalness: 0.9,
      });
      const artMat = new THREE.MeshStandardMaterial({
        map: nftTexture,
        roughness: 0.25,
        metalness: 0.15,
      });

      const materials = [frameMat, frameMat, frameMat, frameMat, artMat, artMat];
      const framedArt = new THREE.Mesh(canvasGeo, materials);
      framedArt.position.y = 2.0;
      framedArt.castShadow = !this.isSoftwareGl;
      exhibitGroup.add(framedArt);

      const kineticGroup = new THREE.Group();
      kineticGroup.position.set(0, 2.0, 0);

      const gyroRing1 = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.025, 16, 48),
        new THREE.MeshStandardMaterial({
          color: exhibit.accentColor,
          roughness: 0.2,
          metalness: 0.9,
          emissive: exhibit.accentColor,
          emissiveIntensity: 0.35,
        })
      );
      kineticGroup.add(gyroRing1);

      const gyroRing2 = new THREE.Mesh(
        new THREE.TorusGeometry(1.22, 0.02, 16, 48),
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          roughness: 0.1,
          metalness: 0.95,
        })
      );
      gyroRing2.rotation.x = Math.PI / 3;
      kineticGroup.add(gyroRing2);

      exhibitGroup.add(kineticGroup);
      this.kineticSculptures.push(kineticGroup);

      // 3D Holographic "VERIFIED OWNER" Badge
      const badgeGroup = new THREE.Group();
      badgeGroup.position.set(0, 3.15, 0);

      const haloGeo = new THREE.TorusGeometry(0.42, 0.025, 16, 32);
      const haloMat = new THREE.MeshStandardMaterial({
        color: '#facc15',
        emissive: '#eab308',
        emissiveIntensity: 0.6,
        roughness: 0.1,
        metalness: 0.9,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      badgeGroup.add(halo);

      const diamondGeo = new THREE.OctahedronGeometry(0.18, 0);
      const diamondMat = new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#f59e0b',
        emissiveIntensity: 0.8,
        metalness: 0.95,
      });
      const diamond = new THREE.Mesh(diamondGeo, diamondMat);
      badgeGroup.add(diamond);

      badgeGroup.visible = false;
      exhibitGroup.add(badgeGroup);

      const spotLight = new THREE.SpotLight(
        '#ffffff',
        3.5,
        15,
        Math.PI / 5,
        0.3,
        1.5
      );
      spotLight.position.set(
        exhibit.position[0],
        7.5,
        exhibit.position[2] + 2.5
      );
      spotLight.target = framedArt;
      spotLight.castShadow = false;
      this.scene.add(spotLight);

      const colliderGeo = new THREE.BoxGeometry(2.2, 3.2, 2.2);
      const colliderMat = new THREE.MeshBasicMaterial({ visible: false });
      const colliderMesh = new THREE.Mesh(colliderGeo, colliderMat);
      colliderMesh.position.y = 1.6;
      exhibitGroup.add(colliderMesh);

      const record: ExhibitMeshRecord = {
        collider: colliderMesh,
        data: exhibit,
        artMesh: framedArt,
        ownerBadge: badgeGroup,
        accentLight: spotLight,
      };

      this.exhibitRecords.push(record);
      this.interactiveObjects.push(colliderMesh);
      this.scene.add(exhibitGroup);
    });
  }

  public setNavigationMode(mode: NavigationMode) {
    this.navMode = mode;
    sound.playClick();
    if (mode === 'WALK') {
      this.camera.position.y = 1.7;
      // Derive walkYaw from camera look direction
      _targetLook.subVectors(this.cameraCurrentLookAt, this.camera.position);
      this.walkYaw = Math.atan2(-_targetLook.x, -_targetLook.z);
    }
    if (this.callbacks.onModeChange) {
      this.callbacks.onModeChange(mode);
    }
  }

  public getNavigationMode(): NavigationMode {
    return this.navMode;
  }

  // Virtual Joypad Direction Trigger for Mobile / Onscreen Buttons
  public setVirtualKey(key: string, pressed: boolean) {
    this.keysPressed[key.toLowerCase()] = pressed;
  }

  public updateOwnershipState(connectedAddress: string) {
    this.currentConnectedAddress = connectedAddress;
    this.exhibitRecords.forEach((rec) => {
      const owner = rec.data.ownerAddress || rec.data.creatorAddress;
      const isOwner =
        Boolean(connectedAddress) &&
        Boolean(owner) &&
        connectedAddress.toLowerCase() === owner.toLowerCase();

      rec.ownerBadge.visible = isOwner;

      if (isOwner) {
        rec.accentLight.intensity = 5.0;
        rec.accentLight.color.set('#fef08a');
      } else {
        rec.accentLight.intensity = 3.5;
        rec.accentLight.color.set('#ffffff');
      }
    });
  }

  public updateExhibits(updatedList: ExhibitData[]) {
    updatedList.forEach((newData) => {
      const rec = this.exhibitRecords.find((r) => r.data.id === newData.id);
      if (rec) {
        rec.data = { ...rec.data, ...newData };
        if (newData.imageUrl && newData.imageUrl !== '') {
          this.loadCustomTexture(rec, newData.imageUrl, newData.title, newData.artist);
        }
      }
    });

    if (this.currentConnectedAddress) {
      this.updateOwnershipState(this.currentConnectedAddress);
    }
  }

  private loadCustomTexture(
    rec: ExhibitMeshRecord,
    imageUrl: string,
    title: string,
    artist: string
  ) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (this.isDisposed) return;
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 60, 60, 904, 820);

      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 36px monospace';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 8;
      ctx.fillText(title.toUpperCase().slice(0, 32), 60, 930);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px monospace';
      ctx.fillText(artist.toUpperCase().slice(0, 40), 60, 970);

      const newTexture = new THREE.CanvasTexture(canvas);
      newTexture.colorSpace = THREE.SRGBColorSpace;
      newTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

      if (Array.isArray(rec.artMesh.material)) {
        const mat = rec.artMesh.material[4] as THREE.MeshStandardMaterial;
        if (mat) {
          mat.map = newTexture;
          mat.needsUpdate = true;
        }
        const matBack = rec.artMesh.material[5] as THREE.MeshStandardMaterial;
        if (matBack) {
          matBack.map = newTexture;
          matBack.needsUpdate = true;
        }
      }
    };
    img.onerror = () => {
      console.warn('Could not load custom external NFT image; keeping procedural canvas texture.');
    };
    img.src = imageUrl;
  }

  public setVaultUnlocked(unlocked: boolean) {
    this.isVaultUnlocked = unlocked;
    if (this.vaultDoors) {
      this.vaultDoors.targetOpen = unlocked ? 2.6 : 0;
      if (unlocked) {
        sound.playVaultUnlock();
      }
    }
  }

  public focusExhibit(exhibit: ExhibitData) {
    this.activeExhibit = exhibit;
    sound.playInspect();

    const offsetDistance = 3.6;
    const rad = exhibit.rotation[1];
    const targetX = exhibit.position[0] + Math.sin(rad) * offsetDistance;
    const targetZ = exhibit.position[2] + Math.cos(rad) * offsetDistance;

    this.cameraTargetPosition.set(targetX, 2.0, targetZ);
    this.cameraTargetLookAt.set(
      exhibit.position[0],
      2.0,
      exhibit.position[2]
    );

    // If in walk mode, place avatar facing exhibit
    if (this.navMode === 'WALK') {
      this.camera.position.set(targetX, 1.7, targetZ);
      this.walkYaw = Math.atan2(
        -(exhibit.position[0] - targetX),
        -(exhibit.position[2] - targetZ)
      );
      this.walkPitch = 0.05;
    }

    this.callbacks.onSelectExhibit(exhibit);
  }

  public resetView() {
    this.activeExhibit = null;
    sound.playClick();
    this.cameraTargetPosition.set(0, 1.8, 8.5);
    this.cameraTargetLookAt.set(0, 1.5, 0);
    this.walkYaw = 0;
    this.walkPitch = 0;
    this.callbacks.onSelectExhibit(null);
  }

  public jumpToRoom(room: 'rotunda' | 'renaissance' | 'cyberpunk' | 'vault') {
    sound.playClick();
    if (room === 'rotunda') {
      this.cameraTargetPosition.set(0, 1.7, 7.5);
      this.cameraTargetLookAt.set(0, 1.8, 0);
      this.walkYaw = 0;
    } else if (room === 'renaissance') {
      this.cameraTargetPosition.set(-6.5, 1.7, 0.5);
      this.cameraTargetLookAt.set(-6.5, 1.9, -3.5);
      this.walkYaw = 0;
    } else if (room === 'cyberpunk') {
      this.cameraTargetPosition.set(6.5, 1.7, 0.5);
      this.cameraTargetLookAt.set(6.5, 1.9, -3.5);
      this.walkYaw = 0;
    } else {
      this.cameraTargetPosition.set(0, 1.7, -11.5);
      this.cameraTargetLookAt.set(0, 1.9, -19.5);
      this.walkYaw = 0;
      if (this.callbacks.onVaultDoorTrigger) {
        this.callbacks.onVaultDoorTrigger();
      }
    }

    if (this.navMode === 'WALK') {
      this.camera.position.copy(this.cameraTargetPosition);
      this.camera.position.y = 1.7;
    }
  }

  private bindEvents() {
    const el = this.renderer.domElement;

    // Keyboard WASD & Arrow listeners
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const key = e.key.toLowerCase();
      this.keysPressed[key] = true;

      if (e.key === 'Shift') this.isSprint = true;

      // 'E' key to inspect nearest exhibit when walking
      if (key === 'e' && this.navMode === 'WALK') {
        const nearest = this.getNearestExhibit();
        if (nearest && nearest.distance < 3.2) {
          this.focusExhibit(nearest.record.data);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keysPressed[key] = false;
      if (e.key === 'Shift') this.isSprint = false;
    });

    // Pointer Drag & Look
    el.addEventListener('pointerdown', (e) => {
      this.isUserInteracting = true;
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isUserInteracting) {
        const dx = Math.abs(e.clientX - this.pointerDownPos.x);
        const dy = Math.abs(e.clientY - this.pointerDownPos.y);

        if (dx < 6 && dy < 6) {
          this.handleClick(e);
        }
      }
      this.isUserInteracting = false;
    });

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isUserInteracting) {
        const deltaX = (e.clientX - this.pointerDownPos.x);
        const deltaY = (e.clientY - this.pointerDownPos.y);
        this.pointerDownPos = { x: e.clientX, y: e.clientY };

        if (this.navMode === 'WALK') {
          // Look around in first-person walking mode
          this.walkYaw -= deltaX * 0.0035;
          this.walkPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.walkPitch - deltaY * 0.0035));
        } else {
          // Orbit drag
          this.spherical.theta -= deltaX * 0.003;
          this.spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.05, this.spherical.phi - deltaY * 0.003));

          const radius = this.cameraTargetPosition.distanceTo(this.cameraTargetLookAt);
          this.cameraTargetPosition.x = this.cameraTargetLookAt.x + radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
          this.cameraTargetPosition.y = this.cameraTargetLookAt.y + radius * Math.cos(this.spherical.phi);
          this.cameraTargetPosition.z = this.cameraTargetLookAt.z + radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
        }
      } else {
        _raycaster.setFromCamera(_pointer, this.camera);
        const intersects = _raycaster.intersectObjects(this.interactiveObjects, false);
        if (intersects.length > 0) {
          const hit = this.exhibitRecords.find((m) => m.collider === intersects[0].object);
          if (hit) {
            el.style.cursor = 'pointer';
            this.callbacks.onHoverExhibit(hit.data);
            return;
          }
        }
        el.style.cursor = 'default';
        this.callbacks.onHoverExhibit(null);
      }
    });

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private handleClick(e: MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_pointer, this.camera);
    const intersects = _raycaster.intersectObjects(this.interactiveObjects, false);

    if (intersects.length > 0) {
      const hit = this.exhibitRecords.find((m) => m.collider === intersects[0].object);
      if (hit) {
        this.focusExhibit(hit.data);
      }
    }
  }

  private getNearestExhibit(): { record: ExhibitMeshRecord; distance: number } | null {
    let nearest: ExhibitMeshRecord | null = null;
    let minD = Infinity;

    this.exhibitRecords.forEach((rec) => {
      const d = Math.hypot(
        this.camera.position.x - rec.data.position[0],
        this.camera.position.z - rec.data.position[2]
      );
      if (d < minD) {
        minD = d;
        nearest = rec;
      }
    });

    if (nearest) return { record: nearest, distance: minD };
    return null;
  }

  private updateWalkPhysics(delta: number) {
    _moveDir.set(0, 0, 0);

    const forward = this.keysPressed['w'] || this.keysPressed['arrowup'];
    const backward = this.keysPressed['s'] || this.keysPressed['arrowdown'];
    const left = this.keysPressed['a'] || this.keysPressed['arrowleft'];
    const right = this.keysPressed['d'] || this.keysPressed['arrowright'];

    if (forward) _moveDir.z -= 1;
    if (backward) _moveDir.z += 1;
    if (left) _moveDir.x -= 1;
    if (right) _moveDir.x += 1;

    const isMoving = _moveDir.lengthSq() > 0;

    if (isMoving) {
      _moveDir.normalize();

      // Transform move vector relative to camera walkYaw
      const cos = Math.cos(this.walkYaw);
      const sin = Math.sin(this.walkYaw);

      const worldX = _moveDir.x * cos + _moveDir.z * sin;
      const worldZ = -_moveDir.x * sin + _moveDir.z * cos;

      const speed = this.isSprint ? 7.5 : 4.5;
      this.walkVelocity.x = worldX * speed;
      this.walkVelocity.z = worldZ * speed;

      // Accumulate head bobbing
      this.walkStep += delta * (this.isSprint ? 14 : 9);
    } else {
      // Damping
      this.walkVelocity.x = THREE.MathUtils.damp(this.walkVelocity.x, 0, 8, delta);
      this.walkVelocity.z = THREE.MathUtils.damp(this.walkVelocity.z, 0, 8, delta);
    }

    // Apply movement
    this.camera.position.x += this.walkVelocity.x * delta;
    this.camera.position.z += this.walkVelocity.z * delta;

    // Head bobbing calculation
    const bobOffset = isMoving ? Math.sin(this.walkStep) * 0.045 : 0;
    this.camera.position.y = 1.7 + bobOffset;

    // Natural perimeter boundary clamping (museum floor boundaries)
    this.camera.position.x = Math.max(-23, Math.min(23, this.camera.position.x));

    // Vault wall collision: if vault is locked, cannot pass through z = -14.2
    const minZ = this.isVaultUnlocked ? -22.5 : -14.0;
    if (this.camera.position.z < minZ) {
      this.camera.position.z = minZ;
      if (!this.isVaultUnlocked && this.callbacks.onVaultDoorTrigger) {
        this.callbacks.onVaultDoorTrigger();
      }
    }
    this.camera.position.z = Math.min(23, this.camera.position.z);

    // Compute look-at point from yaw and pitch
    const lookTargetX = this.camera.position.x - Math.sin(this.walkYaw) * Math.cos(this.walkPitch);
    const lookTargetY = this.camera.position.y + Math.sin(this.walkPitch);
    const lookTargetZ = this.camera.position.z - Math.cos(this.walkYaw) * Math.cos(this.walkPitch);

    this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);

    // Proximity check for notification
    const nearest = this.getNearestExhibit();
    if (this.callbacks.onNearbyExhibit) {
      if (nearest && nearest.distance < 3.2) {
        this.callbacks.onNearbyExhibit(nearest.record.data);
      } else {
        this.callbacks.onNearbyExhibit(null);
      }
    }
  }

  private onResize() {
    if (!this.container || this.isDisposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private tick(timestamp?: number) {
    if (this.isDisposed) return;

    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.1);
    const elapsed = this.timer.getElapsed();

    this.kineticSculptures.forEach((grp, idx) => {
      grp.rotation.y = elapsed * (0.35 + idx * 0.05);
      grp.rotation.z = Math.sin(elapsed * 0.5 + idx) * 0.15;
    });

    this.exhibitRecords.forEach((rec) => {
      if (rec.ownerBadge.visible) {
        rec.ownerBadge.rotation.y = elapsed * 1.5;
        rec.ownerBadge.position.y = 3.15 + Math.sin(elapsed * 2.5) * 0.08;
      }
    });

    if (this.vaultDoors) {
      this.vaultDoors.openAmount = THREE.MathUtils.damp(
        this.vaultDoors.openAmount,
        this.vaultDoors.targetOpen,
        3.5,
        delta
      );
      this.vaultDoors.left.position.x = -1.4 - this.vaultDoors.openAmount;
      this.vaultDoors.right.position.x = 1.4 + this.vaultDoors.openAmount;
    }

    if (this.navMode === 'WALK') {
      this.updateWalkPhysics(delta);
    } else {
      // ORBIT Mode Camera Damping
      const dampSpeed = 3.5;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.cameraTargetPosition.x, dampSpeed, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.cameraTargetPosition.y, dampSpeed, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.cameraTargetPosition.z, dampSpeed, delta);

      this.cameraCurrentLookAt.x = THREE.MathUtils.damp(this.cameraCurrentLookAt.x, this.cameraTargetLookAt.x, dampSpeed, delta);
      this.cameraCurrentLookAt.y = THREE.MathUtils.damp(this.cameraCurrentLookAt.y, this.cameraTargetLookAt.y, dampSpeed, delta);
      this.cameraCurrentLookAt.z = THREE.MathUtils.damp(this.cameraCurrentLookAt.z, this.cameraTargetLookAt.z, dampSpeed, delta);

      this.camera.lookAt(this.cameraCurrentLookAt);
    }

    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onResize.bind(this));
    this.timer.dispose();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
