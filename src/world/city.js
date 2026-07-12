import * as THREE from "three";
import { buildingMaterial } from "./materials.js";
import { PATH_POINTS, START_OVERPASS_T } from "./waypoints.js";
import { WORLD_CONFIG } from "./worldConfig.js";

const CITY = WORLD_CONFIG.city;

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function distToPath(x, z, curve, samples = 80) {
  let min = Infinity;
  for (let i = 0; i <= samples; i += 1) {
    const p = curve.getPoint(i / samples);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < min) min = d;
  }
  return Math.sqrt(min);
}

function pushCollision(collisions, x, z, w, d, h, rotY) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  collisions.push({
    cx: x,
    cz: z,
    hx: w / 2 + 0.3,
    hz: d / 2 + 0.3,
    cos,
    sin,
    minY: 0,
    maxY: h + 1,
  });
}

function addBuilding(group, collisions, x, z, w, d, h, rotY, tone) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMaterial(tone));
  mesh.position.set(x, h / 2, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);

  if (h > 10) {
    const bands = Math.floor(h / 2.4);
    for (let b = 1; b < bands; b += 1) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.02, 0.14, d * 1.02),
        buildingMaterial("dark")
      );
      band.position.set(x, b * 2.2, z);
      band.rotation.y = rotY;
      band.frustumCulled = false;
      group.add(band);
    }
  }

  pushCollision(collisions, x, z, w, d, h, rotY);
}

function shouldSkipProceduralSpot(x, z) {
  const absX = Math.abs(x);
  const { overpassFlank, startCorridor, midCorridor, endPlaza, overpassExclusion } = CITY;

  if (z > overpassFlank.zMin && z < overpassFlank.zMax && x < overpassFlank.xMax) return true;
  if (z > overpassExclusion.zMin && z < overpassExclusion.zMax && absX > overpassExclusion.absXMin && absX < overpassExclusion.absXMax) {
    return true;
  }
  if (z > startCorridor.zMin && absX < startCorridor.absXMax) return true;
  if (z > midCorridor.zMin && absX < midCorridor.absXMax) return true;
  if (z < endPlaza.zMax && absX < endPlaza.absXMax) return true;

  return false;
}

function createPerimeterBuildings(group, collisions, curve, bounds, rand) {
  const { perimeterSpacing, perimeterInset, perimeterPathClearance, overpassFlank } = CITY;

  function tryPlace(x, z, rotY) {
    if (distToPath(x, z, curve) < perimeterPathClearance) return false;
    if (z > overpassFlank.zMin && z < overpassFlank.zMax && x < overpassFlank.xMax) return false;
    const w = 5 + rand() * 4;
    const d = 5 + rand() * 4;
    const h = 16 + rand() * 12;
    const tone = rand() > 0.5 ? "dark" : "mid";
    addBuilding(group, collisions, x, z, w, d, h, rotY, tone);
    return true;
  }

  for (let x = bounds.xMin + 5; x <= bounds.xMax - 5; x += perimeterSpacing) {
    tryPlace(x, bounds.zMax - perimeterInset, 0);
    tryPlace(x + perimeterSpacing * 0.5, bounds.zMin + perimeterInset, Math.PI);
  }

  for (let z = bounds.zMin + 12; z <= bounds.zMax - 12; z += perimeterSpacing) {
    tryPlace(bounds.xMin + perimeterInset, z, Math.PI / 2);
    tryPlace(bounds.xMax - perimeterInset, z + perimeterSpacing * 0.5, -Math.PI / 2);
  }
}

function placeWestOverpassBuilding(curve, group, collisions) {
  const start = curve.getPointAt(START_OVERPASS_T);
  const tangent = curve.getTangentAt(START_OVERPASS_T).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const yaw = Math.atan2(tangent.x, tangent.z);
  const pillarOuter = 5.5 + 0.7;
  const w = 5.8;
  const d = 6.4;
  const h = 23;
  const sign = -1;
  const bx = start.x + normal.x * (sign * (pillarOuter + w / 2));
  const bz = start.z + normal.z * (sign * (pillarOuter + w / 2));

  addBuilding(group, collisions, bx, bz, w, d, h, yaw, "dark");
}

export function createCity(curve) {
  const group = new THREE.Group();
  const collisions = [];
  const rand = seededRandom(42);
  const bounds = CITY.bounds;

  createPerimeterBuildings(group, collisions, curve, bounds, seededRandom(7));

  let placed = 0;
  let attempts = 0;

  while (placed < CITY.proceduralCount && attempts < CITY.maxPlacementAttempts) {
    attempts += 1;
    const x = bounds.xMin + rand() * (bounds.xMax - bounds.xMin);
    const z = bounds.zMin + rand() * (bounds.zMax - bounds.zMin);

    if (distToPath(x, z, curve) < CITY.pathClearance) continue;
    if (shouldSkipProceduralSpot(x, z)) continue;

    const distEdgeX = Math.min(x - bounds.xMin, bounds.xMax - x);
    const distEdgeZ = Math.min(z - bounds.zMin, bounds.zMax - z);
    if (distEdgeX < CITY.edgePadding || distEdgeZ < CITY.edgePadding) continue;

    const w = 2.2 + rand() * 3.8;
    const d = 2.2 + rand() * 3.8;
    const h = 4 + rand() * 16;
    const tone = rand() > 0.55 ? "dark" : rand() > 0.5 ? "mid" : "light";
    const rotY = (rand() - 0.5) * 0.35;

    addBuilding(group, collisions, x, z, w, d, h, rotY, tone);
    placed += 1;
  }

  placeWestOverpassBuilding(curve, group, collisions);

  return { group, collisions };
}

export function createGround() {
  const geo = new THREE.PlaneGeometry(200, 220);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -60);
  ground.receiveShadow = true;
  ground.frustumCulled = false;
  return ground;
}

export function createPathCurve() {
  return new THREE.CatmullRomCurve3(PATH_POINTS, false, "catmullrom", 0.42);
}

export function checkCollision(x, z, radius, collisions) {
  for (const box of collisions) {
    const dx = x - box.cx;
    const dz = z - box.cz;
    const localX = dx * box.cos + dz * box.sin;
    const localZ = -dx * box.sin + dz * box.cos;
    if (Math.abs(localX) < box.hx + radius && Math.abs(localZ) < box.hz + radius) {
      return true;
    }
  }
  return false;
}
