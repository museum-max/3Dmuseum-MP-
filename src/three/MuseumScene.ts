import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createMarbleFloorTexture,
  createContactShadowTexture,
  createPedestalBumpTexture,
  createProceduralNftCanvas,
} from './proceduralArt';
import { ExhibitData, NavigationMode, PlayerTransform } from '../types';
import { sound } from '../audio/soundEffects';
import { WorldCorePlanetNetwork } from './WorldCorePlanetNetwork';
import { CryptoChainInfo } from './cryptoLogos';

const _vec3 = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();

export interface MuseumSceneCallbacks {
  onSelectExhibit: (exhibit: ExhibitData | null) => void;
  onHoverExhibit: (exhibit: ExhibitData | null) => void;
  onSelectCryptoChain?: (chain: CryptoChainInfo | null) => void;
  onHoverCryptoChain?: (chain: CryptoChainInfo | null) => void;
  onVaultDoorTrigger?: () => void;
  onNearbyExhibit?: (exhibit: ExhibitData | null) => void;
  onModeChange?: (mode: NavigationMode) => void;
  onPlayerTransform?: (transform: PlayerTransform) => void;
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
  private wallColliders: { collider: THREE.Object3D; exhibitId: string }[] = [];
  private kineticSculptures: THREE.Group[] = [];
  private vaultDoors: { left: THREE.Mesh; right: THREE.Mesh; openAmount: number; targetOpen: number } | null = null;
  private currentConnectedAddress: string = '';
  private isVaultUnlocked: boolean = false;
  private playerListeners: Set<(transform: PlayerTransform) => void> = new Set();
  private planetNetwork: WorldCorePlanetNetwork | null = null;

  // Camera damping state for Orbit mode
  private cameraTargetPosition = new THREE.Vector3(0, 1.7, 7.5);
  private cameraTargetLookAt = new THREE.Vector3(0, 1.5, 0);
  private cameraCurrentLookAt = new THREE.Vector3(0, 1.5, 0);
  private activeLookPointerId: number | null = null;
  private virtualJoystickVector = { x: 0, y: 0 };
  private isVirtualSprint = false;
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

    // Central WORLD CORE Planetary Network Monument with 12 Mini Crypto Logo Satellites
    this.planetNetwork = new WorldCorePlanetNetwork(this.scene, this.isSoftwareGl);
    this.interactiveObjects.push(...this.planetNetwork.interactiveObjects);

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

