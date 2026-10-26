import * as THREE from 'three';
import { CRYPTO_CHAINS, CryptoChainInfo, createCryptoLogoTexture, createCryptoLabelTexture } from './cryptoLogos';

export interface FloatingCryptoIcon {
  chain: CryptoChainInfo;
  parentGroup: THREE.Group;
  iconGroup: THREE.Group;
  coinMesh: THREE.Mesh;
  glowHalo: THREE.Mesh;
  billboard: THREE.Mesh;
  collider: THREE.Mesh;
  beamLine: THREE.Line;
  beamPositions: Float32Array;
  ringRadius: number;
  ringAngle: number;
  bobOffset: number;
}

export interface PlanetaryRingSystem {
  group: THREE.Group;
  ringMesh: THREE.Mesh;
  innerBorder: THREE.Mesh;
  outerBorder: THREE.Mesh;
  rotationSpeed: number;
  icons: FloatingCryptoIcon[];
}

export class WorldCorePlanetNetwork {
  public rootGroup: THREE.Group;
  public centralPlanetGroup!: THREE.Group;
  public centralGlobeMesh!: THREE.Mesh;
  public centralCollider!: THREE.Mesh;
  public coreLight!: THREE.PointLight;
  public planetaryRings: PlanetaryRingSystem[] = [];
  public interactiveObjects: THREE.Object3D[] = [];
  public floatingIcons: FloatingCryptoIcon[] = [];

  private isSoftwareGl: boolean;
  private glowHaloMesh!: THREE.Mesh;

  constructor(scene: THREE.Scene, isSoftwareGl = false) {
    this.isSoftwareGl = isSoftwareGl;
    this.rootGroup = new THREE.Group();
    this.rootGroup.position.set(0, 0, 0);
    scene.add(this.rootGroup);

    // 1. Build Centerpiece Altar Platform on the floor
    this.buildAltar();

    // 2. Build Central Glowing "WORLD CORE" Planet
    this.buildCentralPlanet();

    // 3. Build the Set of Rotating Semi-Transparent Planetary Rings with Floating 3D Crypto Icons
    this.buildRotatingPlanetaryRings();
  }

