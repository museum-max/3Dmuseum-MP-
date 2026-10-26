import * as THREE from 'three';
import { CRYPTO_CHAINS, CryptoChainInfo, createCryptoLogoTexture, createCryptoLabelTexture } from './cryptoLogos';

export interface CryptoSatelliteNode {
  chain: CryptoChainInfo;
  group: THREE.Group;
  coinMesh: THREE.Mesh;
  collider: THREE.Mesh;
  billboard: THREE.Mesh;
  beamLine: THREE.Line;
  beamPositions: Float32Array;
  orbitRadius: number;
  orbitSpeed: number;
  initialAngle: number;
  inclinationY: number;
  phase: number;
}

export class WorldCorePlanetNetwork {
  public rootGroup: THREE.Group;
  public centralPlanetGroup: THREE.Group;
  public centralGlobeMesh: THREE.Mesh;
  public centralCollider: THREE.Mesh;
  public coreLight: THREE.PointLight;
  public orbitalRing1: THREE.Mesh;
  public orbitalRing2: THREE.Mesh;
  public satellites: CryptoSatelliteNode[] = [];
  public interactiveObjects: THREE.Object3D[] = [];

  private isSoftwareGl: boolean;
  private glowHaloMesh: THREE.Mesh;

  constructor(scene: THREE.Scene, isSoftwareGl = false) {
    this.isSoftwareGl = isSoftwareGl;
    this.rootGroup = new THREE.Group();
    this.rootGroup.position.set(0, 0, 0);
    scene.add(this.rootGroup);

    // 1. Build Centerpiece Altar Platform on the floor
    this.buildAltar();

    // 2. Build Central Glowing "WORLD CORE" Planet
    this.buildCentralPlanet();

    // 3. Build 12 Orbiting Mini Crypto Nodes
    this.buildCryptoSatellites();
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

    // Generate high-resolution procedural cyber Earth texture
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

    // Primary Chrome Orbital Ring
    const chromeRingMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.05,
      metalness: 0.98,
    });
    const ring1Geo = new THREE.TorusGeometry(1.85, 0.038, 16, 64);
    this.orbitalRing1 = new THREE.Mesh(ring1Geo, chromeRingMat);
    this.orbitalRing1.rotation.x = Math.PI / 4;
    this.orbitalRing1.rotation.y = Math.PI / 6;
    this.centralPlanetGroup.add(this.orbitalRing1);

    // Secondary Glowing Cyber Ring
    const neonRingMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.95,
      roughness: 0.12,
      metalness: 0.9,
    });
    const ring2Geo = new THREE.TorusGeometry(2.1, 0.024, 16, 64);
    this.orbitalRing2 = new THREE.Mesh(ring2Geo, neonRingMat);
    this.orbitalRing2.rotation.x = -Math.PI / 5;
    this.orbitalRing2.rotation.z = Math.PI / 4;
    this.centralPlanetGroup.add(this.orbitalRing2);

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

    // Latitudes
    for (let y = 30; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Longitudes
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

    // Oceania / Australia
    drawContinent(w * 0.85, h * 0.7, 60, 50, [
      [-0.5, -0.4], [0.3, -0.6], [0.6, 0.0], [0.4, 0.5],
      [-0.2, 0.6], [-0.6, 0.2]
    ]);

    // Equator Tech Band with futuristic lettering
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

  private buildCryptoSatellites() {
    const total = CRYPTO_CHAINS.length;

    CRYPTO_CHAINS.forEach((chain, i) => {
      const satGroup = new THREE.Group();

      // Staggered orbital parameters for cinematic multi-layer distribution
      const layer = i % 3;
      const orbitRadius = 2.45 + layer * 0.48 + (i % 2) * 0.2;
      const initialAngle = (i / total) * Math.PI * 2;
      const inclinationY = 0.18 + ((i % 4) - 1.5) * 0.08;
      const orbitSpeed = 0.22 + (1.0 / (layer + 1)) * 0.12;
      const phase = (i * Math.PI) / 3;

      // 1. Create Coin Disc Mesh (Front/Back texture + Metallic Rim)
      const logoTex = createCryptoLogoTexture(chain);
      const coinFaceMat = new THREE.MeshStandardMaterial({
        map: logoTex,
        roughness: 0.18,
        metalness: 0.85,
        emissive: chain.color,
        emissiveIntensity: 0.25,
      });

      const coinRimMat = new THREE.MeshStandardMaterial({
        color: chain.accentColor,
        roughness: 0.15,
        metalness: 0.95,
      });

      const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.045, 32);
      const coinMesh = new THREE.Mesh(coinGeo, [coinRimMat, coinFaceMat, coinFaceMat]);
      coinMesh.rotation.x = Math.PI / 2;
      coinMesh.castShadow = !this.isSoftwareGl;
      satGroup.add(coinMesh);

      // 2. Glowing Halo Ring around the coin
      const haloMat = new THREE.MeshStandardMaterial({
        color: chain.color,
        emissive: chain.color,
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.9,
      });
      const haloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.012, 12, 32), haloMat);
      satGroup.add(haloMesh);

      // 3. Floating HUD Billboard Label
      const labelTex = createCryptoLabelTexture(chain.symbol, chain.color);
      const labelMat = new THREE.MeshBasicMaterial({
        map: labelTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const billboard = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.18), labelMat);
      billboard.position.y = 0.38;
      satGroup.add(billboard);

      // 4. Dynamic Laser Network Beam to CORE Planet
      const beamPositions = new Float32Array(6); // 2 vertices: core (0, 2.7, 0) -> satellite position
      const beamGeo = new THREE.BufferGeometry();
      beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3));

      const beamMat = new THREE.LineBasicMaterial({
        color: chain.color,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      });
      const beamLine = new THREE.Line(beamGeo, beamMat);
      this.rootGroup.add(beamLine);

      // 5. Invisible Clickable Collider
      const collider = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      satGroup.add(collider);
      this.interactiveObjects.push(collider);

      // Initial placement
      const x0 = Math.cos(initialAngle) * orbitRadius;
      const z0 = Math.sin(initialAngle) * orbitRadius;
      const y0 = 2.7 + Math.sin(initialAngle * 2 + phase) * orbitRadius * inclinationY;
      satGroup.position.set(x0, y0, z0);

      this.rootGroup.add(satGroup);

      this.satellites.push({
        chain,
        group: satGroup,
        coinMesh,
        collider,
        billboard,
        beamLine,
        beamPositions,
        orbitRadius,
        orbitSpeed,
        initialAngle,
        inclinationY,
        phase,
      });
    });
  }

  public update(_delta: number, elapsed: number, cameraPosition?: THREE.Vector3) {
    // 1. Slow, majestic rotation of the central planet globe
    if (this.centralGlobeMesh) {
      this.centralGlobeMesh.rotation.y = elapsed * 0.14;
    }

    // 2. Counter-rotation of primary and secondary orbital rings
    if (this.orbitalRing1) {
      this.orbitalRing1.rotation.z = elapsed * 0.22;
    }
    if (this.orbitalRing2) {
      this.orbitalRing2.rotation.y = -elapsed * 0.18;
    }

    // 3. Rhythmic pulse of internal core energy light
    if (this.coreLight) {
      this.coreLight.intensity = 3.6 + Math.sin(elapsed * 2.8) * 0.8;
    }

    // 4. Update each satellite's orbital trajectory and laser beam connections
    this.satellites.forEach((sat) => {
      const angle = sat.initialAngle + elapsed * sat.orbitSpeed;
      const x = Math.cos(angle) * sat.orbitRadius;
      const z = Math.sin(angle) * sat.orbitRadius;
      const y = 2.7 + Math.sin(angle * 2 + sat.phase) * sat.orbitRadius * sat.inclinationY;

      sat.group.position.set(x, y, z);

      // Self-rotation of the coin on its spin axis
      sat.coinMesh.rotation.z = elapsed * 1.8;

      // Make HUD billboard face camera
      if (cameraPosition) {
        sat.billboard.lookAt(cameraPosition);
      }

      // Update laser beam connector endpoints: from planet center (0, 2.7, 0) to satellite
      sat.beamPositions[0] = 0;
      sat.beamPositions[1] = 2.7;
      sat.beamPositions[2] = 0;
      sat.beamPositions[3] = x;
      sat.beamPositions[4] = y;
      sat.beamPositions[5] = z;
      sat.beamLine.geometry.attributes.position.needsUpdate = true;
    });
  }

  public getIntersectedNode(object: THREE.Object3D): { isCore: boolean; chain?: CryptoChainInfo } | null {
    if (object === this.centralCollider || object === this.centralGlobeMesh) {
      return { isCore: true };
    }
    const match = this.satellites.find((s) => s.collider === object || s.coinMesh === object);
    if (match) {
      return { isCore: false, chain: match.chain };
    }
    return null;
  }

  public dispose() {
    this.satellites.forEach((sat) => {
      if (sat.beamLine.geometry) sat.beamLine.geometry.dispose();
      if ((sat.beamLine.material as THREE.Material).dispose) {
        (sat.beamLine.material as THREE.Material).dispose();
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
