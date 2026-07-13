import * as THREE from "three";
import { buildingMaterial, brickMaterial } from "./materials.js";
import { addBuildingWindows } from "./buildingWindows.js";
import { START_OVERPASS_T, getPlayerSpawnPoint, isInSpawnClearance } from "./waypoints.js";

function pushCollision(collisions, x, z, w, d, h, rotY = 0) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  collisions.push({
    cx: x,
    cz: z,
    hx: w / 2 + 0.35,
    hz: d / 2 + 0.35,
    cos,
    sin,
    minY: 0,
    maxY: h + 1,
  });
}

function addBox(group, collisions, x, y, z, w, h, d, rotY, mat, collide = true) {
  const isBuilding = collide && h >= 4.5 && w >= 2.5 && d >= 2.5;

  if (isBuilding) {
    const building = new THREE.Group();
    building.position.set(x, y + h / 2, z);
    building.rotation.y = rotY;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    building.add(mesh);
    addBuildingWindows(building, w, d, h, Math.round(x * 23 + z * 41 + h * 5));
    building.frustumCulled = false;
    group.add(building);
    pushCollision(collisions, x, z, w, d, h, rotY);
    return mesh;
  }

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);
  if (collide) pushCollision(collisions, x, z, w, d, h, rotY);
  return mesh;
}

function createStartOverpass(curve, group, collisions, spawn) {
  const overpassT = START_OVERPASS_T;
  const start = curve.getPointAt(overpassT);
  const tangent = curve.getTangentAt(overpassT).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const yaw = Math.atan2(tangent.x, tangent.z);

  const cx = start.x;
  const cz = start.z;

  const concrete = buildingMaterial("mid");
  const dark = buildingMaterial("dark");
  const tunnelMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2e,
    roughness: 0.95,
    metalness: 0,
  });

  const spanW = 16;
  const spanD = 5.5;
  const deckH = 0.75;
  const deckY = 5.8;

  addBox(group, collisions, cx, deckY, cz, spanW, deckH, spanD, yaw, concrete);

  const railH = 0.55;
  const railOff = spanD / 2 + 0.15;
  addBox(
    group,
    [],
    cx + normal.x * railOff,
    deckY + deckH / 2 + railH / 2,
    cz + normal.z * railOff,
    spanW,
    railH,
    0.18,
    yaw,
    dark,
    false
  );
  addBox(
    group,
    [],
    cx - normal.x * railOff,
    deckY + deckH / 2 + railH / 2,
    cz - normal.z * railOff,
    spanW,
    railH,
    0.18,
    yaw,
    dark,
    false
  );

  const pillarPositions = [-5.5, -2, 2, 5.5];
  pillarPositions.forEach((offset) => {
    const px = cx + normal.x * offset;
    const pz = cz + normal.z * offset;
    addBox(group, collisions, px, 0, pz, 1.4, deckY, 1.4, yaw, dark);
  });

  const tunnelWallZ = cz - tangent.z * 2.2;
  const tunnelWallX = cx - tangent.x * 2.2;
  addBox(group, collisions, tunnelWallX, 1.6, tunnelWallZ, spanW - 1, 3.2, 0.65, yaw, tunnelMat);

  const barrierX = cx - tangent.x * 3.6;
  const barrierZ = cz - tangent.z * 3.6;
  addBox(group, collisions, barrierX, 1.1, barrierZ, spanW - 4, 2.2, 0.5, yaw, dark);

  function addConnectedWing(sign) {
    const pillarOuter = 5.5 + 0.7;
    const wingW = 4.2;
    const wingD = spanD + 0.45;
    const wingH = deckY + deckH * 0.45;
    const centerOff = sign * (pillarOuter + wingW / 2);
    const wx = cx + normal.x * centerOff;
    const wz = cz + normal.z * centerOff;

    if (isInSpawnClearance(wx, wz, spawn)) return;

    addBox(group, collisions, wx, 0, wz, wingW, wingH, wingD, yaw, buildingMaterial("light"));

    addBox(
      group,
      [],
      cx + normal.x * sign * (pillarOuter + wingW * 0.34),
      deckY - deckH * 0.1,
      cz,
      wingW * 0.72,
      deckH * 1.35,
      wingD * 0.9,
      yaw,
      concrete,
      false
    );
  }

  addConnectedWing(1);
  addConnectedWing(-1);

  const tunnelLight = new THREE.Mesh(
    new THREE.PlaneGeometry(spanW - 3, 2.8),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 1,
      emissive: 0x111118,
      emissiveIntensity: 0.15,
    })
  );
  tunnelLight.rotation.x = -Math.PI / 2;
  tunnelLight.position.set(cx - tangent.x * 1.5, 0.04, cz - tangent.z * 1.5);
  tunnelLight.frustumCulled = false;
  group.add(tunnelLight);
}

