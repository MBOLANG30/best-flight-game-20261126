// The island of Meridian Run: one deterministic height function, shared by the
// terrain mesh, the crash check and the placement of town, trees and rings, so
// what you see is what you can hit. The island has a beach coast, green fields,
// a river, a town, forested hills and two snowy peaks, with a runway cut flat
// near its centre.
import { PALETTE, WORLD } from './config.js';
import { createRandom, valueNoise } from './random.js';

const SEED = 20261126;
const RUNWAY_HALF_W = 20;
const RUNWAY_HALF_L = 430;
const TOWN = { x: 430, z: 320, radius: 230 };

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** The river's centre line: it meanders down the east side of the island. */
function riverX(z) {
  return 950 + 420 * Math.sin(z * 0.00085) + 160 * Math.sin(z * 0.0021 + 1.7);
}

function distanceToRunway(x, z) {
  const dx = Math.max(Math.abs(x) - RUNWAY_HALF_W, 0);
  const dz = Math.max(Math.abs(z) - RUNWAY_HALF_L, 0);
  return Math.hypot(dx, dz);
}

/** Ground height in metres at (x, z). Sea level is 0; the runway sits at 2 m. */
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z) / WORLD.half;
  const coast = 1 - smoothstep(0.72, 1.0, r);
  let h = valueNoise(x, z, 900, 11) * 42 + valueNoise(x, z, 320, 23) * 15 + valueNoise(x, z, 90, 37) * 4;
  const peakA = Math.exp(-((x + 1500) ** 2 + (z + 1450) ** 2) / (2 * 620 ** 2));
  const peakB = Math.exp(-((x - 1650) ** 2 + (z - 1500) ** 2) / (2 * 700 ** 2));
  h += peakA * 105 + peakB * 92;
  h = h * coast - 7 * (1 - coast);
  // Carve the river valley on the east side.
  const riverD = Math.abs(x - riverX(z));
  h -= 9 * (1 - smoothstep(0, 70, riverD)) * clamp01(h / 8 + 0.4);
  // Flatten the runway strip and the town shelf.
  const runwayFlat = 1 - smoothstep(0, 90, distanceToRunway(x, z));
  h = h * (1 - runwayFlat) + 2 * runwayFlat;
  const townD = Math.hypot(x - TOWN.x, z - TOWN.z);
  const townFlat = 1 - smoothstep(TOWN.radius * 0.4, TOWN.radius, townD);
  h = h * (1 - townFlat * 0.85) + 9 * townFlat * 0.85;
  return h;
}

/** The ring course: twelve golden rings on a loop around the island. */
export function ringCourse() {
  const points = [
    [0, 95, 60],
    [620, 130, 420],
    [1150, 160, 980],
    [900, 120, 1620],
    [120, 150, 1980],
    [-820, 180, 1420],
    [-1450, 160, 620],
    [-1250, 130, -320],
    [-620, 170, -1150],
    [220, 140, -1650],
    [920, 120, -1180],
    [520, 95, -560],
  ];
  return points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    const nx = next[0] - p[0];
    const ny = next[1] - p[1];
    const nz = next[2] - p[2];
    const len = Math.hypot(nx, ny, nz);
    return { x: p[0], y: p[1], z: p[2], nx: nx / len, ny: ny / len, nz: nz / len };
  });
}

function colourFor(h, x, z) {
  const field = valueNoise(x, z, 260, 51);
  const forest = valueNoise(x, z, 420, 67);
  if (h < 2.4) return PALETTE.sand;
  if (h > 96) return PALETTE.snow;
  if (h > 58) return PALETTE.rock;
  if (forest > 0.66 && h > 8 && h < 55) return PALETTE.forest;
  if (field > 0.62) return PALETTE.fieldA;
  if (field > 0.52) return PALETTE.fieldB;
  return PALETTE.grass;
}

/**
 * Build the island: terrain mesh with vertex colours, sea, runway with markings,
 * town, instanced trees, drifting clouds and the ring course. Returns the group
 * plus the ring meshes (for the next-ring highlight) and the clouds (animated).
 */
