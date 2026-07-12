import * as THREE from "three";
import { buildingMaterial } from "./materials.js";
import { PATH_POINTS } from "./waypoints.js";

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

function createPerimeterBuildings(group, collisions, curve, bounds, rand) {
  const spacing = 14;
  const inset = 3;
  const pathClearance = 7;

  function tryPlace(x, z, rotY) {
    if (distToPath(x, z, curve) < pathClearance) return false;
    const w = 5 + rand() * 4;
    const d = 5 + rand() * 4;
    const h = 16 + rand() * 12;
    const tone = rand() > 0.5 ? "dark" : "mid";
    addBuilding(group, collisions, x, z, w, d, h, rotY, tone);
    return true;
  }

  for (let x = bounds.xMin + 5; x <= bounds.xMax - 5; x += spacing) {
    tryPlace(x, bounds.zMax - inset, 0);
    tryPlace(x + spacing * 0.5, bounds.zMin + inset, Math.PI);
  }

  for (let z = bounds.zMin + 12; z <= bounds.zMax - 12; z += spacing) {
    tryPlace(bounds.xMin + inset, z, Math.PI / 2);
    tryPlace(bounds.xMax - inset, z + spacing * 0.5, -Math.PI / 2);
  }
}

export function createCity(curve) {
  const group = new THREE.Group();
  const collisions = [];
  const rand = seededRandom(42);

  const pathClearance = 5.5;
  const bounds = { xMin: -38, xMax: 38, zMin: -145, zMax: 22 };
  const targetCount = 42;
  let placed = 0;
  let attempts = 0;

  createPerimeterBuildings(group, collisions, curve, bounds, seededRandom(7));

  while (placed < targetCount && attempts < 800) {
    attempts += 1;
    const x = bounds.xMin + rand() * (bounds.xMax - bounds.xMin);
    const z = bounds.zMin + rand() * (bounds.zMax - bounds.zMin);

    if (distToPath(x, z, curve) < pathClearance) continue;
    if (z > 18 && z < 30 && Math.abs(x) > 6 && Math.abs(x) < 30) continue;
    if (z > 2 && Math.abs(x) < 10) continue;
    if (z > 10 && Math.abs(x) < 12) continue;
    if (z < -125 && Math.abs(x) < 22) continue;

    const distEdgeX = Math.min(x - bounds.xMin, bounds.xMax - x);
    const distEdgeZ = Math.min(z - bounds.zMin, bounds.zMax - z);
    if (distEdgeX < 8 || distEdgeZ < 8) continue;

    const w = 2.2 + rand() * 3.5;
    const d = 2.2 + rand() * 3.5;
    const h = 3 + rand() * 14;
    const tone = rand() > 0.55 ? "dark" : rand() > 0.5 ? "mid" : "light";
    const rotY = (rand() - 0.5) * 0.35;

    addBuilding(group, collisions, x, z, w, d, h, rotY, tone);
    placed += 1;
  }

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
