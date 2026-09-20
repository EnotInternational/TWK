import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import styles from './AgentGrid.module.css';

// Atmosphere glow shader
const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
      gl_FragColor = vec4(0.0, 0.85, 1.0, 1.0) * intensity * 0.9;
    }
  `
};

// --- Starfield Background Data (Generated once in memory, never re-generated) ---
const STAR_COUNT = 1800;
let staticStarPositions = null;
let staticStarColors = null;

function getStaticStarData() {
  if (!staticStarPositions) {
    staticStarPositions = new Float32Array(STAR_COUNT * 3);
    staticStarColors = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 120 + Math.random() * 80;

      const sinPhi = Math.sin(phi);
      staticStarPositions[i * 3] = r * sinPhi * Math.cos(theta);
      staticStarPositions[i * 3 + 1] = r * Math.cos(phi);
      staticStarPositions[i * 3 + 2] = r * sinPhi * Math.sin(theta);

      const colorType = Math.random();
      if (colorType > 0.8) {
        staticStarColors[i * 3] = 0.7; staticStarColors[i * 3 + 1] = 0.85; staticStarColors[i * 3 + 2] = 1.0;
      } else if (colorType > 0.65) {
        staticStarColors[i * 3] = 1.0; staticStarColors[i * 3 + 1] = 0.9; staticStarColors[i * 3 + 2] = 0.65;
      } else {
        staticStarColors[i * 3] = 0.9; staticStarColors[i * 3 + 1] = 0.95; staticStarColors[i * 3 + 2] = 1.0;
      }
    }
  }
  return { positions: staticStarPositions, colors: staticStarColors };
}

// Pseudo-random number generator seeded deterministically
function createRng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Jagged rock material for crags/cliffs
const rockMaterial = new THREE.MeshStandardMaterial({
  color: 0x3e4552, // Dark rugged basalt/slate
  roughness: 0.94,
  metalness: 0.12,
  flatShading: true, // Sharp, jagged cliff facets
});

const craterRockMaterial = new THREE.MeshStandardMaterial({
  color: 0x1a1d24, // Deep charred obsidian/basalt for meteorite epicenter
  roughness: 0.90,
  metalness: 0.25,
  flatShading: true,
});

// Procedural watertight low-poly boulder geometry generator
function createBoulderGeometry(radius, heightRatio, rng, detail = 0) {
  // Use closed Platonic polyhedra (Dodecahedron = 12 pentagons / 36 triangles, Icosahedron = 20 triangles)
  // These are inherently watertight, closed surfaces with no open ends or seams
  const baseGeom = detail === 0
    ? new THREE.DodecahedronGeometry(radius, 0)
    : new THREE.IcosahedronGeometry(radius, detail);

  // Strip UV and normals so mergeVertices unifies all coincident vertices at the same (x,y,z)
  delete baseGeom.attributes.uv;
  delete baseGeom.attributes.normal;
  const mergedGeom = mergeVertices(baseGeom, 1e-4);

  const pos = mergedGeom.attributes.position;
  const v = new THREE.Vector3();

  // Perturb vertices radially from the rock center
  // Displacing purely along radius prevents polygon self-intersection and inversion
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    // Controlled radial jitter (+/- 18%)
    const radialFactor = 0.82 + rng() * 0.36;
    v.normalize().multiplyScalar(len * radialFactor);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  // Non-uniform scaling to form natural jagged cliffs and boulders
  const sx = 0.85 + rng() * 0.30;
  const sy = heightRatio * (0.90 + rng() * 0.25);
  const sz = 0.85 + rng() * 0.30;
  mergedGeom.scale(sx, sy, sz);

  // Convert to non-indexed so each triangle has its own independent face normal
  // Combined with flatShading: true, this creates crisp low-poly facets with zero tearing
  const finalGeom = mergedGeom.toNonIndexed();
  finalGeom.computeVertexNormals();
  return finalGeom;
}

// Procedural cliff / rock cluster generator with sharp craggy facets
function createCliffMesh(rng, isCraterRock = false, rockMat = rockMaterial, craterMat = craterRockMaterial) {
  const group = new THREE.Group();

  const heightMultiplier = isCraterRock ? 0.70 : 0.42;
  const radiusMultiplier = isCraterRock ? 2.2 : 1.25;

  const mainR = (0.22 + rng() * 0.08) * radiusMultiplier;
  const mainH = (0.35 + rng() * 0.20) * heightMultiplier / (0.22 * radiusMultiplier);

  const cliffMat = isCraterRock ? craterMat : rockMat;

  // Main central crag / boulder (vary between 36-face dodecahedron and 80-face icosahedron)
  const mainDetail = rng() > 0.4 ? 0 : 1;
  const mainGeom = createBoulderGeometry(mainR, mainH, rng, mainDetail);
  const mainMesh = new THREE.Mesh(mainGeom, cliffMat);
  mainMesh.position.y = mainR * mainH * 0.40;
  group.add(mainMesh);

  // Flanking boulders nestled at the base to form natural craggy rock formations
  const sideCount = isCraterRock ? (2 + Math.floor(rng() * 2)) : (1 + Math.floor(rng() * 2));
  for (let s = 0; s < sideCount; s++) {
    const sideR = mainR * (0.42 + rng() * 0.32);
    const sideH = 0.65 + rng() * 0.50;
    const sideGeom = createBoulderGeometry(sideR, sideH, rng, 0);
    const sideMesh = new THREE.Mesh(sideGeom, cliffMat);

    const sideAngle = rng() * Math.PI * 2;
    const dist = mainR * (0.65 + rng() * 0.30);
    sideMesh.position.set(
      Math.cos(sideAngle) * dist,
      sideR * sideH * 0.35,
      Math.sin(sideAngle) * dist
    );
    sideMesh.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI * 2, (rng() - 0.5) * 0.5);
    group.add(sideMesh);
  }

  return group;
}


export default function Planet3D({
  agents = [],
  environment = null,
  gridWidth = 60,
  gridHeight = 30,
  onAgentSelect,
  selectedDisaster = null,
  disasterParams = {},
  cratersRef,
  onAddCrater,
  onRemoveCratersNear,
  craterEpicentersRef,
}) {
  const mountRef = useRef(null);

  const agentsRef = useRef(agents);
  const envRef = useRef(environment);
  const gridWidthRef = useRef(gridWidth);
  const gridHeightRef = useRef(gridHeight);
  const onAgentSelectRef = useRef(onAgentSelect);
  const disasterRef = useRef(selectedDisaster);
  const disasterParamsRef = useRef(disasterParams);
  const onAddCraterRef = useRef(onAddCrater);
  const onRemoveCratersNearRef = useRef(onRemoveCratersNear);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const agentPosMap = useRef(new Map());

  const activeEffectsRef = useRef([]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    envRef.current = environment;
  }, [environment]);

  useEffect(() => {
    gridWidthRef.current = gridWidth;
    gridHeightRef.current = gridHeight;
  }, [gridWidth, gridHeight]);

  useEffect(() => {
    onAgentSelectRef.current = onAgentSelect;
  }, [onAgentSelect]);

  useEffect(() => {
    onAddCraterRef.current = onAddCrater;
  }, [onAddCrater]);

  useEffect(() => {
    onRemoveCratersNearRef.current = onRemoveCratersNear;
  }, [onRemoveCratersNear]);

  useEffect(() => {
    disasterRef.current = selectedDisaster;
    disasterParamsRef.current = disasterParams;
  }, [selectedDisaster, disasterParams]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040711);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 6, 24);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // --- Controls: Rotate ONLY on mouse press + drag, NO damping drift, NO auto-rotate ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.enablePan = false;
    controls.minDistance = 11;
    controls.maxDistance = 45;
    controlsRef.current = controls;

    // Mouse drag rotates; clicking without moving selects cell or applies disaster
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // --- Starfield Background (Loaded only once from static star data, never regenerated) ---
    const { positions, colors } = getStaticStarData();
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // --- Enhanced Lighting for Day AND Night side ---
    const hemiLight = new THREE.HemisphereLight(0x7090b8, 0x223048, 1.8);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0x354d6b, 1.4);
    scene.add(ambientLight);

    // Directional sunlight for day side
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.8);
    sunLight.position.set(-32, 4, 0);
    scene.add(sunLight);

    // Visible Sun Mesh
    const sunGeom = new THREE.SphereGeometry(1.6, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe277 });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    scene.add(sunMesh);

    // Sun Corona
    const coronaGeom = new THREE.SphereGeometry(2.4, 16, 16);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffa500,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const coronaMesh = new THREE.Mesh(coronaGeom, coronaMat);
    sunMesh.add(coronaMesh);

    // --- Planet Globe Setup ---
    const PLANET_RADIUS = 7.5;

    // Dynamic Canvas Texture for planet terrain
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 2048;
    textureCanvas.height = 1024;
    const texCtx = textureCanvas.getContext('2d');
    const planetTexture = new THREE.CanvasTexture(textureCanvas);
    planetTexture.wrapS = THREE.RepeatWrapping;
    planetTexture.wrapT = THREE.ClampToEdgeWrapping;

    const planetGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 72, 72);
    const planetMaterial = new THREE.MeshStandardMaterial({
      map: planetTexture,
      roughness: 0.8,
      metalness: 0.1,
    });
    const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
    scene.add(planetMesh);

    // Outer Atmosphere Glow
    const atmosphereGeometry = new THREE.SphereGeometry(PLANET_RADIUS * 1.035, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: AtmosphereShader.vertexShader,
      fragmentShader: AtmosphereShader.fragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // --- 3D Rocks Group ---
    const rocksGroup = new THREE.Group();
    scene.add(rocksGroup);

    // --- 3D Impact Craters Group ---
    const cratersGroup = new THREE.Group();
    scene.add(cratersGroup);
    const activeCraters = [];

    // --- Selected Agent Beacon ---
    const beaconGroup = new THREE.Group();
    const beaconRingGeom = new THREE.RingGeometry(0.12, 0.34, 32);
    const beaconRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const beaconRing = new THREE.Mesh(beaconRingGeom, beaconRingMat);
    beaconGroup.add(beaconRing);

    const beaconBeamGeom = new THREE.CylinderGeometry(0.04, 0.18, 2.5, 16, 1, true);
    const beaconBeamMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const beaconBeam = new THREE.Mesh(beaconBeamGeom, beaconBeamMat);
    beaconBeam.position.y = 1.25;
    beaconGroup.add(beaconBeam);
    beaconGroup.visible = false;
    scene.add(beaconGroup);

    // --- Agents Instanced Mesh ---
    // Using MeshBasicMaterial with color: 0xffffff and instanceColor so agents glow with their energy colors
    const maxAgents = 1500;
    const agentGeometry = new THREE.OctahedronGeometry(0.20, 0);
    const agentMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const agentInstancedMesh = new THREE.InstancedMesh(agentGeometry, agentMaterial, maxAgents);
    agentInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    agentInstancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxAgents * 3), 3);
    agentInstancedMesh.count = 0;
    scene.add(agentInstancedMesh);

    // --- Exact Coordinate Conversion Helper ---
    // Maps discrete simulation grid (x, y) precisely to the Three.js SphereGeometry vertices/UVs
    const gridToSphere = (x, y, w, h, r = PLANET_RADIUS) => {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      const alpha = u * Math.PI * 2;
      const theta = v * Math.PI;

      const px = -r * Math.sin(theta) * Math.cos(alpha);
      const py = r * Math.cos(theta);
      const pz = r * Math.sin(theta) * Math.sin(alpha);
      return new THREE.Vector3(px, py, pz);
    };

    // --- Update Dynamic Planet Texture ---
    let lastRenderedSunX = -1;
    let lastRenderedTerminators = null;
    let lastRenderedDepressions = null;

    const updatePlanetTexture = () => {
      const env = envRef.current;
      const w = env?.width || gridWidth;
      const h = env?.height || gridHeight;

      const sunX = env?.sun_x ?? 0;
      const terminators = env?.terminator_bands || [];
      const depressions = env?.depressions || [];
      const depressionsKey = depressions.map(d => `${d.x},${d.y},${d.level}`).join('|');

      if (
        sunX === lastRenderedSunX &&
        JSON.stringify(terminators) === lastRenderedTerminators &&
        depressionsKey === lastRenderedDepressions
      ) {
        return;
      }

      lastRenderedSunX = sunX;
      lastRenderedTerminators = JSON.stringify(terminators);
      lastRenderedDepressions = depressionsKey;

      const tw = textureCanvas.width;
      const th = textureCanvas.height;

      // 1. Base Night / Cold zone (visible cosmic indigo-slate so terrain is identifiable)
      const nightGrad = texCtx.createLinearGradient(0, 0, 0, th);
      nightGrad.addColorStop(0, '#0c152a');
      nightGrad.addColorStop(0.5, '#142242');
      nightGrad.addColorStop(1, '#0c152a');
      texCtx.fillStyle = nightGrad;
      texCtx.fillRect(0, 0, tw, th);

      // 2. Day / Hot Zone centered at sun_x
      if (env?.sun_x !== undefined) {
        const sunNorm = (env.sun_x % w) / w;
        const sunPixelX = sunNorm * tw;
        const hotHalfWidth = (tw / 4);

        const dayGrad = texCtx.createRadialGradient(
          sunPixelX, th / 2, 40,
          sunPixelX, th / 2, hotHalfWidth * 1.25
        );
        dayGrad.addColorStop(0, 'rgba(215, 115, 45, 0.9)');
        dayGrad.addColorStop(0.45, 'rgba(165, 80, 30, 0.65)');
        dayGrad.addColorStop(0.8, 'rgba(85, 40, 20, 0.3)');
        dayGrad.addColorStop(1, 'rgba(20, 34, 66, 0)');

        texCtx.fillStyle = dayGrad;
        texCtx.fillRect(sunPixelX - hotHalfWidth * 1.5, 0, hotHalfWidth * 3, th);

        // Cylindrical wrap-around for daytime zone
        if (sunPixelX - hotHalfWidth * 1.5 < 0) {
          texCtx.save();
          texCtx.translate(tw, 0);
          texCtx.fillStyle = dayGrad;
          texCtx.fillRect(sunPixelX - hotHalfWidth * 1.5, 0, hotHalfWidth * 3, th);
          texCtx.restore();
        } else if (sunPixelX + hotHalfWidth * 1.5 > tw) {
          texCtx.save();
          texCtx.translate(-tw, 0);
          texCtx.fillStyle = dayGrad;
          texCtx.fillRect(sunPixelX - hotHalfWidth * 1.5, 0, hotHalfWidth * 3, th);
          texCtx.restore();
        }
      }

      // 3. Terminator Twilight Bands
      if (terminators && terminators.length > 0) {
        terminators.forEach((band) => {
          const startX = (band.min_x / w) * tw;
          const bandW = (band.width / w) * tw;
          const centerX = ((band.center_x !== undefined ? band.center_x : band.min_x + band.width / 2) / w) * tw;

          const termGrad = texCtx.createLinearGradient(startX, 0, startX + bandW, 0);
          termGrad.addColorStop(0, 'rgba(0, 242, 254, 0.08)');
          termGrad.addColorStop(0.5, 'rgba(0, 242, 254, 0.55)');
          termGrad.addColorStop(1, 'rgba(0, 242, 254, 0.08)');

          texCtx.fillStyle = termGrad;
          texCtx.fillRect(startX, 0, bandW, th);

          if (startX + bandW > tw) {
            const wrapW = (startX + bandW) - tw;
            texCtx.fillRect(0, 0, wrapW, th);
          }

          // Glowing twilight meridian
          texCtx.strokeStyle = 'rgba(0, 242, 254, 0.9)';
          texCtx.lineWidth = 3;
          texCtx.beginPath();
          texCtx.moveTo(centerX, 0);
          texCtx.lineTo(centerX, th);
          texCtx.stroke();
        });
      }

      // 4. Planetary Grid lines (Latitude & Longitude)
      texCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      texCtx.lineWidth = 1;

      for (let i = 0; i <= w; i += 4) {
        const x = (i / w) * tw;
        texCtx.beginPath();
        texCtx.moveTo(x, 0);
        texCtx.lineTo(x, th);
        texCtx.stroke();
      }
      for (let j = 0; j <= h; j += 2) {
        const y = (j / h) * th;
        texCtx.beginPath();
        texCtx.moveTo(0, y);
        texCtx.lineTo(tw, y);
        texCtx.stroke();
      }

      // 5. Planetary Depressions (Углубления: оазисы на солнце, холодные впадины в тени)
      if (depressions && depressions.length > 0) {
        const cellW = tw / w;
        const cellH = th / h;

        depressions.forEach((dep) => {
          let dx = Math.abs(dep.x - sunX);
          dx = Math.min(dx, w - dx);
          // In the sunlit half of the planet (HOT zone within w/4 of sun_x)
          const isSunlit = dx <= (w / 4);

          const px = (dep.x / w) * tw;
          const py = (dep.y / h) * th;

          if (isSunlit) {
            // Oasis formed where cold depression meets hot sunlight -> habitable zone
            if (dep.level === 2) {
              texCtx.fillStyle = 'rgba(16, 185, 129, 0.75)'; // vibrant emerald oasis pool
              texCtx.fillRect(px, py, cellW, cellH);
              texCtx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
              texCtx.lineWidth = 2;
              texCtx.strokeRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
              // Spring center
              texCtx.fillStyle = 'rgba(6, 182, 212, 0.85)';
              texCtx.fillRect(px + cellW * 0.25, py + cellH * 0.25, cellW * 0.5, cellH * 0.5);
            } else {
              texCtx.fillStyle = 'rgba(20, 184, 166, 0.6)'; // cyan-teal oasis
              texCtx.fillRect(px, py, cellW, cellH);
              texCtx.strokeStyle = 'rgba(45, 212, 191, 0.8)';
              texCtx.lineWidth = 1.5;
              texCtx.strokeRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
            }
          } else {
            // Sunken cold depression in dark hemisphere
            if (dep.level === 2) {
              texCtx.fillStyle = 'rgba(3, 7, 18, 0.9)'; // deep dark pit
              texCtx.fillRect(px, py, cellW, cellH);
              texCtx.strokeStyle = 'rgba(30, 58, 138, 0.85)';
              texCtx.lineWidth = 2;
              texCtx.strokeRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
            } else {
              texCtx.fillStyle = 'rgba(15, 23, 42, 0.7)'; // shadowed cold depression
              texCtx.fillRect(px, py, cellW, cellH);
              texCtx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
              texCtx.lineWidth = 1.5;
              texCtx.strokeRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
            }
          }
        });
      }

      planetTexture.needsUpdate = true;
    };

    // --- Update 3D Rocks (Cliffs: static, craggy, standing unevenly, no animation) ---
    let lastRocksJSON = '';

    const update3DRocks = () => {
      const env = envRef.current;
      const rocks = env?.rocks || [];
      const epCount = craterEpicentersRef?.current?.size || 0;
      const crCount = cratersRef?.current?.length || 0;
      const currentRocksJSON = JSON.stringify(rocks) + `_${epCount}_${crCount}`;

      // Rocks are completely static landscape cliffs: no animation, no floating, no rotation over time
      if (currentRocksJSON === lastRocksJSON) {
        return;
      }
      lastRocksJSON = currentRocksJSON;

      while (rocksGroup.children.length > 0) {
        const obj = rocksGroup.children[0];
        rocksGroup.remove(obj);
        obj.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
        });
      }

      if (rocks.length === 0) return;

      const w = env?.width || gridWidthRef.current || 60;
      const h = env?.height || gridHeightRef.current || 30;

      rocks.forEach((rock) => {
        // Check if this rock is at a crater epicenter ("камень остающийся в краторе сделать больше")
        const isCraterRock = (craterEpicentersRef?.current && craterEpicentersRef.current.has(`${rock.x},${rock.y}`)) ||
          (cratersRef?.current && cratersRef.current.some(c => c.x === rock.x && c.y === rock.y));

        // Deterministic PRNG seeded by rock coordinates (stable, never reshuffles or jumps)
        const seed = (((rock.x * 73856093) ^ (rock.y * 19349663)) >>> 0) || 1;
        const rng = createRng(seed);

        const cliff = createCliffMesh(rng, isCraterRock, rockMaterial, craterRockMaterial);

        // Calculate surface position and normal on the planet
        // Embedded slightly into surface crust so rocks look firmly grounded
        const normal = gridToSphere(rock.x, rock.y, w, h, 1.0).normalize();
        const basePos = normal.clone().multiplyScalar(PLANET_RADIUS - 0.05);
        cliff.position.copy(basePos);

        // 1. Initial orientation along the sphere surface normal
        cliff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

        // 2. "не ровно стоять": apply uneven tilt and irregular orientation
        const arbitrary = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        const tangent = new THREE.Vector3().crossVectors(normal, arbitrary).normalize();
        const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
        const azimuth = rng() * Math.PI * 2;
        const tiltAxis = new THREE.Vector3()
          .addScaledVector(tangent, Math.cos(azimuth))
          .addScaledVector(bitangent, Math.sin(azimuth))
          .normalize();

        // Slanted / crooked tilt angle (approx 12 to 32 degrees)
        const tiltAngle = 0.06 + rng() * 0.14;
        const tiltQuat = new THREE.Quaternion().setFromAxisAngle(tiltAxis, tiltAngle);
        cliff.quaternion.premultiply(tiltQuat);

        // Random yaw spin around normal
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(normal, rng() * Math.PI * 2);
        cliff.quaternion.premultiply(yawQuat);

        rocksGroup.add(cliff);
      });
    };

    // --- Update Agents Mesh ---
    const dummy = new THREE.Object3D();
    const upVector = new THREE.Vector3(0, 1, 0);
    const colorReady = new THREE.Color(0x00ff88);
    const colorStable = new THREE.Color(0xffd000);
    const colorStarving = new THREE.Color(0xff3355);

    const updateAgents = () => {
      const currentAgents = agentsRef.current || [];
      const env = envRef.current;
      const w = env?.width || gridWidthRef.current || 60;
      const h = env?.height || gridHeightRef.current || 30;

      agentInstancedMesh.count = Math.min(currentAgents.length, maxAgents);

      let selectedAgentPos = null;

      const currentIds = new Set();

      for (let i = 0; i < agentInstancedMesh.count; i++) {
        const a = currentAgents[i];
        currentIds.add(a.id);
        const targetPos = gridToSphere(a.x, a.y, w, h, PLANET_RADIUS + 0.18);

        let curPos = agentPosMap.current.get(a.id);
        if (!curPos) {
          curPos = targetPos.clone();
          agentPosMap.current.set(a.id, curPos);
        } else {
          curPos.lerp(targetPos, 0.2); // Smooth interpolation
        }

        dummy.position.copy(curPos);
        const normal = curPos.clone().normalize();
        dummy.quaternion.setFromUnitVectors(upVector, normal);
        dummy.scale.set(1, 1.25, 1);
        dummy.updateMatrix();

        agentInstancedMesh.setMatrixAt(i, dummy.matrix);

        let col = colorStarving;
        if (a.energy > 120) {
          col = colorReady;
        } else if (a.energy >= 60) {
          col = colorStable;
        }
        agentInstancedMesh.setColorAt(i, col);

        if (a.isSelected) {
          selectedAgentPos = curPos;
        }
      }

      agentInstancedMesh.instanceMatrix.needsUpdate = true;
      if (agentInstancedMesh.instanceColor) {
        agentInstancedMesh.instanceColor.needsUpdate = true;
      }

      if (selectedAgentPos) {
        beaconGroup.position.copy(selectedAgentPos);
        beaconGroup.quaternion.setFromUnitVectors(upVector, selectedAgentPos.clone().normalize());
        beaconGroup.visible = true;
      } else {
        beaconGroup.visible = false;
      }

      // Cleanup dead agents
      for (const id of agentPosMap.current.keys()) {
        if (!currentIds.has(id)) {
          agentPosMap.current.delete(id);
        }
      }
    };

    // --- Update Sun Position Aligned With Surface Subsolar Point ---
    const updateSun = () => {
      const env = envRef.current;
      const w = env?.width || gridWidth;
      const sunX = env?.sun_x ?? 0;

      const alphaSun = (sunX / w) * Math.PI * 2;
      const dist = 32;

      const sx = -dist * Math.cos(alphaSun);
      const sz = dist * Math.sin(alphaSun);
      const sy = 4;

      sunLight.position.set(sx, sy, sz);
      sunMesh.position.set(sx * 0.95, sy * 0.95, sz * 0.95);
    };

    // Helper to calculate exact local planet surface color at (gx, gy)
    const getPlanetSurfaceColor = (gx, gy) => {
      const env = envRef.current;
      const w = env?.width || gridWidthRef.current || 60;
      const sunX = env?.sun_x ?? 0;
      const terminators = env?.terminator_bands || [];

      // 1. Base night zone cosmic slate-indigo
      let r = 0.08, g = 0.13, b = 0.26;

      // 2. Day / hot zone centered at sunX: warm terracotta/amber
      if (env?.sun_x !== undefined) {
        let dx = Math.abs(gx - (sunX % w));
        dx = Math.min(dx, w - dx);
        const hotHalfWidth = w / 4;
        if (dx < hotHalfWidth * 1.25) {
          const factor = Math.max(0, 1 - dx / (hotHalfWidth * 1.25));
          r = r * (1 - factor) + 0.65 * factor;
          g = g * (1 - factor) + 0.32 * factor;
          b = b * (1 - factor) + 0.14 * factor;
        }
      }

      // 3. Terminator bands: twilight cyan
      if (terminators && terminators.length > 0) {
        for (const band of terminators) {
          const centerX = band.center_x !== undefined ? band.center_x : band.min_x + band.width / 2;
          let dx = Math.abs(gx - centerX);
          dx = Math.min(dx, w - dx);
          if (dx < band.width) {
            const factor = Math.max(0, 1 - dx / band.width) * 0.6;
            r = r * (1 - factor) + 0.0 * factor;
            g = g * (1 - factor) + 0.60 * factor;
            b = b * (1 - factor) + 0.75 * factor;
          }
        }
      }

      return new THREE.Color(r, g, b);
    };

    // --- 3D Impact Craters System with Central Permanent Cliff ---
    const spawn3DCrater = (position, normal, simRadius = 3.0, gridX = 0, gridY = 0, craterId = null, createdAt = null, duration = 25000) => {
      const id = craterId || `crater_${gridX}_${gridY}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const cCreatedAt = createdAt || Date.now();
      const cDuration = duration || 25000;

      const craterGroup = new THREE.Group();
      craterGroup.position.copy(position).addScaledVector(normal, 0.025);
      craterGroup.quaternion.setFromUnitVectors(upVector, normal);

      const craterVisualRadius = Math.max(0.75, (simRadius / (gridWidthRef.current || 60)) * 2 * Math.PI * PLANET_RADIUS * 0.55);

      // Planet local surface color for residual crater ("цвет остаточного кратера должен совпадать с цветом планеты")
      const planetColor = getPlanetSurfaceColor(gridX, gridY);
      const initialBasinColor = new THREE.Color(0x14100e);
      const initialRimColor = new THREE.Color(0x28201c);
      const targetBasinColor = planetColor.clone().multiplyScalar(0.82);
      const targetRimColor = planetColor.clone().multiplyScalar(1.25);

      // 1. Crater Floor / Ring surrounding the central cliff (enlarged inner hole for bigger cliff)
      const innerHole = Math.max(0.42, craterVisualRadius * 0.28);
      const basinGeom = new THREE.RingGeometry(innerHole, craterVisualRadius, 32);
      basinGeom.rotateX(-Math.PI / 2);
      const basinMat = new THREE.MeshStandardMaterial({
        color: initialBasinColor.clone(),
        roughness: 0.95,
        metalness: 0.05,
        transparent: true,
        opacity: 0.92,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const basinMesh = new THREE.Mesh(basinGeom, basinMat);
      craterGroup.add(basinMesh);

      // 2. Raised Crater Rim (Torus ejecta wall)
      const rimRadius = craterVisualRadius * 0.88;
      const tubeRadius = craterVisualRadius * 0.14;
      const rimGeom = new THREE.TorusGeometry(rimRadius, tubeRadius, 8, 32);
      rimGeom.rotateX(Math.PI / 2);
      const rimMat = new THREE.MeshStandardMaterial({
        color: initialRimColor.clone(),
        roughness: 0.92,
        flatShading: true,
        transparent: true,
        opacity: 0.92,
      });
      const rimMesh = new THREE.Mesh(rimGeom, rimMat);
      rimMesh.scale.set(1, 0.45, 1);
      rimMesh.position.y = tubeRadius * 0.25;
      craterGroup.add(rimMesh);

      // 3. Glowing Magma Embers (Cools down from fiery orange into crust)
      const emberGeom = new THREE.RingGeometry(innerHole, craterVisualRadius * 0.55, 24);
      emberGeom.rotateX(-Math.PI / 2);
      const emberMat = new THREE.MeshBasicMaterial({
        color: 0xff4500,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      const emberMesh = new THREE.Mesh(emberGeom, emberMat);
      emberMesh.position.y = 0.01;
      craterGroup.add(emberMesh);

      cratersGroup.add(craterGroup);

      activeCraters.push({
        id,
        group: craterGroup,
        basinMat,
        rimMat,
        emberMat,
        initialBasinColor,
        initialRimColor,
        targetBasinColor,
        targetRimColor,
        createdAt: cCreatedAt,
        duration: cDuration,
        position: position.clone(),
      });
    };

    // --- Disaster Trigger & 3D Visual Effects ---
    const trigger3DEffect = (type, position, normal, params = {}, gridX = 0, gridY = 0, craterId = null) => {
      const effectGroup = new THREE.Group();
      effectGroup.position.copy(position);
      effectGroup.quaternion.setFromUnitVectors(upVector, normal);

      if (type === 'meteorite') {
        const rad = params?.radius || 3.0;
        spawn3DCrater(position, normal, rad, gridX, gridY, craterId);

        const ringGeom = new THREE.RingGeometry(0.1, 0.45, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xff3700,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2;
        effectGroup.add(ring);

        // Fiery blast sphere
        const flashGeom = new THREE.SphereGeometry(0.4, 16, 16);
        const flashMat = new THREE.MeshBasicMaterial({
          color: 0xff9900,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
        });
        const flash = new THREE.Mesh(flashGeom, flashMat);
        effectGroup.add(flash);

        activeEffectsRef.current.push({
          group: effectGroup,
          type: 'meteorite',
          progress: 0,
          mesh: ring,
          flash: flash,
          maxRadius: Math.max(1.8, rad * 0.6),
          duration: 45,
        });
      } else if (type === 'wind') {
        const ringGeom = new THREE.RingGeometry(0.2, 0.45, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x00f2fe,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2;
        effectGroup.add(ring);

        activeEffectsRef.current.push({
          group: effectGroup,
          type: 'wind',
          progress: 0,
          mesh: ring,
          maxRadius: 1.9,
          duration: 50,
        });
      } else if (type === 'eraser') {
        const ringGeom = new THREE.RingGeometry(0.1, 0.25, 16);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2;
        effectGroup.add(ring);

        activeEffectsRef.current.push({
          group: effectGroup,
          type: 'eraser',
          progress: 0,
          mesh: ring,
          maxRadius: 1.5,
          duration: 30,
        });
      } else if (type === 'depression') {
        const lvl = params?.level || 1;
        const ringGeom = new THREE.RingGeometry(0.1, 0.35, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: lvl === 2 ? 0x10b981 : 0x06b6d4,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2;
        effectGroup.add(ring);

        activeEffectsRef.current.push({
          group: effectGroup,
          type: 'depression',
          progress: 0,
          mesh: ring,
          maxRadius: Math.max(1.2, (params?.size || 2) * 0.5),
          duration: 35,
        });
      } else {
        const ringGeom = new THREE.RingGeometry(0.1, 0.25, 16);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x99aacc,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2;
        effectGroup.add(ring);

        activeEffectsRef.current.push({
          group: effectGroup,
          type: 'rocks',
          progress: 0,
          mesh: ring,
          maxRadius: 1.2,
          duration: 35,
        });
      }

      scene.add(effectGroup);
    };

    // --- Raycasting for Agent Click & Disasters ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let mouseDownPos = { x: 0, y: 0 };

    const handleMouseDown = (e) => {
      mouseDownPos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e) => {
      const dx = Math.abs(e.clientX - mouseDownPos.x);
      const dy = Math.abs(e.clientY - mouseDownPos.y);
      if (dx > 4 || dy > 4) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(planetMesh);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const uv = hit.uv;

        const env = envRef.current;
        const w = env?.width || gridWidthRef.current || 60;
        const h = env?.height || gridHeightRef.current || 30;

        let gridX = Math.floor(uv.x * w);
        gridX = ((gridX % w) + w) % w;
        let gridY = Math.floor((1 - uv.y) * h);
        gridY = Math.max(0, Math.min(h - 1, gridY));

        const curDisaster = disasterRef.current;

        const currentAgents = agentsRef.current || [];
        const clickedAgent = currentAgents.find(a => Math.abs(a.x - gridX) <= 0 && Math.abs(a.y - gridY) <= 0)
          || currentAgents.find(a => Math.abs(a.x - gridX) <= 1 && Math.abs(a.y - gridY) <= 1);

        if (clickedAgent) {
          currentAgents.forEach(a => a.isSelected = false);
          clickedAgent.isSelected = true;
          onAgentSelectRef.current?.(clickedAgent);
        } else if (!curDisaster) {
          currentAgents.forEach(a => a.isSelected = false);
          onAgentSelectRef.current?.(null);
        }

        if (curDisaster) {
          const params = disasterParamsRef.current;
          let craterId = null;

          if (curDisaster === 'meteorite') {
            const rad = params?.radius || 3.0;
            craterId = `crater_${gridX}_${gridY}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const newCrater = {
              id: craterId,
              x: gridX,
              y: gridY,
              radius: rad,
              createdAt: Date.now(),
              duration: 25000,
            };
            onAddCraterRef.current?.(newCrater);
            if (craterEpicentersRef?.current) {
              craterEpicentersRef.current.add(`${gridX},${gridY}`);
            }

            if (envRef.current) {
              if (!envRef.current.rocks) envRef.current.rocks = [];
              envRef.current.rocks = envRef.current.rocks.filter(r => {
                let dx = Math.abs(r.x - gridX);
                dx = Math.min(dx, w - dx);
                const dy = Math.abs(r.y - gridY);
                return Math.sqrt(dx * dx + dy * dy) > rad;
              });
              // Leave permanent cliff in the center ("в центре после охлаждения метиорита остается скала и не исчезает")
              envRef.current.rocks.push({ x: gridX, y: gridY });
              update3DRocks();

              // Add depression cells (level 2 near center, level 1 further out)
              if (!envRef.current.depressions) envRef.current.depressions = [];
              const rInt = Math.ceil(rad);
              for (let dy = -rInt; dy <= rInt; dy++) {
                for (let dx = -rInt; dx <= rInt; dx++) {
                  const d = Math.sqrt(dx * dx + dy * dy);
                  if (d <= rad) {
                    const nx = (gridX + dx + w) % w;
                    const ny = gridY + dy;
                    if (ny >= 0 && ny < h) {
                      const lvl = d <= rad * 0.5 ? 2 : 1;
                      const ex = envRef.current.depressions.findIndex(dep => dep.x === nx && dep.y === ny);
                      if (ex >= 0) {
                        envRef.current.depressions[ex].level = Math.max(envRef.current.depressions[ex].level, lvl);
                      } else {
                        envRef.current.depressions.push({ x: nx, y: ny, level: lvl });
                      }
                    }
                  }
                }
              }
              lastRenderedDepressions = null;
              updatePlanetTexture();
            }
          } else if (curDisaster === 'depression') {
            const lvl = parseInt(params?.level || 1);
            const sz = parseInt(params?.size || 2);
            const offset = Math.floor(sz / 2);
            if (envRef.current) {
              if (!envRef.current.depressions) envRef.current.depressions = [];
              for (let dy = -offset; dy < sz - offset; dy++) {
                for (let dx = -offset; dx < sz - offset; dx++) {
                  const nx = (gridX + dx + w) % w;
                  const ny = gridY + dy;
                  if (ny >= 0 && ny < h) {
                    const ex = envRef.current.depressions.findIndex(d => d.x === nx && d.y === ny);
                    if (ex >= 0) {
                      envRef.current.depressions[ex].level = lvl;
                    } else {
                      envRef.current.depressions.push({ x: nx, y: ny, level: lvl });
                    }
                  }
                }
              }
              lastRenderedDepressions = null;
              updatePlanetTexture();
            }
          } else if (curDisaster === 'rocks') {
            const size = params?.size || 3;
            const half = Math.floor(size / 2);
            if (envRef.current) {
              if (!envRef.current.rocks) envRef.current.rocks = [];
              for (let dy = -half; dy <= half; dy++) {
                for (let dx = -half; dx <= half; dx++) {
                  const rx = (gridX + dx + w) % w;
                  const ry = gridY + dy;
                  if (ry >= 0 && ry < h) {
                    if (!envRef.current.rocks.some(r => r.x === rx && r.y === ry)) {
                      envRef.current.rocks.push({ x: rx, y: ry });
                    }
                  }
                }
              }
              update3DRocks();
            }
          } else if (curDisaster === 'eraser') {
            const rad = params?.radius || 2.0;
            if (envRef.current && envRef.current.rocks) {
              envRef.current.rocks = envRef.current.rocks.filter(r => {
                let dx = Math.abs(r.x - gridX);
                dx = Math.min(dx, w - dx);
                const dy = Math.abs(r.y - gridY);
                return Math.sqrt(dx * dx + dy * dy) > rad;
              });
              update3DRocks();
            }
            if (envRef.current && envRef.current.depressions) {
              envRef.current.depressions = envRef.current.depressions.filter(d => {
                let dx = Math.abs(d.x - gridX);
                dx = Math.min(dx, w - dx);
                const dy = Math.abs(d.y - gridY);
                return Math.sqrt(dx * dx + dy * dy) > rad;
              });
              lastRenderedDepressions = null;
              updatePlanetTexture();
            }
            onRemoveCratersNearRef.current?.(gridX, gridY, rad, w);
            const eraseWorldDist = (rad / (gridWidthRef.current || 60)) * 2 * Math.PI * PLANET_RADIUS * 0.65;
            for (let i = activeCraters.length - 1; i >= 0; i--) {
              const c = activeCraters[i];
              if (c.position.distanceTo(hit.point) < eraseWorldDist) {
                cratersGroup.remove(c.group);
                c.group.traverse((child) => {
                  if (child.geometry) child.geometry.dispose();
                  if (child.material) child.material.dispose();
                });
                activeCraters.splice(i, 1);
              }
            }
          }

          if (window.triggerDisaster) {
            window.triggerDisaster(curDisaster, gridX, gridY, params);
          }
          trigger3DEffect(curDisaster, hit.point, hit.normal, params, gridX, gridY, craterId);
        }
      } else {
        if (!disasterRef.current) {
          agentsRef.current?.forEach(a => a.isSelected = false);
          onAgentSelectRef.current?.(null);
        }
      }
    };

    const handleAutoDisasterEffect = (e) => {
      const { type, x, y, params } = e.detail;
      const w = envRef.current?.width || gridWidthRef.current || 60;
      const h = envRef.current?.height || gridHeightRef.current || 30;
      const normal = gridToSphere(x, y, w, h, 1.0).normalize();
      const pos = normal.clone().multiplyScalar(PLANET_RADIUS);
      trigger3DEffect(type, pos, normal, params, x, y, null);
    };
    window.addEventListener('autoDisaster', handleAutoDisasterEffect);

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', handleMouseDown);
    domElem.addEventListener('mouseup', handleMouseUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // --- Animation Loop (60 FPS) ---
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      controls.update();

      updatePlanetTexture();
      update3DRocks();
      updateSun();
      updateAgents();

      if (beaconGroup.visible) {
        const pulse = 1 + Math.sin(elapsedTime * 6) * 0.15;
        beaconRing.scale.set(pulse, pulse, pulse);
        beaconBeam.material.opacity = 0.5 + Math.sin(elapsedTime * 8) * 0.25;
      }

      for (let i = activeEffectsRef.current.length - 1; i >= 0; i--) {
        const fx = activeEffectsRef.current[i];
        fx.progress++;
        const ratio = fx.progress / fx.duration;

        if (ratio >= 1) {
          scene.remove(fx.group);
          fx.mesh.geometry.dispose();
          fx.mesh.material.dispose();
          if (fx.flash) {
            fx.flash.geometry.dispose();
            fx.flash.material.dispose();
          }
          activeEffectsRef.current.splice(i, 1);
        } else {
          const scale = 1 + ratio * fx.maxRadius * 3;
          fx.mesh.scale.set(scale, scale, 1);
          fx.mesh.material.opacity = (1 - ratio) * 0.9;
          if (fx.flash) {
            const fScale = 1 + ratio * 2;
            fx.flash.scale.set(fScale, fScale, fScale);
            fx.flash.material.opacity = Math.max(0, (1 - ratio * 2.2) * 0.85);
          }
          if (fx.type === 'wind') {
            fx.mesh.rotation.z += 0.15;
          }
        }
      }

      // Synchronize 3D craters with shared cratersRef
      const now = Date.now();
      const sharedCraters = cratersRef?.current || [];
      const w = envRef.current?.width || gridWidthRef.current || 60;
      const h = envRef.current?.height || gridHeightRef.current || 30;

      // 1. Remove 3D craters that were deleted or expired
      for (let i = activeCraters.length - 1; i >= 0; i--) {
        const c = activeCraters[i];
        const stillInShared = sharedCraters.some(sc => sc.id === c.id);
        const elapsed = now - c.createdAt;
        if (!stillInShared || elapsed >= c.duration) {
          cratersGroup.remove(c.group);
          c.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          activeCraters.splice(i, 1);
        }
      }

      // 2. Clean expired craters from shared cratersRef
      if (cratersRef?.current) {
        cratersRef.current = cratersRef.current.filter(sc => (now - sc.createdAt) < (sc.duration || 25000));
      }

      // 3. Spawn 3D craters for any shared crater not yet in activeCraters
      sharedCraters.forEach(sc => {
        const elapsed = now - sc.createdAt;
        if (elapsed < (sc.duration || 25000) && !activeCraters.some(c => c.id === sc.id)) {
          const normal = gridToSphere(sc.x, sc.y, w, h, 1.0).normalize();
          const pos = normal.clone().multiplyScalar(PLANET_RADIUS);
          spawn3DCrater(pos, normal, sc.radius || 3.0, sc.x, sc.y, sc.id, sc.createdAt, sc.duration || 25000);
        }
      });

      // 4. Update & weather 3D impact craters
      // "после метиорта визуализируется кратор временно на 3д а в центре после охлождения метиорита остается скала и не исчезает. цвет остаточного кратера должен совпадать с цветом планеты (3д)"
      for (let i = activeCraters.length - 1; i >= 0; i--) {
        const c = activeCraters[i];
        const elapsed = now - c.createdAt;
        const progress = Math.min(1.0, elapsed / c.duration); // 0.0 -> 1.0

        if (progress >= 1.0) {
          cratersGroup.remove(c.group);
          c.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          activeCraters.splice(i, 1);
        } else {
          // 1. Initial cooling phase (first 25%): fiery magma cools down and solidifies
          if (progress < 0.25) {
            c.emberMat.opacity = (1 - progress * 4) * 0.85;
          } else {
            c.emberMat.opacity = 0;
          }

          // 2. Color transition to planet surface color:
          // "цвет остаточного кратера должен совпадать с цветом планеты (3д)"
          const coolRatio = Math.min(1.0, progress * 2.5); // smoothly transitions to match planet
          c.basinMat.color.copy(c.initialBasinColor).lerp(c.targetBasinColor, coolRatio);
          c.rimMat.color.copy(c.initialRimColor).lerp(c.targetRimColor, coolRatio);

          // 3. Weathering and fading phase (from 50% to 100%): temporary crater ejecta blends away
          if (progress > 0.5) {
            const fade = 1 - (progress - 0.5) / 0.5; // 1.0 -> 0.0
            c.basinMat.opacity = fade * 0.92;
            c.rimMat.opacity = fade * 0.92;
          }
        }
      }

      renderer.render(scene, camera);
    };

    updatePlanetTexture();
    update3DRocks();
    updateAgents();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('autoDisaster', handleAutoDisasterEffect);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('mousedown', handleMouseDown);
      domElem.removeEventListener('mouseup', handleMouseUp);

      renderer.dispose();
      planetGeometry.dispose();
      planetMaterial.dispose();
      planetTexture.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      agentGeometry.dispose();
      agentMaterial.dispose();
      rockMaterial.dispose();
      craterRockMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();

      while (rocksGroup.children.length > 0) {
        const obj = rocksGroup.children[0];
        rocksGroup.remove(obj);
        obj.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
        });
      }

      activeCraters.forEach((c) => {
        cratersGroup.remove(c.group);
        c.group.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      });
      activeCraters.length = 0;

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={styles.planetWrapper}>
      <div ref={mountRef} className={styles.planetCanvas} />

      {/* Floating HUD Controls */}
      <div className={styles.planetOverlay}>
        <div className={styles.hudBadge}>
          <span className={styles.hudTitle}>🪐 Меркурий 3D</span>
          <span className={styles.hudSub}>
            ☀️ Солнце: {envRef.current?.sun_x !== undefined ? `${Math.round((envRef.current.sun_x / (envRef.current.width || 60)) * 360)}°` : '—'} | 
            👥 Агенты: {agents.length}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legendCard}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#00ff88' }} />
          <span>Энергия &gt; 120 (Размножение)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#ffd000' }} />
          <span>Энергия 60-120 (Норма)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#ff3355' }} />
          <span>Энергия &lt; 60 (Истощение)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ background: '#00f2fe' }} />
          <span>Полоса Терминатора (Комфорт)</span>
        </div>
      </div>
    </div>
  );
}