    const northWallRight = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 0.8), wallMat);
    northWallRight.position.set(10.8, 3, -15);
    northWallRight.castShadow = !this.isSoftwareGl;
    northWallRight.receiveShadow = !this.isSoftwareGl;
    this.scene.add(northWallRight);

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 30), wallMat);
    eastWall.position.set(18.8, 3, 0);
    eastWall.castShadow = !this.isSoftwareGl;
    eastWall.receiveShadow = !this.isSoftwareGl;
    this.scene.add(eastWall);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 30), wallMat);
    westWall.position.set(-18.8, 3, 0);
    westWall.castShadow = !this.isSoftwareGl;
    westWall.receiveShadow = !this.isSoftwareGl;
    this.scene.add(westWall);

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

    // Architectural Street Art Concrete Wall Mural: "KUPAL Graffiti"
    const muralGeo = new THREE.PlaneGeometry(6.4, 4.26);
    const textureLoader = new THREE.TextureLoader();
    const graffitiTex = textureLoader.load('/assets/aistudio/KUPAL_Graffiti_on_Concrete_87cdb948.png');
    graffitiTex.colorSpace = THREE.SRGBColorSpace;
    graffitiTex.anisotropy = maxAnisotropy;

    const muralMat = new THREE.MeshStandardMaterial({
      map: graffitiTex,
      roughness: 0.88,
      metalness: 0.08,
    });
    const muralMesh = new THREE.Mesh(muralGeo, muralMat);
    muralMesh.position.set(-8, 3.1, -14.58);
    muralMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(muralMesh);

    // Architectural Bronze Trim Frame
    const frameBorderMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.25,
      metalness: 0.85,
    });
    const muralFrameTop = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.12, 0.12), frameBorderMat);
    muralFrameTop.position.set(-8, 5.29, -14.55);
    this.scene.add(muralFrameTop);

    const muralFrameBottom = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.12, 0.12), frameBorderMat);
    muralFrameBottom.position.set(-8, 0.91, -14.55);
    this.scene.add(muralFrameBottom);

    const muralFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 0.12), frameBorderMat);
    muralFrameLeft.position.set(-11.25, 3.1, -14.55);
    this.scene.add(muralFrameLeft);

    const muralFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 0.12), frameBorderMat);
    muralFrameRight.position.set(-4.75, 3.1, -14.55);
    this.scene.add(muralFrameRight);

    // Dedicated high-intensity museum spotlight illuminating the graffiti mural
    const muralSpotLight = new THREE.SpotLight('#fed7aa', 5.5, 20, Math.PI / 4, 0.4);
    muralSpotLight.position.set(-8, 5.8, -10.5);
    muralSpotLight.target = muralMesh;
    this.scene.add(muralSpotLight);

    // Interactive Wall Collider for KUPAL Graffiti
    const kupalWallCollider = new THREE.Mesh(
      new THREE.BoxGeometry(6.6, 4.5, 0.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    kupalWallCollider.position.set(-8, 3.1, -14.4);
    this.scene.add(kupalWallCollider);
    this.interactiveObjects.push(kupalWallCollider);
    this.wallColliders.push({ collider: kupalWallCollider, exhibitId: 'nft-1' });

    // Architectural Futuristic Masterpiece Wall Installation: "WORLD core — Genesis #001" (1:1 Square Masterpiece)
    const worldCoreGeo = new THREE.PlaneGeometry(3.8, 3.8);
    const worldCoreTex = textureLoader.load('/assets/aistudio/Futuristic_Chrome_World_Core_Emblem_4fe37529.png');
    worldCoreTex.colorSpace = THREE.SRGBColorSpace;
    worldCoreTex.anisotropy = maxAnisotropy;

    const worldCoreMat = new THREE.MeshStandardMaterial({
      map: worldCoreTex,
      roughness: 0.18,
      metalness: 0.45,
    });
    const worldCoreMesh = new THREE.Mesh(worldCoreGeo, worldCoreMat);
    worldCoreMesh.position.set(6.6, 3.1, -14.58);
    worldCoreMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(worldCoreMesh);

    // Frame materials
    const chromeFrameMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.08,
      metalness: 0.98,
    });
    const cyberGlowBezelMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.9,
    });

    // Genesis #001 - Outer Chrome Frame (4.08m x 4.08m)
    const wcFrameTop = new THREE.Mesh(new THREE.BoxGeometry(4.08, 0.14, 0.14), chromeFrameMat);
    wcFrameTop.position.set(6.6, 5.07, -14.54);
    this.scene.add(wcFrameTop);

    const wcFrameBottom = new THREE.Mesh(new THREE.BoxGeometry(4.08, 0.14, 0.14), chromeFrameMat);
    wcFrameBottom.position.set(6.6, 1.13, -14.54);
    this.scene.add(wcFrameBottom);

    const wcFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.08, 0.14), chromeFrameMat);
    wcFrameLeft.position.set(4.63, 3.1, -14.54);
    this.scene.add(wcFrameLeft);

    const wcFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.08, 0.14), chromeFrameMat);
    wcFrameRight.position.set(8.57, 3.1, -14.54);
    this.scene.add(wcFrameRight);

    // Genesis #001 - Inner Glowing Electric Blue Neon Bezel (3.84m x 3.84m)
    const wcBezelTop = new THREE.Mesh(new THREE.BoxGeometry(3.84, 0.04, 0.06), cyberGlowBezelMat);
    wcBezelTop.position.set(6.6, 5.02, -14.55);
    this.scene.add(wcBezelTop);

    const wcBezelBottom = new THREE.Mesh(new THREE.BoxGeometry(3.84, 0.04, 0.06), cyberGlowBezelMat);
    wcBezelBottom.position.set(6.6, 1.18, -14.55);
    this.scene.add(wcBezelBottom);

    const wcBezelLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.84, 0.06), cyberGlowBezelMat);
    wcBezelLeft.position.set(4.68, 3.1, -14.55);
    this.scene.add(wcBezelLeft);

    const wcBezelRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.84, 0.06), cyberGlowBezelMat);
    wcBezelRight.position.set(8.52, 3.1, -14.55);
    this.scene.add(wcBezelRight);

    // Dedicated high-intensity spotlight for Genesis #001
    const worldCoreSpotLight = new THREE.SpotLight('#bae6fd', 6.5, 22, Math.PI / 4, 0.35);
    worldCoreSpotLight.position.set(6.6, 5.8, -10.5);
    worldCoreSpotLight.target = worldCoreMesh;
    this.scene.add(worldCoreSpotLight);

    // Subtle electric blue ambient wall glow wash
    const worldCoreAmbientGlow = new THREE.PointLight('#38bdf8', 2.2, 7);
    worldCoreAmbientGlow.position.set(6.6, 3.1, -14.3);
    this.scene.add(worldCoreAmbientGlow);

    // Museum Wall Placard for WORLD core — Genesis #001
    const plaqueCanvas = document.createElement('canvas');
    plaqueCanvas.width = 512;
    plaqueCanvas.height = 256;
    const pctx = plaqueCanvas.getContext('2d')!;
    pctx.fillStyle = '#090d16';
    pctx.fillRect(0, 0, 512, 256);
    pctx.strokeStyle = '#38bdf8';
    pctx.lineWidth = 6;
    pctx.strokeRect(6, 6, 500, 244);

    pctx.fillStyle = '#38bdf8';
    pctx.font = 'bold 28px monospace';
    pctx.fillText('WORLD CORE — GENESIS #001', 24, 60);

    pctx.fillStyle = '#f1f5f9';
    pctx.font = '20px monospace';
    pctx.fillText('WORLD CORE FOUNDATION • FOUNDER EDITION', 24, 110);

    pctx.fillStyle = '#94a3b8';
    pctx.font = '16px monospace';
    pctx.fillText('STYLE: 3D METALLIC // COLOR: BLUE & SILVER', 24, 155);

    pctx.fillStyle = '#f59e0b';
    pctx.font = '14px monospace';
    pctx.fillText('IPFS: world-core-genesis-001.png', 24, 205);

    const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
    plaqueTex.colorSpace = THREE.SRGBColorSpace;

    const plaqueMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.8),
      new THREE.MeshStandardMaterial({
        map: plaqueTex,
        roughness: 0.3,
        metalness: 0.7,
      })
    );
    plaqueMesh.position.set(6.6, 0.45, -14.56);
    this.scene.add(plaqueMesh);

    // Interactive Wall Collider for WORLD core — Genesis #001
    const wcWallCollider = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 4.2, 0.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    wcWallCollider.position.set(6.6, 3.1, -14.3);
    this.scene.add(wcWallCollider);
    this.interactiveObjects.push(wcWallCollider);
    this.wallColliders.push({ collider: wcWallCollider, exhibitId: 'nft-genesis' });

    // Architectural Futuristic Masterpiece Wall Installation: "WORLD core — The Connector of All Crypto" (1:1 Square Masterpiece)
    const connectorGeo = new THREE.PlaneGeometry(3.8, 3.8);
    const connectorTex = textureLoader.load('/assets/aistudio/world-core-connector-001.png');
    connectorTex.colorSpace = THREE.SRGBColorSpace;
    connectorTex.anisotropy = maxAnisotropy;

    const connectorMat = new THREE.MeshStandardMaterial({
      map: connectorTex,
      roughness: 0.18,
      metalness: 0.45,
    });
    const connectorMesh = new THREE.Mesh(connectorGeo, connectorMat);
    connectorMesh.position.set(13.8, 3.1, -14.58);
    connectorMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(connectorMesh);

    // Connector - Outer Chrome Frame (4.08m x 4.08m)
    const connFrameTop = new THREE.Mesh(new THREE.BoxGeometry(4.08, 0.14, 0.14), chromeFrameMat);
    connFrameTop.position.set(13.8, 5.07, -14.54);
    this.scene.add(connFrameTop);

    const connFrameBottom = new THREE.Mesh(new THREE.BoxGeometry(4.08, 0.14, 0.14), chromeFrameMat);
    connFrameBottom.position.set(13.8, 1.13, -14.54);
    this.scene.add(connFrameBottom);

    const connFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.08, 0.14), chromeFrameMat);
    connFrameLeft.position.set(11.83, 3.1, -14.54);
    this.scene.add(connFrameLeft);

    const connFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.08, 0.14), chromeFrameMat);
    connFrameRight.position.set(15.77, 3.1, -14.54);
    this.scene.add(connFrameRight);

    // Connector - Inner Glowing Electric Blue Neon Bezel (3.84m x 3.84m)
    const connBezelTop = new THREE.Mesh(new THREE.BoxGeometry(3.84, 0.04, 0.06), cyberGlowBezelMat);
    connBezelTop.position.set(13.8, 5.02, -14.55);
    this.scene.add(connBezelTop);

    const connBezelBottom = new THREE.Mesh(new THREE.BoxGeometry(3.84, 0.04, 0.06), cyberGlowBezelMat);
    connBezelBottom.position.set(13.8, 1.18, -14.55);
    this.scene.add(connBezelBottom);

    const connBezelLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.84, 0.06), cyberGlowBezelMat);
    connBezelLeft.position.set(11.88, 3.1, -14.55);
    this.scene.add(connBezelLeft);

    const connBezelRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.84, 0.06), cyberGlowBezelMat);
    connBezelRight.position.set(15.72, 3.1, -14.55);
    this.scene.add(connBezelRight);

    // Dedicated high-intensity spotlight for The Connector of All Crypto
    const connectorSpotLight = new THREE.SpotLight('#bae6fd', 6.5, 22, Math.PI / 4, 0.35);
    connectorSpotLight.position.set(13.8, 5.8, -10.5);
    connectorSpotLight.target = connectorMesh;
    this.scene.add(connectorSpotLight);

    // Subtle electric blue ambient wall glow wash
    const connectorAmbientGlow = new THREE.PointLight('#38bdf8', 2.2, 7);
    connectorAmbientGlow.position.set(13.8, 3.1, -14.3);
    this.scene.add(connectorAmbientGlow);

    // Museum Wall Placard for WORLD core — The Connector of All Crypto
    const connPlaqueCanvas = document.createElement('canvas');
    connPlaqueCanvas.width = 512;
    connPlaqueCanvas.height = 256;
    const cctx = connPlaqueCanvas.getContext('2d')!;
    cctx.fillStyle = '#090d16';
    cctx.fillRect(0, 0, 512, 256);
    cctx.strokeStyle = '#38bdf8';
    cctx.lineWidth = 6;
    cctx.strokeRect(6, 6, 500, 244);

    cctx.fillStyle = '#38bdf8';
    cctx.font = 'bold 24px monospace';
    cctx.fillText('WORLD CORE — CONNECTOR OF ALL CRYPTO', 20, 55);

    cctx.fillStyle = '#f1f5f9';
    cctx.font = '19px monospace';
    cctx.fillText('WORLD CORE FOUNDATION • GENESIS CONCEPT', 20, 105);

    cctx.fillStyle = '#94a3b8';
    cctx.font = '15px monospace';
    cctx.fillText('THEME: CONNECTOR // VISION: ONE WORLD, ALL CHAINS', 20, 150);

    cctx.fillStyle = '#f59e0b';
    cctx.font = '14px monospace';
    cctx.fillText('STYLE: 3D METALLIC // IPFS VERIFIED', 20, 200);

    const connPlaqueTex = new THREE.CanvasTexture(connPlaqueCanvas);
    connPlaqueTex.colorSpace = THREE.SRGBColorSpace;

    const connPlaqueMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.8),
      new THREE.MeshStandardMaterial({
        map: connPlaqueTex,
        roughness: 0.3,
        metalness: 0.7,
      })
    );
    connPlaqueMesh.position.set(13.8, 0.45, -14.56);
    this.scene.add(connPlaqueMesh);

    // Interactive Wall Collider for WORLD core — The Connector of All Crypto
    const connWallCollider = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 4.2, 0.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    connWallCollider.position.set(13.8, 3.1, -14.3);
    this.scene.add(connWallCollider);
    this.interactiveObjects.push(connWallCollider);
    this.wallColliders.push({ collider: connWallCollider, exhibitId: 'nft-world-connector' });

    // Architectural Vintage Noir Masterpiece Wall Installation: "Old Gangster #001" (1:1 Square Masterpiece)
    const gangsterGeo = new THREE.PlaneGeometry(3.8, 3.8);
    const gangsterTex = textureLoader.load('/assets/aistudio/Rainy_Noir_Gangster_Portrait_3202bd82.png');
    gangsterTex.colorSpace = THREE.SRGBColorSpace;
    gangsterTex.anisotropy = maxAnisotropy;

    const gangsterMat = new THREE.MeshStandardMaterial({
      map: gangsterTex,
      roughness: 0.22,
      metalness: 0.35,
    });
    const gangsterMesh = new THREE.Mesh(gangsterGeo, gangsterMat);
    gangsterMesh.position.set(18.38, 3.1, 0);
    gangsterMesh.rotation.y = -Math.PI / 2;
    gangsterMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(gangsterMesh);

    // Frame materials: Vintage Antique Gold & Warm Amber Glow
    const antiqueGoldFrameMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.15,
      metalness: 0.95,
    });
    const amberGlowBezelMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#d97706',
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.9,
    });

    // Old Gangster #001 - Outer Frame (4.08m x 4.08m)
    const gFrameTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.08), antiqueGoldFrameMat);
    gFrameTop.position.set(18.34, 5.07, 0);
    this.scene.add(gFrameTop);

    const gFrameBottom = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.08), antiqueGoldFrameMat);
    gFrameBottom.position.set(18.34, 1.13, 0);
    this.scene.add(gFrameBottom);

    const gFrameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.08, 0.14), antiqueGoldFrameMat);
    gFrameLeft.position.set(18.34, 3.1, -1.97);
    this.scene.add(gFrameLeft);

    const gFrameRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.08, 0.14), antiqueGoldFrameMat);
    gFrameRight.position.set(18.34, 3.1, 1.97);
    this.scene.add(gFrameRight);

    // Old Gangster #001 - Inner Glowing Amber Neon Bezel (3.84m x 3.84m)
    const gBezelTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 3.84), amberGlowBezelMat);
    gBezelTop.position.set(18.35, 5.02, 0);
    this.scene.add(gBezelTop);

    const gBezelBottom = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 3.84), amberGlowBezelMat);
    gBezelBottom.position.set(18.35, 1.18, 0);
    this.scene.add(gBezelBottom);

    const gBezelLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.84, 0.04), amberGlowBezelMat);
    gBezelLeft.position.set(18.35, 3.1, -1.92);
    this.scene.add(gBezelLeft);

    const gBezelRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.84, 0.04), amberGlowBezelMat);
    gBezelRight.position.set(18.35, 3.1, 1.92);
    this.scene.add(gBezelRight);

    // Dedicated high-intensity museum warm spotlight
    const gangsterSpotLight = new THREE.SpotLight('#fef3c7', 6.5, 20, Math.PI / 4, 0.35);
    gangsterSpotLight.position.set(14.0, 5.8, 0);
    gangsterSpotLight.target = gangsterMesh;
    this.scene.add(gangsterSpotLight);

    // Subtle warm amber ambient wall wash
    const gangsterAmbientGlow = new THREE.PointLight('#f59e0b', 2.0, 7);
    gangsterAmbientGlow.position.set(18.1, 3.1, 0);
    this.scene.add(gangsterAmbientGlow);

    // Museum Wall Placard for Old Gangster #001
    const gPlaqueCanvas = document.createElement('canvas');
    gPlaqueCanvas.width = 512;
    gPlaqueCanvas.height = 256;
    const gctx = gPlaqueCanvas.getContext('2d')!;
    gctx.fillStyle = '#090d16';
    gctx.fillRect(0, 0, 512, 256);
    gctx.strokeStyle = '#f59e0b';
    gctx.lineWidth = 6;
    gctx.strokeRect(6, 6, 500, 244);

    gctx.fillStyle = '#f59e0b';
    gctx.font = 'bold 28px monospace';
    gctx.fillText('OLD GANGSTER #001', 24, 60);

    gctx.fillStyle = '#f1f5f9';
    gctx.font = '20px monospace';
    gctx.fillText('WORLCORE MUSEUM • VINTAGE NOIR', 24, 110);

    gctx.fillStyle = '#94a3b8';
    gctx.font = '16px monospace';
    gctx.fillText('STYLE: DARK STREET NOIR // RARITY: LEGENDARY', 24, 155);

    gctx.fillStyle = '#10b981';
    gctx.font = '14px monospace';
    gctx.fillText('EDITION: 001 // IPFS VERIFIED MASTERPIECE', 24, 205);

    const gPlaqueTex = new THREE.CanvasTexture(gPlaqueCanvas);
    gPlaqueTex.colorSpace = THREE.SRGBColorSpace;

    const gPlaqueMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.8),
      new THREE.MeshStandardMaterial({
        map: gPlaqueTex,
        roughness: 0.3,
        metalness: 0.7,
      })
    );
    gPlaqueMesh.position.set(18.36, 0.45, 0);
    gPlaqueMesh.rotation.y = -Math.PI / 2;
    this.scene.add(gPlaqueMesh);

    // Interactive Wall Collider for Old Gangster #001
    const gWallCollider = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 4.2, 4.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    gWallCollider.position.set(18.1, 3.1, 0);
    this.scene.add(gWallCollider);
    this.interactiveObjects.push(gWallCollider);
    this.wallColliders.push({ collider: gWallCollider, exhibitId: 'nft-old-gangster' });
  }

  private buildHeroExhibits() {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createContactShadowTexture();
    const bumpTex = createPedestalBumpTexture();

    const exhibitDefinitions: ExhibitData[] = [
      {
        id: 'nft-genesis',
        title: 'WORLD core — Genesis #001',
        artist: 'WORLD core Foundation',
        creatorAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        ownerAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
        contractAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        tokenId: '001',
        imageUrl: '/assets/aistudio/Futuristic_Chrome_World_Core_Emblem_4fe37529.png',
        tokenURI: 'ipfs://YOUR_IMAGE_CID/world-core-genesis-001.png',
        description: 'The first genesis artwork of WORLD core, featuring a luminous blue digital Earth, polished metallic silver lettering, and chrome orbital rings.',
        rarity: 'Mythic',
        edition: 'Genesis #001 (Founder Edition)',
        tags: ['WORLD core Genesis', 'Genesis', 'Electric Blue and Silver', '3D Metallic', 'Founder Edition'],
        attributes: [
          { trait_type: 'Collection', value: 'WORLD core Genesis' },
          { trait_type: 'Edition', value: 'Genesis' },
          { trait_type: 'Color', value: 'Electric Blue and Silver' },
          { trait_type: 'Style', value: '3D Metallic' },
          { trait_type: 'Edition Type', value: 'Founder Edition' },
        ],
        currentBid: 4.80,
        bidsCount: 24,
        likesCount: 512,
        position: [6.6, 0, -12.5],
        rotation: [0, 0, 0],
        room: 'rotunda',
        accentColor: '#38bdf8',
      },
      {
        id: 'nft-world-connector',
        title: 'WORLD core — The Connector of All Crypto',
        artist: 'WORLD core Foundation',
        creatorAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        ownerAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
        contractAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        tokenId: '002',
        imageUrl: '/assets/aistudio/world-core-connector-001.png',
        tokenURI: 'ipfs://REPLACE_WITH_YOUR_IMAGE_CID',
        description: 'A futuristic WORLD core genesis artwork representing the vision of connecting the crypto ecosystem through one global digital world.',
        rarity: 'Mythic',
        edition: 'Genesis Concept (One World, All Chains)',
        tags: [
          'WORLD core Genesis',
          'The Connector of All Crypto',
          'One World, All Chains',
          'Futuristic 3D Metallic',
          'Electric Blue',
          'Genesis Concept',
        ],
        attributes: [
          { trait_type: 'Collection', value: 'WORLD core Genesis' },
          { trait_type: 'Theme', value: 'The Connector of All Crypto' },
          { trait_type: 'Vision', value: 'One World, All Chains' },
          { trait_type: 'Style', value: 'Futuristic 3D Metallic' },
          { trait_type: 'Primary Color', value: 'Electric Blue' },
          { trait_type: 'Edition', value: 'Genesis Concept' },
        ],
        currentBid: 5.40,
        bidsCount: 31,
        likesCount: 684,
        position: [13.8, 0, -12.5],
        rotation: [0, 0, 0],
        room: 'rotunda',
        accentColor: '#38bdf8',
      },
      {
        id: 'nft-old-gangster',
        title: 'Old Gangster #001',
        artist: 'WORLCORE MUSEUM',
        creatorAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        ownerAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
        contractAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        tokenId: '001',
        imageUrl: '/assets/aistudio/Rainy_Noir_Gangster_Portrait_3202bd82.png',
        tokenURI: 'ipfs://YOUR_IMAGE_CID',
        description: 'A legendary vintage street gangster from the WORLCORE MUSEUM NFT Collection. Featuring a black pinstripe suit, gold jewelry, a classic fedora, and a dark cinematic city atmosphere.',
        rarity: 'Legendary',
        edition: '001 (1 of 1 Masterpiece)',
        tags: [
          'WORLCORE MUSEUM',
          'Old Gangster',
          'Black Pinstripe Suit',
          'Dark Street Noir',
          'Vintage Fedora',
          'Gold Chain',
          'Legendary',
        ],
        attributes: [
          { trait_type: 'Collection', value: 'WORLCORE MUSEUM' },
          { trait_type: 'Character', value: 'Old Gangster' },
          { trait_type: 'Outfit', value: 'Black Pinstripe Suit' },
          { trait_type: 'Accessory', value: 'Gold Chain' },
          { trait_type: 'Headwear', value: 'Vintage Fedora' },
          { trait_type: 'Style', value: 'Dark Street Noir' },
          { trait_type: 'Rarity', value: 'Legendary' },
          { trait_type: 'Edition', value: '001' },
        ],
        currentBid: 6.20,
        bidsCount: 38,
        likesCount: 845,
        position: [18.38, 0, 0],
        rotation: [0, -Math.PI / 2, 0],
        room: 'cyberpunk',
        accentColor: '#f59e0b',
      },
      {
        id: 'nft-1',
        title: 'KUPAL Graffiti',
        artist: 'Street Art Syndicate',
        creatorAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        ownerAddress: '0x71C8A9bE1A43F04918fEb1B49f57E5a9b1C6B49f',
        contractAddress: '0x8A72F67c132899479b12d5d852c00a0E341B442A',
        tokenId: '1',
        imageUrl: '/assets/aistudio/KUPAL_Graffiti_on_Concrete_87cdb948.png',
        description: 'Urban graffiti artwork with bold orange and yellow lettering, black shadows, blue paint splashes, and a crown on a concrete wall.',
        rarity: 'Mythic',
        edition: '1 of 1 Masterpiece',
        tags: ['KUPAL', 'graffiti', 'street art', 'urban art', 'spray paint'],
        attributes: [
          { trait_type: 'Medium', value: 'Spray Paint on Concrete' },
          { trait_type: 'Style', value: 'Urban Street Art' },
          { trait_type: 'Series', value: 'Syndicate Murals' },
        ],
        currentBid: 3.45,
        bidsCount: 18,
        likesCount: 342,
        position: [-8, 0, -12.5],
        rotation: [0, 0, 0],
        room: 'rotunda',
        accentColor: '#f97316',
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
      const isWallExhibit =
        exhibit.id === 'nft-1' ||
        exhibit.id === 'nft-genesis' ||
        exhibit.id === 'nft-world-connector' ||
        exhibit.id === 'nft-old-gangster';

      if (isWallExhibit) {
        const wallColliderObj = this.wallColliders.find((w) => w.exhibitId === exhibit.id)?.collider;
        const record: ExhibitMeshRecord = {
          collider: (wallColliderObj as THREE.Mesh) || new THREE.Mesh(),
          data: exhibit,
          artMesh: new THREE.Mesh(),
          ownerBadge: new THREE.Group(),
          accentLight: new THREE.SpotLight(),
        };
        this.exhibitRecords.push(record);
        return;
      }

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
      const isGenesis = exhibit.id === 'nft-genesis';
      const frameMat = new THREE.MeshStandardMaterial({
        color: isGenesis ? '#f1f5f9' : '#f59e0b',
        roughness: isGenesis ? 0.08 : 0.2,
        metalness: isGenesis ? 0.98 : 0.9,
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

      // Orbital Ring 1: Glowing Electric Blue
      const gyroRing1 = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, isGenesis ? 0.03 : 0.025, 16, 48),
        new THREE.MeshStandardMaterial({
          color: exhibit.accentColor,
          roughness: 0.15,
          metalness: 0.9,
          emissive: exhibit.accentColor,
          emissiveIntensity: isGenesis ? 0.75 : 0.35,
        })
      );
      kineticGroup.add(gyroRing1);

      // Orbital Ring 2: Polished Mirror Chrome Silver
      const gyroRing2 = new THREE.Mesh(
        new THREE.TorusGeometry(1.24, 0.022, 16, 48),
        new THREE.MeshStandardMaterial({
          color: '#f8fafc',
          roughness: 0.05,
          metalness: 0.98,
        })
      );
      gyroRing2.rotation.x = Math.PI / 3;
      gyroRing2.rotation.y = Math.PI / 6;
      kineticGroup.add(gyroRing2);

      // For WORLD core Genesis #001: Outer third chrome orbital ring & cyber blue inner light
      if (isGenesis) {
        const gyroRing3 = new THREE.Mesh(
          new THREE.TorusGeometry(1.38, 0.018, 16, 64),
          new THREE.MeshStandardMaterial({
            color: '#cbd5e1',
            roughness: 0.06,
            metalness: 0.95,
          })
        );
        gyroRing3.rotation.x = -Math.PI / 4;
        gyroRing3.rotation.z = Math.PI / 5;
        kineticGroup.add(gyroRing3);

        const genesisPointLight = new THREE.PointLight('#38bdf8', 2.8, 8);
        genesisPointLight.position.set(0, 0, 0);
        kineticGroup.add(genesisPointLight);
      }

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

      if (exhibit.imageUrl) {
        this.loadCustomTexture(record, exhibit.imageUrl, exhibit.title, exhibit.artist);
      }
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

  // Smooth Analog Vector input from mobile virtual thumbstick
  public setVirtualJoystick(vector: { x: number; y: number }, sprint: boolean = false) {
    this.virtualJoystickVector = vector;
    this.isVirtualSprint = sprint;
  }

  // Touch rotation helper for mobile swipe look
  public rotateBy(deltaYaw: number, deltaPitch: number) {
    if (this.navMode === 'WALK') {
      this.walkYaw -= deltaYaw;
      this.walkPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.walkPitch - deltaPitch));
    } else {
      this.spherical.theta -= deltaYaw;
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.05, this.spherical.phi - deltaPitch));
      const radius = this.cameraTargetPosition.distanceTo(this.cameraTargetLookAt);
      this.cameraTargetPosition.x = this.cameraTargetLookAt.x + radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
      this.cameraTargetPosition.y = this.cameraTargetLookAt.y + radius * Math.cos(this.spherical.phi);
      this.cameraTargetPosition.z = this.cameraTargetLookAt.z + radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
    }
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

      // Preserve native aspect ratio without distortion
      const maxW = 904;
      const maxH = 820;
      const naturalW = img.naturalWidth || img.width || 1;
      const naturalH = img.naturalHeight || img.height || 1;
      const imgAspect = naturalW / naturalH;

      let drawW = maxW;
      let drawH = maxW / imgAspect;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = maxH * imgAspect;
      }
      const drawX = 60 + (maxW - drawW) / 2;
      const drawY = 60 + (maxH - drawH) / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      ctx.fillStyle = rec.data.accentColor || '#facc15';
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

    if (exhibit.id === 'nft-genesis') {
      this.cameraTargetPosition.set(6.6, 2.0, -9.2);
      this.cameraTargetLookAt.set(6.6, 2.9, -14.58);
      if (this.navMode === 'WALK') {
        this.camera.position.set(6.6, 1.7, -9.2);
        this.walkYaw = Math.PI;
        this.walkPitch = 0.12;
      }
      this.callbacks.onSelectExhibit(exhibit);
      return;
    }

    if (exhibit.id === 'nft-world-connector') {
      this.cameraTargetPosition.set(13.8, 2.0, -9.2);
      this.cameraTargetLookAt.set(13.8, 2.9, -14.58);
      if (this.navMode === 'WALK') {
        this.camera.position.set(13.8, 1.7, -9.2);
        this.walkYaw = Math.PI;
        this.walkPitch = 0.12;
      }
      this.callbacks.onSelectExhibit(exhibit);
      return;
    }

    if (exhibit.id === 'nft-old-gangster') {
      this.cameraTargetPosition.set(13.6, 2.0, 0);
      this.cameraTargetLookAt.set(18.38, 2.9, 0);
      if (this.navMode === 'WALK') {
        this.camera.position.set(13.6, 1.7, 0);
        this.walkYaw = -Math.PI / 2;
        this.walkPitch = 0.12;
      }
      this.callbacks.onSelectExhibit(exhibit);
      return;
    }

    if (exhibit.id === 'nft-1') {
      this.cameraTargetPosition.set(-8, 2.0, -9.2);
      this.cameraTargetLookAt.set(-8, 2.9, -14.58);
      if (this.navMode === 'WALK') {
        this.camera.position.set(-8, 1.7, -9.2);
        this.walkYaw = Math.PI;
        this.walkPitch = 0.12;
      }
      this.callbacks.onSelectExhibit(exhibit);
      return;
    }

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

  public focusCorePlanet() {
    this.activeExhibit = null;
    sound.playInspect();
    this.cameraTargetPosition.set(0, 3.2, 7.8);
    this.cameraTargetLookAt.set(0, 2.7, 0);
    this.cameraCurrentLookAt.set(0, 2.7, 0);

    this.spherical.radius = 7.8;
    this.spherical.theta = 0;
    this.spherical.phi = Math.PI / 2.15;

    if (this.navMode === 'WALK') {
      this.camera.position.set(0, 1.7, 7.0);
      this.walkYaw = 0;
      this.walkPitch = 0.14;
      this.camera.lookAt(0, 2.7, 0);
    } else {
      this.camera.position.set(0, 3.2, 7.8);
      this.camera.lookAt(0, 2.7, 0);
    }
    this.emitPlayerTransform();
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
    this.emitPlayerTransform();
  }

  public subscribePlayer(listener: (transform: PlayerTransform) => void): () => void {
    this.playerListeners.add(listener);
    try {
      listener(this.getPlayerTransform());
    } catch (e) {
      console.error('Initial transform dispatch error:', e);
    }
    return () => {
      this.playerListeners.delete(listener);
    };
  }

  public getPlayerTransform(): PlayerTransform {
    const x = this.camera.position.x;
    const z = this.camera.position.z;

    let yaw = this.walkYaw;
    if (this.navMode === 'ORBIT') {
      yaw = Math.atan2(
        -(this.cameraCurrentLookAt.x - this.camera.position.x),
        -(this.cameraCurrentLookAt.z - this.camera.position.z)
      );
    }

    let room: PlayerTransform['room'] = 'rotunda';
    if (z < -13.5) {
      room = 'vault';
    } else if (z > 12) {
      room = 'entrance';
    } else if (x < -3.5) {
      room = 'renaissance';
    } else if (x > 3.5) {
      room = 'cyberpunk';
    }

    return {
      x,
      z,
      yaw,
      pitch: this.walkPitch,
      room,
      navMode: this.navMode,
    };
  }

  public teleportTo(targetX: number, targetZ: number, targetLookX?: number, targetLookZ?: number) {
    sound.playClick();
    const clampedX = Math.max(-22, Math.min(22, targetX));
    const minZ = this.isVaultUnlocked ? -22 : -14;
    const clampedZ = Math.max(minZ, Math.min(22, targetZ));

    this.camera.position.x = clampedX;
    this.camera.position.z = clampedZ;
    this.cameraTargetPosition.x = clampedX;
    this.cameraTargetPosition.z = clampedZ;

    if (targetLookX !== undefined && targetLookZ !== undefined) {
      this.walkYaw = Math.atan2(-(targetLookX - clampedX), -(targetLookZ - clampedZ));
      this.cameraTargetLookAt.set(targetLookX, 1.8, targetLookZ);
      this.cameraCurrentLookAt.set(targetLookX, 1.8, targetLookZ);
    }

    this.emitPlayerTransform();
  }

  private emitPlayerTransform() {
    const transform = this.getPlayerTransform();
    if (this.callbacks.onPlayerTransform) {
      this.callbacks.onPlayerTransform(transform);
    }
    this.playerListeners.forEach((listener) => {
      try {
        listener(transform);
      } catch (err) {
        console.error('Error in player transform listener:', err);
      }
    });
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

    // Pointer Drag & Look with multi-touch isolation
    el.addEventListener('pointerdown', (e) => {
      // If we are not currently tracking a look pointer, claim this one
      if (this.activeLookPointerId === null) {
        this.activeLookPointerId = e.pointerId;
        this.pointerDownPos = { x: e.clientX, y: e.clientY };
      }
    });

    const releasePointer = (e: PointerEvent) => {
      if (this.activeLookPointerId === e.pointerId) {
        const dx = Math.abs(e.clientX - this.pointerDownPos.x);
        const dy = Math.abs(e.clientY - this.pointerDownPos.y);
        const threshold = e.pointerType === 'touch' ? 16 : 6;

        if (dx < threshold && dy < threshold) {
          this.handleClick(e);
        }
        this.activeLookPointerId = null;
      }
    };

    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.activeLookPointerId === e.pointerId) {
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
      } else if (this.activeLookPointerId === null) {
        _raycaster.setFromCamera(_pointer, this.camera);
        const intersects = _raycaster.intersectObjects(this.interactiveObjects, false);
        if (intersects.length > 0) {
          if (this.planetNetwork) {
            const nodeHit = this.planetNetwork.getIntersectedNode(intersects[0].object);
            if (nodeHit) {
              el.style.cursor = 'pointer';
              if (this.callbacks.onHoverCryptoChain) {
                this.callbacks.onHoverCryptoChain(nodeHit.chain || null);
              }
              return;
            }
          }

          let hit = this.exhibitRecords.find((m) => m.collider === intersects[0].object);
          if (!hit) {
            const wallMatch = this.wallColliders.find((w) => w.collider === intersects[0].object);
            if (wallMatch) {
              hit = this.exhibitRecords.find((m) => m.data.id === wallMatch.exhibitId);
            }
          }
          if (hit) {
            el.style.cursor = 'pointer';
            this.callbacks.onHoverExhibit(hit.data);
            return;
          }
        }
        el.style.cursor = 'default';
        this.callbacks.onHoverExhibit(null);
        if (this.callbacks.onHoverCryptoChain) {
          this.callbacks.onHoverCryptoChain(null);
        }
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
      if (this.planetNetwork) {
        const nodeHit = this.planetNetwork.getIntersectedNode(intersects[0].object);
        if (nodeHit) {
          if (nodeHit.isCore) {
            this.focusCorePlanet();
            const coreEx = this.exhibitRecords.find((m) => m.data.id === 'nft-world-connector');
            if (coreEx) {
              this.callbacks.onSelectExhibit(coreEx.data);
            }
          } else if (nodeHit.chain) {
            sound.playClick();
            if (this.callbacks.onSelectCryptoChain) {
              this.callbacks.onSelectCryptoChain(nodeHit.chain);
            }
          }
          return;
        }
      }

      let hit = this.exhibitRecords.find((m) => m.collider === intersects[0].object);
      if (!hit) {
        const wallMatch = this.wallColliders.find((w) => w.collider === intersects[0].object);
        if (wallMatch) {
          hit = this.exhibitRecords.find((m) => m.data.id === wallMatch.exhibitId);
        }
      }
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

    // Merge virtual analog joystick movement
    if (Math.abs(this.virtualJoystickVector.x) > 0.05 || Math.abs(this.virtualJoystickVector.y) > 0.05) {
      _moveDir.x += this.virtualJoystickVector.x;
      _moveDir.z += this.virtualJoystickVector.y;
    }

    const isMoving = _moveDir.lengthSq() > 0.005;

    if (isMoving) {
      if (_moveDir.lengthSq() > 1) {
        _moveDir.normalize();
      }

      // Transform move vector relative to camera walkYaw
      const cos = Math.cos(this.walkYaw);
      const sin = Math.sin(this.walkYaw);

      const worldX = _moveDir.x * cos + _moveDir.z * sin;
      const worldZ = -_moveDir.x * sin + _moveDir.z * cos;

      const activeSprint = this.isSprint || this.isVirtualSprint;
      const speed = activeSprint ? 7.5 : 4.5;
      this.walkVelocity.x = worldX * speed;
      this.walkVelocity.z = worldZ * speed;

      // Accumulate head bobbing
      this.walkStep += delta * (activeSprint ? 14 : 9);
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

    if (this.planetNetwork) {
      this.planetNetwork.update(delta, elapsed, this.camera.position);
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

    this.emitPlayerTransform();
    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public dispose() {
    this.isDisposed = true;
    this.playerListeners.clear();
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onResize.bind(this));
    this.timer.dispose();

    if (this.planetNetwork) {
      this.planetNetwork.dispose();
    }

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