  private buildAltar() {
    const altarGroup = new THREE.Group();
    altarGroup.position.set(0, 0, 0);

    // Tier 1: Polished dark obsidian plinth
    const plinthMat = new THREE.MeshStandardMaterial({
      color: '#070a14',
      roughness: 0.2,
      metalness: 0.85,
    });
    const plinthMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 0.24, 48), plinthMat);
    plinthMesh.position.y = 0.12;
    plinthMesh.receiveShadow = !this.isSoftwareGl;
    altarGroup.add(plinthMesh);

    // Tier 1 Outer LED Ring
    const ledRingMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.95,
    });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.035, 16, 64), ledRingMat);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = 0.23;
    altarGroup.add(outerRing);

    // Tier 2: Raised mirror chrome concentric platform
    const chromeDiscMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.08,
      metalness: 0.98,
    });
    const chromeDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.16, 48), chromeDiscMat);
    chromeDisc.position.y = 0.32;
    chromeDisc.receiveShadow = !this.isSoftwareGl;
    altarGroup.add(chromeDisc);

    // Inner Glowing Energy Ring
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.025, 16, 64), ledRingMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.41;
    altarGroup.add(innerRing);

    // Dedicated Altar Uplight beam focused straight at the core planet
    const altarSpot = new THREE.SpotLight('#38bdf8', 4.5, 12, Math.PI / 6, 0.5);
    altarSpot.position.set(0, 0.45, 0);
    altarSpot.target.position.set(0, 2.7, 0);
    altarGroup.add(altarSpot);
    altarGroup.add(altarSpot.target);

    this.rootGroup.add(altarGroup);
  }

  private buildCentralPlanet() {
    this.centralPlanetGroup = new THREE.Group();
    this.centralPlanetGroup.position.set(0, 2.7, 0);

    // High-resolution procedural cyber Earth texture
    const planetTex = this.createPlanetTexture();

    const globeGeo = new THREE.SphereGeometry(1.35, 48, 36);
    const globeMat = new THREE.MeshStandardMaterial({
      map: planetTex,
      roughness: 0.22,
      metalness: 0.55,
      emissive: '#0369a1',
      emissiveIntensity: 0.45,
    });

    this.centralGlobeMesh = new THREE.Mesh(globeGeo, globeMat);
    this.centralGlobeMesh.castShadow = !this.isSoftwareGl;
    this.centralPlanetGroup.add(this.centralGlobeMesh);

    // Luminous Atmospheric Glow Halo
    const glowGeo = new THREE.SphereGeometry(1.48, 36, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this.glowHaloMesh = new THREE.Mesh(glowGeo, glowMat);
    this.centralPlanetGroup.add(this.glowHaloMesh);

    // Core Internal Ambient Blue Light
    this.coreLight = new THREE.PointLight('#38bdf8', 3.8, 11);
    this.coreLight.position.set(0, 0, 0);
    this.centralPlanetGroup.add(this.coreLight);

    // Invisible Interactive Collider for the Planet
    this.centralCollider = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.centralPlanetGroup.add(this.centralCollider);
    this.interactiveObjects.push(this.centralCollider);

    this.rootGroup.add(this.centralPlanetGroup);
  }

  private createRingTexture(primaryHex: string, accentHex: string): THREE.CanvasTexture {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    // Concentric semi-transparent glowing tracks
    for (let r = 80; r < size / 2 - 10; r += 12) {
      const alpha = 0.08 + (Math.sin(r * 0.1) + 1) * 0.12;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = primaryHex;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = r % 36 === 0 ? 3 : 1;
      ctx.stroke();
    }

    // Radial cyber hash markings
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2;
    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * Math.PI * 2;
      const r1 = 120 + (i % 3) * 40;
      const r2 = r1 + 18;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildRotatingPlanetaryRings() {
    // 3 Distinct Planetary Rings:
    // Ring 0 (Inner): BTC, ETH, SOL, BNB
    // Ring 1 (Middle): XRP, DOGE, ADA, AVAX
    // Ring 2 (Outer): POL, LINK, TRX, USDT
    const ringConfigs = [
      {
        innerRadius: 2.15,
        outerRadius: 2.85,
        tiltX: 0.38,
        tiltZ: 0.16,
        rotationSpeed: 0.18,
        color: '#38bdf8',
        emissive: '#0284c7',
        opacity: 0.44,
        chains: CRYPTO_CHAINS.slice(0, 4), // BTC, ETH, SOL, BNB
      },
      {
        innerRadius: 3.25,
        outerRadius: 4.05,
        tiltX: -0.36,
        tiltZ: -0.24,
        rotationSpeed: -0.13,
        color: '#818cf8',
        emissive: '#4f46e5',
        opacity: 0.38,
        chains: CRYPTO_CHAINS.slice(4, 8), // XRP, DOGE, ADA, AVAX
      },
      {
        innerRadius: 4.45,
        outerRadius: 5.35,
        tiltX: 0.22,
        tiltZ: -0.34,
        rotationSpeed: 0.09,
        color: '#2dd4bf',
        emissive: '#0f766e',
        opacity: 0.34,
        chains: CRYPTO_CHAINS.slice(8, 12), // POL, LINK, TRX, USDT
      },
    ];

    ringConfigs.forEach((cfg) => {
      const ringGroup = new THREE.Group();
      // Planet position is (0, 2.7, 0)
      ringGroup.position.set(0, 2.7, 0);
      ringGroup.rotation.x = cfg.tiltX;
      ringGroup.rotation.z = cfg.tiltZ;

      // 1. Semi-transparent Planetary Ring Disc Geometry
      const ringGeo = new THREE.RingGeometry(cfg.innerRadius, cfg.outerRadius, 64);
      const ringTex = this.createRingTexture(cfg.color, cfg.emissive);

      const ringMat = new THREE.MeshStandardMaterial({
        map: ringTex,
        color: cfg.color,
        emissive: cfg.emissive,
        emissiveIntensity: 0.32,
        roughness: 0.18,
        metalness: 0.85,
        transparent: true,
        opacity: cfg.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2; // Flat in the ring plane
      ringGroup.add(ringMesh);

      // 2. Inner Glowing Border Torus
      const innerBorderMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.emissive,
        emissiveIntensity: 0.85,
        roughness: 0.1,
        metalness: 0.95,
      });
      const innerBorder = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.innerRadius, 0.016, 12, 64),
        innerBorderMat
      );
      innerBorder.rotation.x = Math.PI / 2;
      ringGroup.add(innerBorder);

      // 3. Outer Glowing Border Torus
      const outerBorder = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.outerRadius, 0.018, 12, 64),
        innerBorderMat
      );
      outerBorder.rotation.x = Math.PI / 2;
      ringGroup.add(outerBorder);

      const iconsOnRing: FloatingCryptoIcon[] = [];
      const midRadius = (cfg.innerRadius + cfg.outerRadius) / 2;
      const chainCount = cfg.chains.length;

      // 4. Mount Small Floating 3D Icons directly on this ring
      cfg.chains.forEach((chain, idx) => {
        const ringAngle = (idx / chainCount) * Math.PI * 2;
        const iconGroup = new THREE.Group();

        // 3D Coin Mesh (Cylinder)
        const logoTex = createCryptoLogoTexture(chain);
        const coinFaceMat = new THREE.MeshStandardMaterial({
          map: logoTex,
          roughness: 0.15,
          metalness: 0.88,
          emissive: chain.color,
          emissiveIntensity: 0.35,
        });

        const coinRimMat = new THREE.MeshStandardMaterial({
          color: chain.accentColor,
          roughness: 0.12,
          metalness: 0.96,
        });

        const coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.045, 32);
        const coinMesh = new THREE.Mesh(coinGeo, [coinRimMat, coinFaceMat, coinFaceMat]);
        coinMesh.castShadow = !this.isSoftwareGl;
        iconGroup.add(coinMesh);

        // Subtly Glowing Outer Halo Ring
        const haloMat = new THREE.MeshStandardMaterial({
          color: chain.color,
          emissive: chain.color,
          emissiveIntensity: 0.95,
          roughness: 0.1,
          metalness: 0.9,
        });
        const glowHalo = new THREE.Mesh(
          new THREE.TorusGeometry(0.27, 0.012, 12, 32),
          haloMat
        );
        glowHalo.rotation.x = Math.PI / 2;
        iconGroup.add(glowHalo);

        // Subtle Point Light for glowing aura
        const iconLight = new THREE.PointLight(chain.color, 0.9, 2.2);
        iconLight.position.set(0, 0.1, 0);
        iconGroup.add(iconLight);

        // Floating HUD Billboard Label
        const labelTex = createCryptoLabelTexture(chain.symbol, chain.color);
        const labelMat = new THREE.MeshBasicMaterial({
          map: labelTex,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const billboard = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.18), labelMat);
        billboard.position.y = 0.38;
        iconGroup.add(billboard);

        // Laser network beam connector to CORE planet
        const beamPositions = new Float32Array(6);
        const beamGeo = new THREE.BufferGeometry();
        beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3));
        const beamMat = new THREE.LineBasicMaterial({
          color: chain.color,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
        });
        const beamLine = new THREE.Line(beamGeo, beamMat);
        this.rootGroup.add(beamLine);

        // Invisible Clickable Collider
        const collider = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 12, 12),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        iconGroup.add(collider);
        this.interactiveObjects.push(collider);

        // Place on the ring disc
        const localX = Math.cos(ringAngle) * midRadius;
        const localZ = Math.sin(ringAngle) * midRadius;
        const localY = 0.08; // Hover slightly above ring
        iconGroup.position.set(localX, localY, localZ);

        ringGroup.add(iconGroup);

        const iconRecord: FloatingCryptoIcon = {
          chain,
          parentGroup: ringGroup,
          iconGroup,
          coinMesh,
          glowHalo,
          billboard,
          collider,
          beamLine,
          beamPositions,
          ringRadius: midRadius,
          ringAngle,
          bobOffset: idx * 1.57,
        };

        iconsOnRing.push(iconRecord);
        this.floatingIcons.push(iconRecord);
      });

      this.centralPlanetGroup.add(ringGroup);

      this.planetaryRings.push({
        group: ringGroup,
        ringMesh,
        innerBorder,
        outerBorder,
        rotationSpeed: cfg.rotationSpeed,
        icons: iconsOnRing,
      });
    });
  }

  private createPlanetTexture(): THREE.CanvasTexture {
    const w = 1024;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Deep cosmic ocean gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, '#030712');
    oceanGrad.addColorStop(0.5, '#082f49');
    oceanGrad.addColorStop(1, '#030712');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // Digital Latitude / Longitude Matrix Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1;

    for (let y = 30; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    for (let x = 0; x < w; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Glowing Cyber Continents
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;

    const drawContinent = (cx: number, cy: number, rx: number, ry: number, points: number[][]) => {
      ctx.beginPath();
      points.forEach(([px, py], idx) => {
        const x = cx + px * rx;
        const y = cy + py * ry;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    // Americas
    drawContinent(w * 0.25, h * 0.45, 110, 140, [
      [-0.4, -0.9], [0.1, -0.85], [0.35, -0.5], [0.1, -0.2],
      [0.05, 0.05], [0.35, 0.3], [0.2, 0.75], [-0.1, 0.95],
      [-0.2, 0.6], [-0.05, 0.2], [-0.25, -0.1], [-0.5, -0.6]
    ]);

    // Eurasia & Africa
    drawContinent(w * 0.62, h * 0.42, 160, 150, [
      [-0.5, -0.7], [0.4, -0.8], [0.8, -0.4], [0.6, 0.0],
      [0.4, 0.3], [0.1, 0.1], [0.05, 0.6], [-0.2, 0.8],
      [-0.4, 0.4], [-0.2, 0.0], [-0.4, -0.2], [-0.6, -0.4]
    ]);

    // Oceania
    drawContinent(w * 0.85, h * 0.7, 60, 50, [
      [-0.5, -0.4], [0.3, -0.6], [0.6, 0.0], [0.4, 0.5],
      [-0.2, 0.6], [-0.6, 0.2]
    ]);

    // Equator Tech Band
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, h * 0.46, w, h * 0.08);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, h * 0.46, w, h * 0.08);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WORLD CORE — THE CONNECTOR OF ALL CRYPTO', w * 0.25, h * 0.5);
    ctx.fillText('ONE WORLD, ALL CHAINS // INTEROPERABILITY MATRIX', w * 0.75, h * 0.5);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public update(_delta: number, elapsed: number, cameraPosition?: THREE.Vector3) {
    // 1. Slow, majestic rotation of the central planet globe
    if (this.centralGlobeMesh) {
      this.centralGlobeMesh.rotation.y = elapsed * 0.12;
    }

    // 2. Rhythmic pulse of internal core energy light
    if (this.coreLight) {
      this.coreLight.intensity = 3.6 + Math.sin(elapsed * 2.8) * 0.8;
    }

    // Reusable vector for world calculations
    const worldPos = new THREE.Vector3();

    // 3. Rotate each planetary ring and update its floating 3D icons
    this.planetaryRings.forEach((ring) => {
      // Rotate the entire semi-transparent ring
      ring.group.rotation.y = elapsed * ring.rotationSpeed;

      // Update each floating 3D icon on this ring
      ring.icons.forEach((icon) => {
        // Floating sinusoidal bobbing oscillation perpendicular to the ring plane
        const bob = Math.sin(elapsed * 2.8 + icon.bobOffset) * 0.06;
        icon.iconGroup.position.y = 0.09 + bob;

        // Self-rotation of the 3D coin on its local axis
        icon.coinMesh.rotation.y = elapsed * 1.8;

        // Subtle pulsing glow
        const glowPulse = 0.7 + Math.sin(elapsed * 3.5 + icon.bobOffset) * 0.25;
        (icon.glowHalo.material as THREE.MeshStandardMaterial).emissiveIntensity = glowPulse;

        // Make HUD billboard face the camera in world coordinates
        if (cameraPosition) {
          icon.billboard.lookAt(cameraPosition);
        }

        // Update beam line endpoints in world space
        icon.iconGroup.getWorldPosition(worldPos);
        icon.beamPositions[0] = 0;
        icon.beamPositions[1] = 2.7;
        icon.beamPositions[2] = 0;
        icon.beamPositions[3] = worldPos.x;
        icon.beamPositions[4] = worldPos.y;
        icon.beamPositions[5] = worldPos.z;
        icon.beamLine.geometry.attributes.position.needsUpdate = true;
      });
    });
  }

  public getIntersectedNode(object: THREE.Object3D): { isCore: boolean; chain?: CryptoChainInfo } | null {
    if (object === this.centralCollider || object === this.centralGlobeMesh) {
      return { isCore: true };
    }
    const match = this.floatingIcons.find(
      (s) => s.collider === object || s.coinMesh === object || s.glowHalo === object
    );
    if (match) {
      return { isCore: false, chain: match.chain };
    }
    return null;
  }

  public dispose() {
    this.floatingIcons.forEach((icon) => {
      if (icon.beamLine.geometry) icon.beamLine.geometry.dispose();
      if ((icon.beamLine.material as THREE.Material).dispose) {
        (icon.beamLine.material as THREE.Material).dispose();
      }
    });

    this.rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else if (m.material) {
          m.material.dispose();
        }
      }
    });
  }
}
