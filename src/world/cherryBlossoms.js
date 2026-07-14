import * as THREE from "three";
import { blocksSpaceNeedlePlacement } from "./spaceNeedleConfig.js";
import { blocksLightRailPlacement } from "./lightRailConfig.js";
import { createCherryPetalTrail } from "./cherryPetals.js";
import { worldHeight } from "./terrain.js";

/** Sparse routes — evenly spaced slots, one tree per slot. */
const GROVE_ROUTES = {
  spaceNeedle: [
    new THREE.Vector3(-2.2, 0, 21),
    new THREE.Vector3(-8, 0, 18),
    new THREE.Vector3(-16, 0, 14),
    new THREE.Vector3(-24, 0, 10.5),
    new THREE.Vector3(-31, 0, 7.5),
  ],
  /** North station approach — short pad beside the platform (mirrors south). */
  lightRailNorth: [
    new THREE.Vector3(23.0, 0, 22.2),
    new THREE.Vector3(26.5, 0, 21.8),
    new THREE.Vector3(29.5, 0, 22.4),
    new THREE.Vector3(23.2, 0, 30.8),
    new THREE.Vector3(26.8, 0, 31.0),
    new THREE.Vector3(29.8, 0, 30.6),
  ],
  /** South station approach — both sides of the connector. */
  lightRailSouth: [
    new THREE.Vector3(23.0, 0, -130.8),
    new THREE.Vector3(26.5, 0, -130.4),
    new THREE.Vector3(29.5, 0, -131.0),
    new THREE.Vector3(23.2, 0, -139.0),
    new THREE.Vector3(26.8, 0, -139.2),
    new THREE.Vector3(29.8, 0, -138.8),
  ],
  /** West flank of the elevated guideway between stations. */
  lightRailMid: [
    new THREE.Vector3(27.6, 0, 16),
    new THREE.Vector3(27.4, 0, 6),
    new THREE.Vector3(27.2, 0, -6),
    new THREE.Vector3(27.0, 0, -20),
    new THREE.Vector3(26.9, 0, -36),
    new THREE.Vector3(26.8, 0, -52),
    new THREE.Vector3(26.9, 0, -70),
    new THREE.Vector3(27.1, 0, -88),
    new THREE.Vector3(27.3, 0, -104),
    new THREE.Vector3(27.5, 0, -120),
  ],
};

const TREE_CLEAR_RADIUS = 2.2;
const MIN_TREE_SEPARATION = 10;
const MIN_TREE_SEPARATION_RAIL = 6.2;
const PATH_CLEARANCE = 6.2;
const PATH_SAMPLES = 40;

let groveSamples = null;

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const _branchEnd = new THREE.Vector3();

function blossomMaterial(rand, bright = false) {
  const hues = [0xffb0cc, 0xffa0c0, 0xffc4dc, 0xff98b8];
  const color = hues[Math.floor(rand() * hues.length)];
  return new THREE.MeshStandardMaterial({
    color,
    emissive: bright ? 0xff88b0 : 0x6a2848,
    emissiveIntensity: bright ? 0.14 : 0.08,
    roughness: 0.82,
    metalness: 0,
    flatShading: false,
  });
}

function addBlossomCloud(parent, localPos, radius, rand, emitters) {
  const cloud = new THREE.Group();
  cloud.position.copy(localPos);
  parent.add(cloud);

  const puffCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < puffCount; i += 1) {
    const r = radius * (0.72 + rand() * 0.45);
    const puff = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      blossomMaterial(rand, i === 0)
    );
    puff.position.set(
      (rand() - 0.5) * radius * 0.55,
      (rand() - 0.5) * radius * 0.35,
      (rand() - 0.5) * radius * 0.55
    );
    puff.castShadow = true;
    puff.receiveShadow = true;
    cloud.add(puff);
  }

  const marker = new THREE.Object3D();
  marker.userData.emitterRadius = radius * 0.95;
  cloud.add(marker);
  emitters.push(marker);
}