export function buildIsland(THREE) {
  const group = new THREE.Group();
  group.name = 'island';

  // --- Terrain: a 200x200 heightfield over the whole island, vertex-coloured.
  const SEG = 200;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    c.set(colourFor(h, x, z));
    // Slight brightness variation so fields read as patches, not flat colour.
    const shade = 0.92 + valueNoise(x, z, 130, 83) * 0.16;
    colours[i * 3] = c.r * shade;
    colours[i * 3 + 1] = c.g * shade;
    colours[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  terrain.name = 'terrain';
  group.add(terrain);

  // --- Sea: a flat disc of water at sea level, under the island's edge.
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD.half * 1.6, 48),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.4;
  sea.name = 'sea';
  group.add(sea);

  // --- Runway: dark asphalt with a dashed centreline and threshold bars.
  const runway = new THREE.Group();
  runway.name = 'runway';
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY_HALF_W * 2, RUNWAY_HALF_L * 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.runway }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 2.15;
  runway.add(strip);
  const markMat = new THREE.MeshBasicMaterial({ color: PALETTE.runwayMark });
  const dashGeo = new THREE.BoxGeometry(1.2, 0.06, 22);
  for (let z = -390; z <= 390; z += 52) {
    const dash = new THREE.Mesh(dashGeo, markMat);
    dash.position.set(0, 2.2, z);
    runway.add(dash);
  }
  const barGeo = new THREE.BoxGeometry(4, 0.06, 26);
  for (const side of [-1, 1]) {
    for (let k = -2; k <= 2; k += 1) {
      const bar = new THREE.Mesh(barGeo, markMat);
      bar.position.set(k * 6, 2.2, side * 395);
      runway.add(bar);
    }
  }
  group.add(runway);

  // --- Town: instanced walls and pyramid roofs on a grid near the runway.
  const rng = createRandom(77);
  const walls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: PALETTE.townWall }),
    72,
  );
  const roofs = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 4),
    new THREE.MeshLambertMaterial({ color: PALETTE.townRoofA }),
    72,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const roofColour = new THREE.Color();
  let placed = 0;
  for (let gx = -4; gx <= 4 && placed < 72; gx += 1) {
    for (let gz = -3; gz <= 3 && placed < 72; gz += 1) {
      if (gx === 0 && Math.abs(gz) <= 1) continue;
      const x = TOWN.x + gx * 42 + rng.range(-8, 8);
      const z = TOWN.z + gz * 46 + rng.range(-8, 8);
      const y = terrainHeight(x, z);
      const w = rng.range(14, 22);
      const d = rng.range(14, 20);
      const hgt = rng.range(9, 16);
      p.set(x, y + hgt / 2, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI));
      s.set(w, hgt, d);
      m.compose(p, q, s);
      walls.setMatrixAt(placed, m);
      roofColour.set(rng.pick([PALETTE.townRoofA, PALETTE.townRoofB]));
      roofs.setColorAt(placed, roofColour);
      p.set(x, y + hgt + 3.5, z);
      s.set(w * 0.78, 7, d * 0.78);
      m.compose(p, q, s);
      roofs.setMatrixAt(placed, m);
      placed += 1;
    }
  }
  walls.count = placed;
  roofs.count = placed;
  walls.name = 'town-walls';
  roofs.name = 'town-roofs';
  group.add(walls);
  group.add(roofs);

  // --- Trees: instanced trunks and cones, scattered on forested ground.
  const treeRng = createRandom(913);
  const treeSpots = [];
  let tries = 0;
  while (treeSpots.length < 420 && tries < 6000) {
    tries += 1;
    const x = treeRng.range(-2300, 2300);
    const z = treeRng.range(-2300, 2300);
    const h = terrainHeight(x, z);
    if (h < 6 || h > 60) continue;
    if (valueNoise(x, z, 420, 67) < 0.6) continue;
    if (distanceToRunway(x, z) < 80) continue;
    if (Math.hypot(x - TOWN.x, z - TOWN.z) < TOWN.radius) continue;
    if (Math.abs(x - riverX(z)) < 50) continue;
    treeSpots.push([x, h, z]);
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.7, 1.1, 7, 5),
    new THREE.MeshLambertMaterial({ color: '#5a4030' }),
    treeSpots.length,
  );
  const canopies = new THREE.InstancedMesh(
    new THREE.ConeGeometry(6.5, 17, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.forest }),
    treeSpots.length,
  );
  treeSpots.forEach(([x, h, z], i) => {
    const sc = treeRng.range(0.8, 1.5);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), treeRng.range(0, Math.PI * 2));
    p.set(x, h + 3.5 * sc, z);
    s.set(sc, sc, sc);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    p.set(x, h + (7 + 8.5) * sc, z);
    m.compose(p, q, s);
    canopies.setMatrixAt(i, m);
  });
  trunks.name = 'tree-trunks';
  canopies.name = 'tree-canopies';
  group.add(trunks);
  group.add(canopies);

  // --- Clouds: soft white puffs drifting over the island.
  const clouds = [];
  const cloudRng = createRandom(4242);
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#c8d8e8', emissiveIntensity: 0.55, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 16; i += 1) {
    const cloud = new THREE.Group();
    const puffs = cloudRng.int(3, 5);
    for (let k = 0; k < puffs; k += 1) {
      const r = cloudRng.range(22, 42);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.position.set(cloudRng.range(-50, 50), cloudRng.range(-6, 8), cloudRng.range(-24, 24));
      puff.scale.y = 0.42;
      cloud.add(puff);
    }
    cloud.position.set(cloudRng.range(-2300, 2300), cloudRng.range(260, 420), cloudRng.range(-2300, 2300));
    cloud.userData.drift = cloudRng.range(2, 5);
    cloud.name = `cloud-${i}`;
    clouds.push(cloud);
    group.add(cloud);
  }

  // --- Rings: golden toruses facing the next ring on the course.
  const course = ringCourse();
  const ringGeo = new THREE.TorusGeometry(18, 1.3, 10, 40);
  const ringMeshes = course.map((ring, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.ringGold,
      emissive: PALETTE.ringGold,
      emissiveIntensity: 0.55,
      metalness: 0.4,
      roughness: 0.35,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.position.set(ring.x, ring.y, ring.z);
    mesh.lookAt(ring.x + ring.nx * 100, ring.y + ring.ny * 100, ring.z + ring.nz * 100);
    mesh.name = `ring-${i}`;
    group.add(mesh);
    return mesh;
  });

  return { group, course, ringMeshes, clouds };
}