function createEndRoundabout(curve, group, collisions) {
  const end = curve.getPointAt(1);
  const tangent = curve.getTangentAt(1).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const cx = end.x;
  const cz = end.z;

  const asphalt = new THREE.MeshStandardMaterial({
    color: 0xe8e4e8,
    roughness: 0.92,
    metalness: 0,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.8, 6.2, 48), asphalt);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.025, cz);
  ring.receiveShadow = true;
  ring.frustumCulled = false;
  group.add(ring);

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.8, 0.35, 32),
    brickMaterial(0xf0eaee)
  );
  island.position.set(cx, 0.18, cz);
  island.receiveShadow = true;
  island.frustumCulled = false;
  group.add(island);
  pushCollision(collisions, cx, cz, 7.2, 7.2, 0.5);

  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.4, 0.5, 24),
    brickMaterial(0xf6c8d7)
  );
  basin.position.set(cx, 0.55, cz);
  basin.castShadow = true;
  basin.frustumCulled = false;
  group.add(basin);
  pushCollision(collisions, cx, cz, 4.8, 4.8, 0.6);

  const water = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xb8e8f0,
      roughness: 0.15,
      metalness: 0.1,
      emissive: 0xa8dce8,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.88,
    })
  );
  water.position.set(cx, 0.95, cz);
  water.frustumCulled = false;
  water.userData.isFountain = true;
  group.add(water);

  const spurCount = 8;
  for (let i = 0; i < spurCount; i += 1) {
    const angle = (i / spurCount) * Math.PI * 2;
    const sx = cx + Math.cos(angle) * 4.8;
    const sz = cz + Math.sin(angle) * 4.8;
    const spur = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.1), asphalt);
    spur.rotation.y = -angle + Math.PI / 2;
    spur.position.set(sx, 0.03, sz);
    spur.receiveShadow = true;
    spur.frustumCulled = false;
    group.add(spur);
  }

  const behindX = cx - tangent.x * 10;
  const behindZ = cz - tangent.z * 10;
  const buildingOffsets = [-14, -8, -3, 3, 8, 14];

  buildingOffsets.forEach((offset, i) => {
    const bx = behindX + normal.x * offset;
    const bz = behindZ + normal.z * offset;
    const w = 5 + (i % 3) * 1.5;
    const d = 5 + (i % 2) * 2;
    const h = 14 + (i % 4) * 3;
    const rotY = Math.atan2(tangent.x, tangent.z);
    addBox(group, collisions, bx, 0, bz, w, h, d, rotY, buildingMaterial(i % 2 ? "dark" : "mid"));
  });

  const wallX = behindX - tangent.x * 6;
  const wallZ = behindZ - tangent.z * 6;
  addBox(
    group,
    collisions,
    wallX,
    0,
    wallZ,
    34,
    4,
    1.2,
    Math.atan2(tangent.x, tangent.z),
    buildingMaterial("dark")
  );
}

export function createRoadTermini(curve) {
  const group = new THREE.Group();
  const collisions = [];
  const spawn = getPlayerSpawnPoint(curve);

  createStartOverpass(curve, group, collisions, spawn);
  createEndRoundabout(curve, group, collisions);

  return { group, collisions };
}

export function animateFountain(group, elapsed) {
  group.traverse((child) => {
    if (!child.userData.isFountain) return;
    child.position.y = 0.95 + Math.sin(elapsed * 1.8) * 0.06;
    child.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.03);
  });
}