function addBranch(parent, originY, yaw, tilt, length, thickness, scale, rand, emitters) {
  const branch = new THREE.Group();
  branch.position.y = originY;
  branch.rotation.order = "YXZ";
  branch.rotation.y = yaw;
  branch.rotation.x = -tilt;
  parent.add(branch);

  const wood = new THREE.MeshStandardMaterial({ color: 0x5e4c42, roughness: 0.94, metalness: 0 });
  const limb = new THREE.Mesh(
    new THREE.CylinderGeometry(thickness * 0.55, thickness, length, 6),
    wood
  );
  limb.position.y = length / 2;
  limb.castShadow = true;
  limb.receiveShadow = true;
  branch.add(limb);

  _branchEnd.set(0, length, 0);
  addBlossomCloud(branch, _branchEnd, 0.55 * scale, rand, emitters);

  if (rand() > 0.4) {
    const twigLen = length * (0.38 + rand() * 0.15);
    const twig = new THREE.Group();
    twig.position.set(0, length * 0.72, 0);
    twig.rotation.order = "YXZ";
    twig.rotation.y = (rand() - 0.5) * 1.4;
    twig.rotation.x = -0.35 - rand() * 0.45;
    branch.add(twig);

    const twigMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(thickness * 0.22, thickness * 0.38, twigLen, 5),
      wood
    );
    twigMesh.position.y = twigLen / 2;
    twig.add(twigMesh);

    addBlossomCloud(twig, new THREE.Vector3(0, twigLen, 0), 0.38 * scale, rand, emitters);
  }
}

function createCherryBlossomTree(rand) {
  const tree = new THREE.Group();
  tree.name = "cherry-blossom";

  const scale = 1 + rand() * 0.25;
  const trunkH = 3.1 * scale;
  const trunkR = 0.16 * scale;
  const emitters = [];

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3c34, roughness: 0.95, metalness: 0 });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.72, trunkR, trunkH, 8),
    trunkMat
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  const branchCount = 4 + Math.floor(rand() * 2);
  for (let b = 0; b < branchCount; b += 1) {
    const yaw = (b / branchCount) * Math.PI * 2 + rand() * 0.5;
    const tilt = 0.55 + rand() * 0.45;
    const length = (1.15 + rand() * 0.65) * scale;
    const startY = trunkH * (0.42 + rand() * 0.28);
    addBranch(tree, startY, yaw, tilt, length, trunkR * 0.55, scale, rand, emitters);
  }

  addBlossomCloud(tree, new THREE.Vector3(0, trunkH + 0.15 * scale, 0), 0.75 * scale, rand, emitters);

  tree.userData.petalEmitters = emitters;

  return tree;
}

function buildPathSamples(pathCurve) {
  const samples = [];
  for (let i = 0; i <= PATH_SAMPLES; i += 1) {
    samples.push(pathCurve.getPoint(i / PATH_SAMPLES));
  }
  return samples;
}

function distToPath(x, z, pathSamples) {
  let min = Infinity;
  for (const p of pathSamples) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < min) min = d;
  }
  return Math.sqrt(min);
}

function isTooCloseToOtherTrees(x, z, placed, minSeparation = MIN_TREE_SEPARATION) {
  const minSq = minSeparation * minSeparation;
  for (const p of placed) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < minSq) return true;
  }
  return false;
}

function canPlaceTree(x, z, ctx) {
  if (blocksSpaceNeedlePlacement(x, z, 4.5)) return false;
  if (blocksLightRailPlacement(x, z)) return false;
  if (distToPath(x, z, ctx.pathSamples) < PATH_CLEARANCE) return false;
  if (ctx.checkCollision(x, z, TREE_CLEAR_RADIUS, ctx.collisions)) return false;
  if (isTooCloseToOtherTrees(x, z, ctx.placed, ctx.minSeparation)) return false;
  return true;
}

function recordGroveSample(x, z, samples) {
  samples.push({ x, z });
}

function placeTree(group, x, z, rand, petalTrail, samples, placed) {
  recordGroveSample(x, z, samples);
  placed.push({ x, z });
  const tree = createCherryBlossomTree(rand);
  tree.position.set(x, worldHeight(x, z), z);
  tree.rotation.y = rand() * Math.PI * 2;
  group.add(tree);
  petalTrail.registerTree(tree);
}

function tryPlaceAt(group, x, z, rand, petalTrail, samples, placed, ctx) {
  if (!canPlaceTree(x, z, ctx)) return false;
  placeTree(group, x, z, rand, petalTrail, samples, placed);
  return true;
}

function addTreesAlongCurve(group, curve, rand, petalTrail, samples, placed, ctx, options = {}) {
  const slotCount = options.slotCount ?? 4;
  const sideOffset = options.sideOffset ?? 4.8;
  const skipEnds = options.skipEnds ?? 0.12;

  for (let i = 0; i < slotCount; i += 1) {
    const t = skipEnds + ((i + 0.5) / slotCount) * (1 - skipEnds * 2);
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const primarySide = i % 2 === 0 ? 1 : -1;
    const offsets = [sideOffset, sideOffset * 1.15, sideOffset * 0.9];
    const sides = [primarySide, -primarySide];

    let placedHere = false;
    for (const side of sides) {
      for (const offset of offsets) {
        const tx = point.x + normal.x * offset * side;
        const tz = point.z + normal.z * offset * side;
        if (tryPlaceAt(group, tx, tz, rand, petalTrail, samples, placed, ctx)) {
          placedHere = true;
          break;
        }
      }
      if (placedHere) break;
    }
  }
}

function addTreesAlongPathSegment(group, pathCurve, t0, t1, rand, petalTrail, samples, placed, ctx, options = {}) {
  const slotCount = options.slotCount ?? 4;
  const sideOffset = options.sideOffset ?? 6.2;
  const span = Math.max(0.02, t1 - t0);

  for (let i = 0; i < slotCount; i += 1) {
    const localT = (i + 0.5) / slotCount;
    const t = t0 + localT * span;
    const point = pathCurve.getPointAt(t);
    const tangent = pathCurve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const primarySide = i % 2 === 0 ? 1 : -1;
    const offsets = [sideOffset, sideOffset * 1.12];
    const sides = [primarySide, -primarySide];

    let placedHere = false;
    for (const side of sides) {
      for (const offset of offsets) {
        const tx = point.x + normal.x * offset * side;
        const tz = point.z + normal.z * offset * side;
        if (tryPlaceAt(group, tx, tz, rand, petalTrail, samples, placed, ctx)) {
          placedHere = true;
          break;
        }
      }
      if (placedHere) break;
    }
  }
}

export function isNearCherryGrove(x, z, radius = 4.2) {
  if (!groveSamples?.length) return false;
  const r2 = radius * radius;
  for (const p of groveSamples) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz <= r2) return true;
  }
  return false;
}

export function createCherryBlossoms({ pathCurve, collisions, checkCollision }) {
  const samples = [];
  const placed = [];
  groveSamples = samples;

  const group = new THREE.Group();
  group.name = "cherry-blossoms";
  const petalTrail = createCherryPetalTrail();
  group.add(petalTrail.group);

  const rand = seededRandom(41);
  const pathSamples = buildPathSamples(pathCurve);
  const ctx = { pathSamples, collisions, checkCollision, placed, minSeparation: MIN_TREE_SEPARATION };
  const railCtx = { ...ctx, minSeparation: MIN_TREE_SEPARATION_RAIL };

  const needleCurve = new THREE.CatmullRomCurve3(GROVE_ROUTES.spaceNeedle, false, "catmullrom", 0.38);
  const northCurve = new THREE.CatmullRomCurve3(GROVE_ROUTES.lightRailNorth, false, "catmullrom", 0.38);
  const southCurve = new THREE.CatmullRomCurve3(GROVE_ROUTES.lightRailSouth, false, "catmullrom", 0.38);
  const midCurve = new THREE.CatmullRomCurve3(GROVE_ROUTES.lightRailMid, false, "catmullrom", 0.38);

  addTreesAlongCurve(group, needleCurve, rand, petalTrail, samples, placed, ctx, {
    slotCount: 4,
    sideOffset: 5.2,
    skipEnds: 0.15,
  });
  addTreesAlongCurve(group, northCurve, rand, petalTrail, samples, placed, railCtx, {
    slotCount: 8,
    sideOffset: 2.6,
    skipEnds: 0.06,
  });
  addTreesAlongCurve(group, southCurve, rand, petalTrail, samples, placed, railCtx, {
    slotCount: 8,
    sideOffset: 2.6,
    skipEnds: 0.06,
  });
  addTreesAlongCurve(group, midCurve, rand, petalTrail, samples, placed, railCtx, {
    slotCount: 10,
    sideOffset: 3.2,
    skipEnds: 0.04,
  });
  // Extra clustered plantings near each station plaza.
  for (const [bx, bz] of [
    [24.5, 24.8],
    [25.2, 29.5],
    [28.8, 25.5],
    [29.2, 29.0],
    [24.5, -132.8],
    [25.2, -137.2],
    [28.8, -133.2],
    [29.2, -136.6],
  ]) {
    tryPlaceAt(group, bx, bz, rand, petalTrail, samples, placed, railCtx);
  }
  addTreesAlongPathSegment(group, pathCurve, 0.1, 0.32, rand, petalTrail, samples, placed, ctx, {
    slotCount: 4,
    sideOffset: 6.8,
  });

  return { group, updateCherryPetals: (dt) => petalTrail.update(dt) };
}
