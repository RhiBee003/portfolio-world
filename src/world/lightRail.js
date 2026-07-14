import * as THREE from "three";
import { controlHint } from "./ui.js";
import {
  createLightRailCurve,
  LIGHT_RAIL_START_T,
  LIGHT_RAIL_END_T,
  LIGHT_RAIL_TRACK_Y,
  LIGHT_RAIL_PLATFORM_Y,
  LIGHT_RAIL_GUIDEWAY_WIDTH,
  LIGHT_RAIL_RIDE_DURATION,
  LIGHT_RAIL_PLATFORM_RADIUS,
  LIGHT_RAIL_BOARD_RADIUS,
  LIGHT_RAIL_APPROACH_RADIUS,
  LIGHT_RAIL_BOARD_COOLDOWN,
  LIGHT_RAIL_CAR,
  LIGHT_RAIL_RAIL,
  LIGHT_RAIL_OCS,
  LIGHT_RAIL_CONNECTORS,
  LIGHT_RAIL_PATH_SIGNS,
} from "./lightRailConfig.js";
import { worldHeight } from "./terrain.js";

/** Station / sign palette (portfolio) — train uses LINK_PAL separately. */
const PAL = {
  body: 0x2a2a2e,
  bodyMid: 0x4a4a52,
  accent: 0xeaadc3,
  accentSoft: 0xefc4d6,
  cream: 0xf5f0f3,
  concrete: 0x9a9aa2,
  metal: 0x6e6e78,
  glow: 0xffd6e8,
  warm: 0xffe8c0,
};

/** Sound Transit Link Series 2 (Siemens S700) inspired shell — accents use portfolio pink. */
const LINK = {
  white: 0xf4f6f8,
  silver: 0xd8dde3,
  navy: 0x0b2a4a,
  accent: 0xeaadc3,
  accentSoft: 0xefc4d6,
  pinkGlow: 0xffd6e8,
  tealGlass: 0x4aa8b8,
  tealGlassDeep: 0x006b7a,
  charcoal: 0x1c2228,
  glass: 0x1a2836,
  led: 0xfff6e0,
  red: 0xff2a2a,
  roof: 0x3a424a,
};

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function trackBedY(x, z) {
  return worldHeight(x, z) + LIGHT_RAIL_TRACK_Y;
}

function trackPointAt(curve, t) {
  const p = curve.getPointAt(t);
  return new THREE.Vector3(p.x, trackBedY(p.x, p.z), p.z);
}

function inRect(x, z, rect, margin = 0) {
  return (
    x >= rect.x0 - margin &&
    x <= rect.x1 + margin &&
    z >= rect.z0 - margin &&
    z <= rect.z1 + margin
  );
}

function buildGuidewayGeometry(curve, t0, t1, width, segments) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const left = new THREE.Vector3();
  const right = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= segments; i += 1) {
    const t = THREE.MathUtils.lerp(t0, t1, i / segments);
    const point = trackPointAt(curve, t);
    const tangentFlat = curve.getTangentAt(t).normalize();
    side.set(-tangentFlat.z, 0, tangentFlat.x).normalize();

    left.copy(point).addScaledVector(side, -width / 2);
    right.copy(point).addScaledVector(side, width / 2);
    left.y = point.y - 0.06;
    right.y = point.y - 0.06;

    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    normals.push(up.x, up.y, up.z, up.x, up.y, up.z);
    uvs.push(0, i / segments, 1, i / segments);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createWalkway(rect) {
  const group = new THREE.Group();
  group.name = "light-rail-connector";
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const cx = (rect.x0 + rect.x1) * 0.5;
  const cz = (rect.z0 + rect.z1) * 0.5;
  const lift = rect.y ?? 0.04;
  const segsX = Math.max(4, Math.ceil(w / 2));
  const segsZ = Math.max(1, Math.ceil(d / 1.5));

  const geo = new THREE.PlaneGeometry(w, d, segsX, segsZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const wx = cx + pos.getX(i);
    const wz = cz + pos.getZ(i);
    pos.setY(i, worldHeight(wx, wz) + lift);
  }
  geo.computeVertexNormals();

  const pad = new THREE.Mesh(geo, linkMat(0xc4c2bc, { roughness: 0.94 }));
  pad.position.set(cx, 0, cz);
  pad.receiveShadow = true;
  group.add(pad);

  // Soft edge strips so the connector reads as a continuous approach.
  for (const side of [-1, 1]) {
    for (let i = 0; i < segsX; i += 1) {
      const segW = w / segsX;
      const lx = -w * 0.5 + (i + 0.5) * segW;
      const lz = side * (d * 0.5 - 0.08);
      const wx = cx + lx;
      const wz = cz + lz;
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(segW * 0.98, 0.06, 0.14),
        linkMat(0xa8a69f, { roughness: 0.9 })
      );
      curb.position.set(wx, worldHeight(wx, wz) + lift + 0.05, wz);
      group.add(curb);
    }
  }

  return group;
}

function createPathSign(x, z) {
  const group = new THREE.Group();
  group.name = "light-rail-path-sign";
  const baseY = worldHeight(x, z);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 5.4, 8),
    linkMat(0x8a9098, { metalness: 0.45, roughness: 0.45 })
  );
  post.position.set(x, baseY + 2.7, z);
  post.castShadow = true;
  group.add(post);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.2, 0.12),
    linkMat(LINK.navy, {
      emissive: LINK.accent,
      emissiveIntensity: 0.28,
      roughness: 0.45,
      fog: false,
    })
  );
  board.position.set(x + 1.45, baseY + 4.4, z);
  group.add(board);

  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.65, 3),
    linkMat(LINK.white, { emissive: LINK.accentSoft, emissiveIntensity: 0.3, fog: false })
  );
  arrow.rotation.z = -Math.PI / 2;
  arrow.rotation.y = Math.PI / 2;
  arrow.position.set(x + 2.3, baseY + 4.4, z);
  group.add(arrow);

  group.userData.board = board;
  group.userData.arrow = arrow;
  return group;
}

function createStationBeacon(x, z) {
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 16, 10),
    linkMat(LINK.accent, {
      emissive: LINK.pinkGlow,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      fog: false,
    })
  );
  beacon.position.set(x, 8, z);
  beacon.frustumCulled = false;
  return beacon;
}

function createCatFlagTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f2a8c4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft hem strip
  ctx.fillStyle = "#e891ad";
  ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

  ctx.fillStyle = "#1a1218";
  // Body
  ctx.beginPath();
  ctx.ellipse(118, 98, 48, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(162, 62, 28, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.beginPath();
  ctx.moveTo(142, 48);
  ctx.lineTo(138, 22);
  ctx.lineTo(158, 42);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(178, 48);
  ctx.lineTo(192, 20);
  ctx.lineTo(188, 52);
  ctx.closePath();
  ctx.fill();
  // Tail
  ctx.beginPath();
  ctx.moveTo(72, 100);
  ctx.quadraticCurveTo(28, 70, 42, 38);
  ctx.quadraticCurveTo(52, 58, 78, 88);
  ctx.closePath();
  ctx.fill();
  // Eye shine
  ctx.fillStyle = "#ffe8f2";
  ctx.beginPath();
  ctx.arc(172, 58, 4.5, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Tall plaza flagpole with a pink cat banner — sits outside the canopy. */
function createPlazaCatFlag(facing = 1) {
  const group = new THREE.Group();
  group.name = "cat-flag";
  group.frustumCulled = false;

  const poleMat = linkMat(0x6e747c, { roughness: 0.35, metalness: 0.55 });
  const poleH = 6.4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, poleH, 12), poleMat);
  pole.position.y = poleH * 0.5;
  pole.castShadow = true;
  pole.frustumCulled = false;
  group.add(pole);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.18, 12), poleMat);
  base.position.y = 0.09;
  group.add(base);

  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    linkMat(LINK.accent, { emissive: LINK.pinkGlow, emissiveIntensity: 0.55, metalness: 0.25, roughness: 0.35 })
  );
  finial.position.y = poleH + 0.08;
  finial.frustumCulled = false;
  group.add(finial);

  const flagW = 2.35;
  const flagH = 1.45;
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(flagW, flagH, 10, 6),
    new THREE.MeshBasicMaterial({
      map: createCatFlagTexture(),
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    })
  );
  cloth.castShadow = true;
  cloth.frustumCulled = false;
  cloth.renderOrder = 3;
  cloth.position.set(facing * (flagW * 0.5 + 0.06), poleH - flagH * 0.52, 0);
  cloth.rotation.y = facing > 0 ? 0 : Math.PI;
  group.add(cloth);

  group.userData.flagCloth = cloth;
  group.userData.flagPhase = Math.random() * Math.PI * 2;
  return group;
}

/**
 * Northgate Station–inspired stop: floating canopy, teal clerestory glass,
 * connected plaza → stairs → platform, pink ST accents.
 */
function createStation(curve, pathT, label, towardPathX) {
  const group = new THREE.Group();
  group.name = `light-rail-station-${label}`;
  const { point: center, tangent, normal, yaw, pitch } = trackFrameAt(curve, pathT);
  const rampDir = towardPathX < center.x ? -1 : 1;
  const baseY = worldHeight(center.x, center.z);

  const platY = LIGHT_RAIL_PLATFORM_Y;
  const walkY = 0.04;
  const platformLen = 16.5;
  const platformW = 4.8;
  // Local X: track at 0; platform sits on the path side; boarding face toward track.
  const platX = rampDir * (LIGHT_RAIL_GUIDEWAY_WIDTH * 0.5 + platformW * 0.5 + 0.15);

  const concrete = linkMat(0xb8b6b0, { roughness: 0.92, metalness: 0.04 });
  const concreteDark = linkMat(0x9a9892, { roughness: 0.9 });
  const whitePanel = linkMat(LINK.white, { roughness: 0.38, metalness: 0.22 });
  const metal = linkMat(0x8a9098, { roughness: 0.4, metalness: 0.5 });
  const pink = linkMat(LINK.accent, { roughness: 0.45, emissive: LINK.accentSoft, emissiveIntensity: 0.2 });
  const glassClear = createTrainGlass(true);
  const glassTeal = linkMat(LINK.tealGlass, {
    transparent: true,
    opacity: 0.4,
    roughness: 0.12,
    metalness: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
    emissive: LINK.tealGlassDeep,
    emissiveIntensity: 0.16,
  });

  const deck = new THREE.Group();
  deck.position.set(center.x, baseY, center.z);
  deck.rotation.order = "YXZ";
  deck.rotation.y = yaw;
  deck.rotation.x = -pitch;

  // Guideway bed under the train (connects visually to main guideway mesh).
  const guidePad = new THREE.Mesh(new THREE.BoxGeometry(LIGHT_RAIL_GUIDEWAY_WIDTH + 0.35, 0.12, platformLen + 1.2), concreteDark);
  guidePad.position.set(0, LIGHT_RAIL_TRACK_Y - 0.08, 0);
  guidePad.receiveShadow = true;
  deck.add(guidePad);

  // Boarding platform flush with car floor height.
  const platform = new THREE.Mesh(new THREE.BoxGeometry(platformW, 0.22, platformLen), concrete);
  platform.position.set(platX, platY - 0.02, 0);
  platform.castShadow = true;
  platform.receiveShadow = true;
  deck.add(platform);

  const boardFaceX = platX - rampDir * (platformW * 0.5);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, platformLen - 0.4), linkMat(0xf0c040, { roughness: 0.7 }));
  edge.position.set(boardFaceX + rampDir * 0.06, platY + 0.12, 0);
  deck.add(edge);

  const tactile = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, platformLen - 0.5), linkMat(0xd4cfc4, { roughness: 0.75 }));
  tactile.position.set(boardFaceX + rampDir * 0.38, platY + 0.11, 0);
  deck.add(tactile);

  // Platform path-side edge, then stairs, then plaza reaching the connector.
  const platOuterX = platX + rampDir * (platformW * 0.5);
  const rise = platY - walkY;
  const steps = 6;
  const totalRun = 2.75;
  const stepRun = totalRun / steps;
  const stepRise = rise / steps;
  const stepThick = Math.max(stepRise + 0.025, 0.1);
  const stepWidth = 4.4;
  const stairOuterX = platOuterX + rampDir * totalRun;

  const plazaW = 5.8;
  const plazaX = stairOuterX + rampDir * (plazaW * 0.5 + 0.2);
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(plazaW, 0.1, 7.5), concrete);
  plaza.position.set(plazaX, walkY, 0);
  plaza.receiveShadow = true;
  deck.add(plaza);

  // Filler tongue that overlaps the short connector pad so the joint never gaps.
  if (label !== "start") {
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.09, 6.2), concrete);
    tongue.position.set(plazaX + rampDir * (plazaW * 0.5 + 1.5), walkY, 0);
    tongue.receiveShadow = true;
    deck.add(tongue);
  }

  // Continuous stair from plaza up to platform — every tread is walk-sampled.
  const stairRoot = new THREE.Group();
  const stairStepsLocal = [];
  for (let i = 0; i < steps; i += 1) {
    // i=0 lowest / outer (plaza); i=steps-1 highest / inner (platform).
    const t = (i + 0.5) / steps;
    const localX = stairOuterX + (platOuterX - stairOuterX) * t;
    const topY = walkY + (i + 1) * stepRise;
    const step = new THREE.Mesh(new THREE.BoxGeometry(stepRun * 0.98, stepThick, stepWidth), concrete);
    step.position.set(localX, topY - stepThick * 0.5, 0);
    step.castShadow = true;
    step.receiveShadow = true;
    stairRoot.add(step);
    stairStepsLocal.push({
      localX0: localX - stepRun * 0.52,
      localX1: localX + stepRun * 0.52,
      localZ0: -stepWidth * 0.5,
      localZ1: stepWidth * 0.5,
      y: topY,
    });
  }

  // Landing flush with platform so the top tread never leaves a hole.
  const land = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, stepWidth + 0.2), concrete);
  land.position.set(platOuterX - rampDir * 0.25, platY - 0.04, 0);
  land.receiveShadow = true;
  deck.add(land);

  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(totalRun + 0.35, 0.08, 0.08), metal);
    rail.position.set((stairOuterX + platOuterX) * 0.5, (walkY + platY) * 0.5 + 0.9, side * (stepWidth * 0.5 - 0.12));
    stairRoot.add(rail);
    const postA = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 6), metal);
    postA.position.set(stairOuterX, walkY + 0.55, side * (stepWidth * 0.5 - 0.12));
    stairRoot.add(postA);
    const postB = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 6), metal);
    postB.position.set(platOuterX, platY + 0.5, side * (stepWidth * 0.5 - 0.12));
    stairRoot.add(postB);
  }
  deck.add(stairRoot);

  // Piers under canopy — sit on plaza/platform, hangers meet pier tops.
  const pierXs = [platX + rampDir * 0.2, plazaX];
  const pierZs = [-5.5, 0, 5.5];
  const canopyY = 4.85;
  for (const px of pierXs) {
    for (const pz of pierZs) {
      const pierH = canopyY - 0.35;
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.42, pierH, 0.42), concreteDark);
      pier.position.set(px, pierH * 0.5, pz);
      pier.castShadow = true;
      deck.add(pier);
    }
  }

  // Floating canopy attached to pier tops.
  const canopyRoot = new THREE.Group();
  canopyRoot.position.set((platX + plazaX) * 0.5, canopyY, 0);

  const mainRoof = new THREE.Mesh(new THREE.BoxGeometry(platformW + plazaW + 1.2, 0.12, platformLen + 1.5), whitePanel);
  mainRoof.castShadow = true;
  canopyRoot.add(mainRoof);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.1, platformLen + 0.6), whitePanel);
  wing.position.set(-rampDir * (platformW * 0.55 + 1.4), -0.08, 0);
  wing.rotation.z = rampDir * 0.05;
  canopyRoot.add(wing);

  for (let i = -4; i <= 4; i += 1) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(platformW + plazaW, 0.06, 0.14), metal);
    rib.position.set(0, -0.1, i * 1.9);
    canopyRoot.add(rib);
  }

  // Teal clerestory glass (kept teal) between canopy and platform windscreens.
  const clerestory = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, platformLen - 0.6), glassTeal);
  clerestory.position.set(rampDir * ((platformW + plazaW) * 0.5 - 0.2), -0.85, 0);
  clerestory.renderOrder = 2;
  canopyRoot.add(clerestory);

  // Pink fascia light — portfolio accent on the canopy edge.
  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, platformLen + 1.2),
    linkMat(LINK.accent, { emissive: LINK.pinkGlow, emissiveIntensity: 0.4 })
  );
  fascia.position.set(rampDir * ((platformW + plazaW) * 0.5 - 0.05), -0.18, 0);
  canopyRoot.add(fascia);

  deck.add(canopyRoot);

  // Windscreens along outer (path) edge of platform.
  for (const pz of [-5.5, -2.75, 0, 2.75, 5.5]) {
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.85, 2.35), glassClear);
    screen.position.set(platX + rampDir * (platformW * 0.5 - 0.08), platY + 1.0, pz);
    screen.renderOrder = 1;
    deck.add(screen);
  }

  // NORTHGATE totem on the plaza, grounded.
  const totem = new THREE.Group();
  totem.position.set(plazaX + rampDir * 1.2, 0, -2.8);
  const totemPost = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.55), linkMat(LINK.navy, { roughness: 0.5 }));
  totemPost.position.y = 1.7;
  totem.add(totemPost);
  const nameBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.7, 2.8),
    linkMat(LINK.navy, { emissive: LINK.navy, emissiveIntensity: 0.12 })
  );
  nameBoard.position.set(rampDir * 0.18, 2.55, 0);
  totem.add(nameBoard);
  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.42, 1.1),
    pink
  );
  badge.position.set(rampDir * 0.2, 3.15, 0);
  totem.add(badge);
  deck.add(totem);

  const glowMat = new THREE.MeshStandardMaterial({
    color: LINK.accentSoft,
    emissive: LINK.pinkGlow,
    emissiveIntensity: 0.38,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.2), glowMat);
  glow.position.set(platX, platY + 1.25, 0);
  glow.rotation.y = rampDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  deck.add(glow);

  // Cat flag outside the canopy on the path/connector edge so it reads as a landmark.
  const catFlag = createPlazaCatFlag(rampDir);
  catFlag.position.set(plazaX + rampDir * (plazaW * 0.5 + 2.35), 0, 0);
  deck.add(catFlag);

  group.add(deck);

  // World-space boarding volumes.
  function localToWorldXZ(lx, lz) {
    return {
      x: center.x + normal.x * lx + tangent.x * lz,
      z: center.z + normal.z * lx + tangent.z * lz,
    };
  }

  function localBoxToWorldRect(localX0, localX1, localZ0, localZ1, pad = 0.05) {
    const corners = [
      localToWorldXZ(localX0, localZ0),
      localToWorldXZ(localX0, localZ1),
      localToWorldXZ(localX1, localZ0),
      localToWorldXZ(localX1, localZ1),
    ];
    const xs = corners.map((c) => c.x);
    const zs = corners.map((c) => c.z);
    return {
      x0: Math.min(...xs) - pad,
      x1: Math.max(...xs) + pad,
      z0: Math.min(...zs) - pad,
      z1: Math.max(...zs) + pad,
    };
  }

  const platformDeckRect = {
    ...localBoxToWorldRect(platX - platformW * 0.5, platX + platformW * 0.5, -platformLen * 0.5, platformLen * 0.5, 0.2),
    y: baseY + platY,
  };
  const plazaRect = {
    ...localBoxToWorldRect(plazaX - plazaW * 0.5, plazaX + plazaW * 0.5, -3.75, 3.75, 0.2),
    y: baseY + walkY,
  };
  const stairRects = stairStepsLocal.map((step) => ({
    ...localBoxToWorldRect(step.localX0, step.localX1, step.localZ0, step.localZ1, 0.06),
    y: baseY + step.y,
  }));

  // Keep broad AABB for docking checks.
  const footprint = localBoxToWorldRect(
    Math.min(platX - platformW * 0.55, plazaX - plazaW * 0.55, stairOuterX),
    Math.max(platX + platformW * 0.55, plazaX + plazaW * 0.55, platOuterX),
    -platformLen * 0.55,
    platformLen * 0.55,
    0.5
  );

  group.userData.stationT = pathT;
  group.userData.baseY = baseY;
  group.userData.glow = glow;
  group.userData.catFlag = catFlag;
  group.userData.center = { x: center.x, z: center.z };
  group.userData.platformRect = { ...footprint, y: baseY + platY };
  group.userData.platformDeckRect = platformDeckRect;
  group.userData.plazaRect = plazaRect;
  group.userData.stairRects = stairRects;
  group.userData.rampRect = {
    ...footprint,
    y0: baseY + walkY,
    y1: baseY + platY,
  };

  const beacon = createStationBeacon(
    center.x + normal.x * plazaX,
    center.z + normal.z * plazaX
  );
  beacon.position.y = baseY + 8;
  group.add(beacon);
  group.userData.beacon = beacon;

  return group;
}

function createTrainGlass(lit = true) {
  return new THREE.MeshStandardMaterial({
    color: lit ? 0xb8d0e4 : LINK.glass,
    emissive: lit ? 0x6a90b0 : 0x0a1218,
    emissiveIntensity: lit ? 0.12 : 0.04,
    roughness: 0.08,
    metalness: 0.4,
    transparent: true,
    opacity: lit ? 0.32 : 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function linkMat(hex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.12,
    ...opts,
  });
}

const _floorProbe = new THREE.Vector3();

function carFloorWorldY(train = null, wx = null, wz = null) {
  const floor =
    train && train.userData?.passengerActive
      ? LIGHT_RAIL_CAR.passengerFloorY
      : LIGHT_RAIL_CAR.floorY;

  if (train && wx != null && wz != null) {
    train.updateMatrixWorld(true);
    // Project onto the pitched cabin floor via the train transform.
    _floorProbe.set(wx, train.position.y + 8, wz);
    train.worldToLocal(_floorProbe);
    _floorProbe.y = floor;
    train.localToWorld(_floorProbe);
    return _floorProbe.y;
  }

  if (train) {
    train.updateMatrixWorld(true);
    _floorProbe.set(0, floor, 0);
    train.localToWorld(_floorProbe);
    return _floorProbe.y;
  }

  return LIGHT_RAIL_TRACK_Y + floor;
}

function passengerFeetWorldY(train = null) {
  if (train) {
    train.updateMatrixWorld(true);
    _floorProbe.set(0, LIGHT_RAIL_CAR.seat.y, 0);
    train.localToWorld(_floorProbe);
    return _floorProbe.y;
  }
  return LIGHT_RAIL_TRACK_Y + LIGHT_RAIL_CAR.seat.y;
}

function railTopWorldY(x = 0, z = 0) {
  return trackBedY(x, z) + LIGHT_RAIL_RAIL.topAboveBed;
}

function createSeatUnit(mat, backMat) {
  const seat = new THREE.Group();
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.52), mat);
  cushion.position.y = 0.07;
  seat.add(cushion);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.08), backMat);
  back.position.set(0, 0.38, -0.22);
  seat.add(back);
  return seat;
}

/**
 * Siemens S700 / Sound Transit Link Series 2–inspired LRV:
 * white shell, navy + portfolio-pink wave stripe, black window ribbon,
 * angular cab, articulated center bellows, twin LED headlights.
 */
function createLightRailVehicle() {
  const train = new THREE.Group();
  train.name = "light-rail-train";

  const { length, width, height, floorY, wheelRadius, wheelY, bogieZ } = LIGHT_RAIL_CAR;
  const halfL = length / 2;
  const halfW = width / 2;
  const sectionLen = (length - 2.4) / 2;

  const whiteMat = linkMat(LINK.white, { roughness: 0.42, metalness: 0.18 });
  const silverMat = linkMat(LINK.silver, { roughness: 0.4, metalness: 0.28 });
  const navyMat = linkMat(LINK.navy, { roughness: 0.5, metalness: 0.08 });
  const pinkMat = linkMat(LINK.accent, { roughness: 0.45, metalness: 0.08 });
  const pinkSoftMat = linkMat(LINK.accentSoft, { roughness: 0.42, metalness: 0.06, emissive: LINK.pinkGlow, emissiveIntensity: 0.12 });
  const charcoalMat = linkMat(LINK.charcoal, { roughness: 0.55, metalness: 0.2 });
  const roofMat = linkMat(LINK.roof, { roughness: 0.48, metalness: 0.32 });
  const metalMat = linkMat(0x8a9098, { roughness: 0.35, metalness: 0.55 });
  const darkGlass = createTrainGlass(false);
  const clearGlass = createTrainGlass(true);

  function addBogie(z) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 1.35), charcoalMat);
    frame.position.set(0, wheelY - 0.06, z);
    train.add(frame);

    for (const sx of [-LIGHT_RAIL_RAIL.gaugeHalf, LIGHT_RAIL_RAIL.gaugeHalf]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.18, 18),
        linkMat(0x2a2e34, { metalness: 0.6, roughness: 0.3 })
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, wheelY, z);
      train.add(wheel);
    }
  }

  bogieZ.forEach((z) => addBogie(z));

  function addBodySection(centerZ, len) {
    const section = new THREE.Group();
    section.position.z = centerZ;

    const under = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.2, len - 0.2), charcoalMat);
    under.position.y = wheelY + 0.05;
    section.add(under);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.48, len - 0.15), silverMat);
    skirt.position.y = floorY + 0.16;
    section.add(skirt);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, 0.82, len - 0.1), whiteMat);
    lower.position.y = floorY + 0.58;
    section.add(lower);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(width - 0.12, 1.05, len - 0.55), whiteMat);
    upper.position.y = floorY + 1.55;
    section.add(upper);

    // Wave stripe — navy base + portfolio pink ribbon.
    const navyStripe = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, 0.42, len - 0.2), navyMat);
    navyStripe.position.y = floorY + 0.98;
    section.add(navyStripe);

    const pinkStripe = new THREE.Mesh(new THREE.BoxGeometry(width + 0.05, 0.16, len - 0.35), pinkMat);
    pinkStripe.position.y = floorY + 1.12;
    section.add(pinkStripe);

    const pinkWave = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.1, len * 0.45), pinkSoftMat);
    pinkWave.position.set(0, floorY + 1.22, len * 0.12);
    section.add(pinkWave);

    // Continuous dark window ribbon.
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 1.05, len - 0.8), charcoalMat);
    ribbon.position.y = floorY + 1.72;
    section.add(ribbon);

    for (const side of [-1, 1]) {
      const panes = 4;
      for (let i = 0; i < panes; i += 1) {
        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.95, (len - 1.4) / panes - 0.12),
          darkGlass
        );
        const zLocal = -len * 0.32 + i * ((len - 1.0) / panes);
        pane.position.set(side * (halfW + 0.01), floorY + 1.72, zLocal);
        pane.renderOrder = 1;
        section.add(pane);
      }
    }

    // Fully enclosed clerestory roof with upper windows.
    const shoulderY = height - 0.22;
    const clerestoryH = 0.58;
    const clerestoryHalfW = width * 0.26;

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.3, 0.12, len - 0.28),
        roofMat
      );
      shoulder.position.set(side * (halfW - width * 0.16), shoulderY, 0);
      section.add(shoulder);

      const clerestoryFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, clerestoryH, len - 0.4),
        charcoalMat
      );
      clerestoryFrame.position.set(side * clerestoryHalfW, shoulderY + clerestoryH * 0.5, 0);
      section.add(clerestoryFrame);

      const roofPanes = 5;
      for (let i = 0; i < roofPanes; i += 1) {
        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, clerestoryH - 0.12, (len - 0.8) / roofPanes - 0.08),
          clearGlass
        );
        const zLocal = -len * 0.36 + i * ((len - 0.55) / roofPanes);
        pane.position.set(side * (clerestoryHalfW + 0.02), shoulderY + clerestoryH * 0.5, zLocal);
        pane.renderOrder = 2;
        section.add(pane);
      }
    }

    // Cap the roof completely; skylight strip down the center.
    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(clerestoryHalfW * 2 + 0.18, 0.1, len - 0.28),
      roofMat
    );
    roofCap.position.y = shoulderY + clerestoryH + 0.02;
    section.add(roofCap);

    const skyStrip = new THREE.Mesh(
      new THREE.BoxGeometry(clerestoryHalfW * 1.15, 0.04, len - 0.7),
      clearGlass
    );
    skyStrip.position.y = shoulderY + clerestoryH + 0.08;
    skyStrip.renderOrder = 2;
    section.add(skyStrip);

    // End bulkheads so the clerestory reads sealed at section tips.
    for (const end of [-1, 1]) {
      const bulk = new THREE.Mesh(
        new THREE.BoxGeometry(clerestoryHalfW * 2 + 0.12, clerestoryH + 0.08, 0.08),
        roofMat
      );
      bulk.position.set(0, shoulderY + clerestoryH * 0.5, end * (len * 0.5 - 0.18));
      section.add(bulk);
    }

    train.add(section);
  }

  addBodySection(sectionLen * 0.5 + 0.55, sectionLen);
  addBodySection(-(sectionLen * 0.5 + 0.55), sectionLen);

  // Articulation bellows (mid-joint).
  const bellows = new THREE.Group();
  for (let i = -2; i <= 2; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.35, 2.35, 0.14),
      linkMat(0x2e343c, { roughness: 0.75, metalness: 0.15 })
    );
    ring.position.set(0, floorY + 1.25, i * 0.22);
    bellows.add(ring);
  }
  const bellowsFloor = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.55, 0.08, 1.15),
    charcoalMat
  );
  bellowsFloor.position.y = floorY + 0.02;
  bellows.add(bellowsFloor);

  // Enclosed roof bridge over the articulation joint.
  const bellowsRoof = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.45, 0.12, 1.35),
    roofMat
  );
  bellowsRoof.position.y = height - 0.08;
  bellows.add(bellowsRoof);
  const bellowsClere = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.52, 0.5, 1.2),
    charcoalMat
  );
  bellowsClere.position.y = height + 0.2;
  bellows.add(bellowsClere);
  const bellowsSky = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.36, 0.04, 1.0),
    clearGlass
  );
  bellowsSky.position.y = height + 0.48;
  bellowsSky.renderOrder = 2;
  bellows.add(bellowsSky);
  train.add(bellows);

  function addCab(sign) {
    const cab = new THREE.Group();
    const tip = sign * (halfL - 0.15);

    // Angular S700 nose.
    const chin = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.55, 1.15), whiteMat);
    chin.position.set(0, floorY + 0.42, tip - sign * 0.55);
    chin.rotation.x = sign * -0.18;
    cab.add(chin);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(width - 0.2, 0.28, 1.0), charcoalMat);
    brow.position.set(0, floorY + 2.15, tip - sign * 0.7);
    cab.add(brow);

    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.55, 0.85), whiteMat);
      cheek.position.set(side * (halfW - 0.2), floorY + 1.25, tip - sign * 0.45);
      cab.add(cheek);
    }

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.58, 1.35, 0.05),
      clearGlass
    );
    windshield.position.set(0, floorY + 1.4, tip - sign * 0.18);
    windshield.rotation.x = sign * -0.22;
    windshield.renderOrder = 3;
    cab.add(windshield);
    if (sign > 0) train.userData.frontWindshield = windshield;
    else train.userData.rearWindshield = windshield;

    // Destination / LINK board.
    const dest = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.55, 0.28, 0.06),
      linkMat(0x05080c, { emissive: LINK.accent, emissiveIntensity: 0.5, roughness: 0.4 })
    );
    dest.position.set(0, floorY + 2.28, tip - sign * 0.42);
    cab.add(dest);

    // Twin horizontal LED headlights (Series 2 hallmark).
    for (const tier of [0, 1]) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.1, 0.85),
        linkMat(LINK.led, { emissive: LINK.led, emissiveIntensity: 0.85, roughness: 0.25 })
      );
      bar.position.set(0, floorY + 0.55 + tier * 0.28, tip - sign * 0.02);
      cab.add(bar);
      if (sign > 0 && tier === 0) train.userData.headlight = bar;
    }

    // Marker lamps.
    for (const side of [-1, 1]) {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.08),
        linkMat(LINK.red, { emissive: LINK.red, emissiveIntensity: 0.55 })
      );
      marker.position.set(side * (halfW - 0.35), floorY + 1.95, tip - sign * 0.08);
      cab.add(marker);
      if (sign < 0 && side < 0) train.userData.taillight = marker;
    }

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(width - 0.15, 0.2, 0.35), charcoalMat);
    bumper.position.set(0, floorY + 0.18, tip - sign * 0.02);
    cab.add(bumper);

    train.add(cab);
  }

  addCab(1);
  addCab(-1);

  // Dual plug doors per side (Link style), platform side gets boarding glow.
  const platformSide = LIGHT_RAIL_CAR.platformSide;
  const doorZs = [-6.4, -3.6, 3.6, 6.4];
  for (const side of [-1, 1]) {
    doorZs.forEach((dz, idx) => {
      const doorGroup = new THREE.Group();
      for (const leaf of [-1, 1]) {
        const leafMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 2.05, 0.62),
          linkMat(LINK.silver, {
            transparent: true,
            opacity: 0.92,
            roughness: 0.35,
            metalness: 0.25,
            emissive: side === platformSide ? LINK.accent : 0x000000,
            emissiveIntensity: side === platformSide ? 0.28 : 0,
          })
        );
        leafMesh.position.set(0, floorY + 1.12, leaf * 0.34);
        doorGroup.add(leafMesh);

        const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.15, 0.48), darkGlass);
        doorGlass.position.set(side * 0.02, floorY + 1.35, leaf * 0.34);
        doorGroup.add(doorGlass);
      }
      doorGroup.position.set(side * (halfW + 0.02), 0, dz);
      train.add(doorGroup);
      if (side === platformSide && idx === 1) {
        train.userData.doorGlow = doorGroup.children[0];
      }
    });
  }

  // Pantograph sits on the enclosed clerestory roof.
  const pantographReach = LIGHT_RAIL_OCS.wireHeight - (height + 0.55) + floorY + 0.08;
  const panBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.25), metalMat);
  panBase.position.set(0, height + 0.52, 1.2);
  train.add(panBase);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, Math.max(0.35, pantographReach), 0.05), metalMat);
    arm.position.set(side * 0.35, height + 0.52 + Math.max(0.35, pantographReach) * 0.5, 1.2);
    arm.rotation.z = side * 0.12;
    train.add(arm);
  }

  const contactHead = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.07, 0.28), metalMat);
  contactHead.position.set(0, height + 0.52 + Math.max(0.35, pantographReach) - 0.05, 1.2);
  train.add(contactHead);

  // Floor + longitudinal seating (aisle down the middle).
  const interior = new THREE.Group();
  interior.name = "train-interior";
  train.add(interior);

  const floorLift = LIGHT_RAIL_CAR.interiorFloorLift ?? 0;
  const cabinFloorY = floorY + floorLift;

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.35, 0.06, length - 2.6),
    linkMat(0x6a7078, { roughness: 0.92 })
  );
  floor.position.set(0, cabinFloorY, 0);
  interior.add(floor);

  const seatMat = linkMat(0x4a5560, { roughness: 0.85 });
  const seatBackMat = linkMat(0x3a4550, { roughness: 0.88 });
  const seatPads = [];
  const seatZs = [-7.2, -5.4, -3.6, -1.8, 1.8, 3.6, 5.4, 7.2];
  for (const side of [-1, 1]) {
    for (const z of seatZs) {
      const unit = createSeatUnit(seatMat, seatBackMat);
      unit.position.set(side * (halfW - 0.58), cabinFloorY + 0.42, z);
      unit.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      interior.add(unit);
      seatPads.push({
        x: side * (halfW - 0.58),
        z,
        halfX: 0.38,
        halfZ: 0.32,
        feetY: LIGHT_RAIL_CAR.passengerFloorY,
      });
    }
  }

  // Interior window glass — readable from the aisle after cabin scale-up.
  for (const side of [-1, 1]) {
    const wallLower = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.95, length - 3.2),
      whiteMat
    );
    wallLower.position.set(side * (halfW - 0.14), cabinFloorY + 0.58, 0);
    interior.add(wallLower);

    const wallUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.45, length - 3.2),
      whiteMat
    );
    wallUpper.position.set(side * (halfW - 0.14), cabinFloorY + 2.2, 0);
    interior.add(wallUpper);

    for (const z of [-6, -2, 2, 6]) {
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 1.15, 2.4),
        clearGlass
      );
      pane.position.set(side * (halfW - 0.08), cabinFloorY + 1.55, z);
      pane.renderOrder = 2;
      interior.add(pane);
    }
  }

  // Soft end glass so you can look forward/back out of the cabs.
  for (const sign of [-1, 1]) {
    const endGlass = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.7, 1.2, 0.04),
      clearGlass
    );
    endGlass.position.set(0, cabinFloorY + 1.35, sign * (halfL - 1.35));
    endGlass.renderOrder = 2;
    interior.add(endGlass);
  }

  // Interior ceiling / clerestory so the cabin feels fully roofed from inside.
  const ceilingY = cabinFloorY + 2.55;
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.55, 0.06, length - 3.0),
    linkMat(0xf2f4f6, { roughness: 0.78, metalness: 0.05 })
  );
  ceiling.position.set(0, ceilingY, 0);
  interior.add(ceiling);

  const clerestoryHalfW = width * 0.26;
  for (const side of [-1, 1]) {
    const upperWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.55, length - 3.2),
      whiteMat
    );
    upperWall.position.set(side * (clerestoryHalfW - 0.02), ceilingY + 0.32, 0);
    interior.add(upperWall);

    for (const z of [-6.5, -3.25, 0, 3.25, 6.5]) {
      const roofPane = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.42, 2.0),
        clearGlass
      );
      roofPane.position.set(side * (clerestoryHalfW + 0.02), ceilingY + 0.32, z);
      roofPane.renderOrder = 2;
      interior.add(roofPane);
    }
  }

  const skylight = new THREE.Mesh(
    new THREE.BoxGeometry(clerestoryHalfW * 1.2, 0.04, length - 3.4),
    clearGlass
  );
  skylight.position.set(0, ceilingY + 0.58, 0);
  skylight.renderOrder = 2;
  interior.add(skylight);

  const roofLiner = new THREE.Mesh(
    new THREE.BoxGeometry(clerestoryHalfW * 2.15, 0.08, length - 3.1),
    roofMat
  );
  roofLiner.position.set(0, ceilingY + 0.64, 0);
  interior.add(roofLiner);

  const { seat } = LIGHT_RAIL_CAR;
  const cabZ = halfL - seat.cabinOffset;
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.34, 0.8),
    seatMat
  );
  bench.position.set(seat.x, seat.y - 0.28, cabZ - 0.35);
  interior.add(bench);
  train.userData.bench = bench;
  train.userData.cabSeatZ = cabZ;

  const seatBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.68, 0.1),
    seatBackMat
  );
  seatBack.position.set(seat.x, seat.y + 0.14, cabZ - 0.7);
  interior.add(seatBack);
  train.userData.seatBack = seatBack;
  train.userData.interior = interior;
  train.userData.seatPads = seatPads;
  train.userData.exteriorParts = [];

  // Fallback lights if cab markers didn't assign.
  if (!train.userData.headlight) {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.7),
      linkMat(LINK.led, { emissive: LINK.led, emissiveIntensity: 0.8 })
    );
    hl.position.set(0, floorY + 0.6, halfL - 0.05);
    train.add(hl);
    train.userData.headlight = hl;
  }
  if (!train.userData.taillight) {
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.5),
      linkMat(LINK.red, { emissive: LINK.red, emissiveIntensity: 0.5 })
    );
    tl.position.set(0, floorY + 0.6, -halfL + 0.05);
    train.add(tl);
    train.userData.taillight = tl;
  }

  train.userData.platformSide = platformSide;

  // Everything except the walkable interior shell is treated as exterior skin.
  train.children.forEach((child) => {
    if (child !== interior) train.userData.exteriorParts.push(child);
  });

  return train;
}

function sampleCurveByArcLength(curve, t0, t1, spacing, divisions = 220) {
  const samples = [];
  let accumulated = 0;
  let last = curve.getPointAt(t0);
  for (let i = 1; i <= divisions; i += 1) {
    const t = THREE.MathUtils.lerp(t0, t1, i / divisions);
    const point = curve.getPointAt(t);
    accumulated += last.distanceTo(point);
    if (accumulated >= spacing) {
      samples.push({ t, point: point.clone() });
      accumulated = 0;
    }
    last = point;
  }
  return samples;
}

function trackFrameAt(curve, t) {
  const point = trackPointAt(curve, t);
  const tangentFlat = curve.getTangentAt(t).normalize();
  const normal = new THREE.Vector3(-tangentFlat.z, 0, tangentFlat.x).normalize();
  const yaw = Math.atan2(tangentFlat.x, tangentFlat.z);

  const dt = 0.006;
  const a = trackPointAt(curve, THREE.MathUtils.clamp(t - dt, 0, 1));
  const b = trackPointAt(curve, THREE.MathUtils.clamp(t + dt, 0, 1));
  const graded = b.clone().sub(a);
  const horiz = Math.hypot(graded.x, graded.z) || 1e-6;
  const pitch = Math.atan2(graded.y, horiz);

  return { point, tangent: tangentFlat, normal, yaw, pitch };
}

function createCantileverPole(poleBase, trackCenter, wirePoint, poleMat, armMat) {
  const group = new THREE.Group();
  const bedY = poleBase.y;
  const poleHeight = wirePoint.y - bedY + 0.55;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, poleHeight, 8),
    poleMat
  );
  pole.position.copy(poleBase);
  pole.position.y = bedY + poleHeight / 2;
  pole.castShadow = true;
  group.add(pole);

  const brace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 1.35, 6),
    armMat
  );
  const braceMid = poleBase.clone().lerp(trackCenter, 0.35);
  braceMid.y = bedY + poleHeight * 0.42;
  brace.position.copy(braceMid);
  brace.lookAt(trackCenter.x, braceMid.y + 0.8, trackCenter.z);
  brace.rotateX(Math.PI / 2);
  group.add(brace);

  const poleTop = new THREE.Vector3(poleBase.x, wirePoint.y, poleBase.z);
  const armLen = poleTop.distanceTo(wirePoint);
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.05, armLen, 6),
    armMat
  );
  arm.position.copy(poleTop).lerp(wirePoint, 0.5);
  arm.lookAt(wirePoint);
  arm.rotateX(Math.PI / 2);
  group.add(arm);

  const insulator = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.07, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d4cf, roughness: 0.65, metalness: 0.05 })
  );
  insulator.position.copy(wirePoint);
  group.add(insulator);

  return group;
}

function createOverheadCatenary(curve) {
  const group = new THREE.Group();
  group.name = "light-rail-ocs";

  const poleMat = new THREE.MeshStandardMaterial({ color: PAL.metal, metalness: 0.42, roughness: 0.48 });
  const armMat = new THREE.MeshStandardMaterial({ color: PAL.metal, metalness: 0.5, roughness: 0.4 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x8a8a92, metalness: 0.62, roughness: 0.32 });

  const usableT0 = LIGHT_RAIL_START_T + LIGHT_RAIL_OCS.skipEndT;
  const usableT1 = LIGHT_RAIL_END_T - LIGHT_RAIL_OCS.skipEndT;
  const poleSamples = sampleCurveByArcLength(curve, usableT0, usableT1, LIGHT_RAIL_OCS.poleSpacing);

  for (const sample of poleSamples) {
    const { point, normal } = trackFrameAt(curve, sample.t);
    const poleBase = point.clone().addScaledVector(normal, LIGHT_RAIL_OCS.poleOffset);
    poleBase.y = point.y;
    const wirePoint = point.clone();
    wirePoint.y = point.y + LIGHT_RAIL_OCS.wireHeight;
    group.add(createCantileverPole(poleBase, point, wirePoint, poleMat, armMat));
  }

  const messengerDivisions = 120;
  for (let i = 0; i <= messengerDivisions; i += 1) {
    const t = THREE.MathUtils.lerp(usableT0, usableT1, i / messengerDivisions);
    const { point } = trackFrameAt(curve, t);
    const messenger = point.clone();
    messenger.y = point.y + LIGHT_RAIL_OCS.wireHeight + 0.42;
    if (i > 0) {
      const prevT = THREE.MathUtils.lerp(usableT0, usableT1, (i - 1) / messengerDivisions);
      const prevFrame = trackFrameAt(curve, prevT);
      const prev = prevFrame.point.clone();
      prev.y = prev.y + LIGHT_RAIL_OCS.wireHeight + 0.42;
      const span = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, prev.distanceTo(messenger), 4),
        wireMat
      );
      span.position.copy(prev).lerp(messenger, 0.5);
      span.lookAt(messenger);
      span.rotateX(Math.PI / 2);
      group.add(span);
    }
  }

  for (let i = 0; i <= messengerDivisions; i += 1) {
    const t = THREE.MathUtils.lerp(usableT0, usableT1, i / messengerDivisions);
    const { point } = trackFrameAt(curve, t);
    const contact = point.clone();
    contact.y = point.y + LIGHT_RAIL_OCS.wireHeight;
    if (i > 0) {
      const prevT = THREE.MathUtils.lerp(usableT0, usableT1, (i - 1) / messengerDivisions);
      const prevFrame = trackFrameAt(curve, prevT);
      const prev = prevFrame.point.clone();
      prev.y = prev.y + LIGHT_RAIL_OCS.wireHeight;
      const span = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, prev.distanceTo(contact), 5),
        wireMat
      );
      span.position.copy(prev).lerp(contact, 0.5);
      span.lookAt(contact);
      span.rotateX(Math.PI / 2);
      group.add(span);
    }
  }

  return group;
}

function createTrainConsist() {
  return createLightRailVehicle();
}

export function createLightRail() {
  const curve = createLightRailCurve();
  const root = new THREE.Group();
  root.name = "light-rail";

  LIGHT_RAIL_CONNECTORS.forEach((rect) => {
    if (rect) root.add(createWalkway(rect));
  });

  const pathSigns = LIGHT_RAIL_PATH_SIGNS.map((sign) =>
    sign ? createPathSign(sign.x, sign.z) : null
  );
  pathSigns.forEach((sign) => {
    if (sign) root.add(sign);
  });

  const segments = 160;
  const guideway = new THREE.Mesh(
    buildGuidewayGeometry(curve, LIGHT_RAIL_START_T, LIGHT_RAIL_END_T, LIGHT_RAIL_GUIDEWAY_WIDTH, segments),
    new THREE.MeshStandardMaterial({ color: PAL.concrete, roughness: 0.88, metalness: 0.06 })
  );
  guideway.receiveShadow = true;
  root.add(guideway);

  const railMat = new THREE.MeshStandardMaterial({ color: PAL.metal, metalness: 0.5, roughness: 0.42 });
  for (let i = 0; i <= segments; i += 6) {
    const t = THREE.MathUtils.lerp(LIGHT_RAIL_START_T, LIGHT_RAIL_END_T, i / segments);
    const { point, yaw, pitch, normal } = trackFrameAt(curve, t);
    const railY = point.y + LIGHT_RAIL_RAIL.topAboveBed - LIGHT_RAIL_RAIL.height / 2;
    for (const side of [-LIGHT_RAIL_RAIL.gaugeHalf, LIGHT_RAIL_RAIL.gaugeHalf]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, LIGHT_RAIL_RAIL.height, 0.07),
        railMat
      );
      rail.position.set(
        point.x + normal.x * side,
        railY,
        point.z + normal.z * side
      );
      rail.rotation.order = "YXZ";
      rail.rotation.y = yaw;
      rail.rotation.x = -pitch;
      root.add(rail);
    }
  }

  root.add(createOverheadCatenary(curve));

  const startStation = createStation(curve, LIGHT_RAIL_START_T, "start", 0);
  const endStation = createStation(curve, LIGHT_RAIL_END_T, "end", 0);
  root.add(startStation, endStation);

  const train = createTrainConsist();
  root.add(train);

  root.frustumCulled = false;
  return {
    root,
    train,
    startStation,
    endStation,
    curve,
    connectors: LIGHT_RAIL_CONNECTORS,
    pathSigns,
  };
}

export class LightRailController {
  constructor(system) {
    this.system = system;
    this.state = "idleAtStart";
    this.pathT = LIGHT_RAIL_START_T;
    this.rideT = 0;
    this.passenger = false;
    this.wasInside = false;
    this.boardingCooldown = 0;
    this.interiorScale = 1;
    this._worldPos = new THREE.Vector3();
    this._doorPos = new THREE.Vector3();
    this._local = new THREE.Vector3();
    this._passengerLocal = new THREE.Vector3();
    this._hasPassengerLocal = false;
  }

  getState() {
    return {
      pathT: this.pathT,
      moving: this.isRiding(),
      atStart: this.state === "idleAtStart",
      atEnd: this.state === "idleAtEnd",
    };
  }

  isRiding() {
    return this.state === "ridingForward" || this.state === "ridingBackward";
  }

  isPassengerAtStation() {
    return this.passenger && (this.state === "idleAtStart" || this.state === "idleAtEnd");
  }

  locksMovement() {
    // Passengers walk the cabin; the controller carries them with the car instead.
    return false;
  }

  isPassenger() {
    return this.passenger;
  }

  getTrainScale() {
    return this.system.train.scale.x || 1;
  }

  setPassengerPresentation(active) {
    this.system.train.userData.passengerActive = active;
    const exteriorParts = this.system.train.userData.exteriorParts ?? [];
    for (const part of exteriorParts) {
      // Hide the dense exterior shell when aboard so the scaled cabin + windows read clearly.
      part.visible = !active;
    }
    const interior = this.system.train.userData.interior;
    if (interior) interior.visible = true;
  }

  setPassengerCatScale(cat, active) {
    const s = active ? LIGHT_RAIL_CAR.passengerCatScale : 1;
    cat.cat.scale.setScalar(s);
  }

  updateInteriorScale(dt) {
    const targetX = this.passenger ? LIGHT_RAIL_CAR.interiorScale : 1;
    const targetY = this.passenger ? LIGHT_RAIL_CAR.interiorScaleY : 1;
    const nextX = THREE.MathUtils.lerp(this.system.train.scale.x, targetX, 1 - Math.exp(-4.5 * dt));
    const nextY = THREE.MathUtils.lerp(this.system.train.scale.y, targetY, 1 - Math.exp(-4.5 * dt));
    this.interiorScale = nextX;
    this.system.train.scale.set(nextX, nextY, nextX);
  }

  /** Keep the passenger glued to the car while it moves, clamped inside the aisle. */
  capturePassengerLocal(cat) {
    if (!this.passenger) {
      this._hasPassengerLocal = false;
      return;
    }
    this.system.train.updateMatrixWorld(true);
    // High probe avoids pitch-warped local coords if world Y drifted a frame.
    this._passengerLocal.set(cat.position.x, this.system.train.position.y + 8, cat.position.z);
    this.system.train.worldToLocal(this._passengerLocal);
    this.clampPassengerLocal(this._passengerLocal);
    this._hasPassengerLocal = true;
  }

  applyPassengerLocal(cat) {
    if (!this.passenger || !this._hasPassengerLocal) return;
    this.clampPassengerLocal(this._passengerLocal);
    this.system.train.updateMatrixWorld(true);
    this._worldPos.copy(this._passengerLocal);
    this.system.train.localToWorld(this._worldPos);
    cat.position.copy(this._worldPos);
    cat.cat.position.set(cat.position.x, cat.position.y, cat.position.z);
    cat.grounded = true;
    cat.verticalVelocity = 0;
  }

  clampPassengerLocal(local) {
    const { walkHalfWidth, walkHalfLength, passengerFloorY } = LIGHT_RAIL_CAR;
    local.x = THREE.MathUtils.clamp(local.x, -walkHalfWidth, walkHalfWidth);
    local.z = THREE.MathUtils.clamp(local.z, -walkHalfLength, walkHalfLength);
    local.y = passengerFloorY;
  }

  /** After the player walks in world space, snap back into the cabin shell. */
  syncPassengerWalk(cat) {
    if (!this.passenger) return;
    this.system.train.updateMatrixWorld(true);
    // Use a high probe Y so pitched world→local doesn't warp aisle XZ from a bad height.
    this._passengerLocal.set(cat.position.x, this.system.train.position.y + 8, cat.position.z);
    this.system.train.worldToLocal(this._passengerLocal);
    this.clampPassengerLocal(this._passengerLocal);
    this.applyPassengerLocal(cat);
    this.updateSeatPose(cat);
  }

  updateSeatPose(cat) {
    if (!this.passenger) return;
    const pads = this.system.train.userData.seatPads ?? [];
    const moving = Boolean(cat.isMoving);
    let onSeat = false;
    for (const pad of pads) {
      if (
        Math.abs(this._passengerLocal.x - pad.x) < pad.halfX &&
        Math.abs(this._passengerLocal.z - pad.z) < pad.halfZ
      ) {
        onSeat = true;
        break;
      }
    }
    const cabZ = this.getCabSeatLocalZ();
    if (Math.abs(this._passengerLocal.x) < 0.45 && Math.abs(this._passengerLocal.z - cabZ) < 0.7) {
      onSeat = true;
    }
    if (onSeat && !moving) {
      cat.setSeated(true);
    } else if (moving || !onSeat) {
      cat.setSeated(false);
    }
  }

  /** Local Z of the cab seat for the current travel direction. */
  getCabSeatLocalZ() {
    const halfL = LIGHT_RAIL_CAR.length / 2;
    const offset = LIGHT_RAIL_CAR.seat.cabinOffset;
    const towardFront = !(this.state === "ridingBackward" || this.state === "idleAtEnd");
    return towardFront ? halfL - offset : -(halfL - offset);
  }

  syncCabFurniture() {
    const seatZ = this.getCabSeatLocalZ();
    const towardFront = seatZ > 0;
    const seat = LIGHT_RAIL_CAR.seat;
    const bench = this.system.train.userData.bench;
    const seatBack = this.system.train.userData.seatBack;
    if (bench) {
      bench.position.set(seat.x, seat.y - 0.28, seatZ + (towardFront ? -0.35 : 0.35));
      bench.rotation.y = towardFront ? 0 : Math.PI;
    }
    if (seatBack) {
      seatBack.position.set(seat.x, seat.y + 0.16, seatZ + (towardFront ? -0.72 : 0.72));
      seatBack.rotation.y = towardFront ? 0 : Math.PI;
    }
  }

  /** Look along the track in the direction the train is traveling (or will travel). */
  getTravelViewYaw() {
    const yaw = this.system.train.rotation.y;
    if (this.state === "ridingBackward" || this.state === "idleAtEnd") {
      return yaw + Math.PI;
    }
    return yaw;
  }

  /** @deprecated Prefer getTravelViewYaw — kept for older call sites. */
  getWindowViewYaw() {
    return this.getTravelViewYaw();
  }

  getSeatWorldPosition(target = this._worldPos) {
    const { seat } = LIGHT_RAIL_CAR;
    this.system.train.updateMatrixWorld(true);
    this._local.set(seat.x, LIGHT_RAIL_CAR.floorY, this.getCabSeatLocalZ());
    this.system.train.localToWorld(this._local);
    target.copy(this._local);
    return target;
  }

  /** Standing / walking eye height uses the cat; seated keeps a cab raise. */
  getPassengerEyeWorldY() {
    const train = this.system.train;
    const scale = LIGHT_RAIL_CAR.passengerCatScale;
    return passengerFeetWorldY(train) + 0.92 * scale;
  }

  getWalkHeight(wx, wz) {
    if (this.passenger) {
      return carFloorWorldY(this.system.train, wx, wz);
    }

    const heights = [];

    for (const rect of this.system.connectors) {
      if (!rect) continue;
      if (inRect(wx, wz, rect)) heights.push(worldHeight(wx, wz) + (rect.y ?? 0.04));
    }

    for (const station of [this.system.startStation, this.system.endStation]) {
      const deck = station.userData.platformDeckRect;
      if (deck && inRect(wx, wz, deck, 0.1)) heights.push(deck.y);

      const plaza = station.userData.plazaRect;
      if (plaza && inRect(wx, wz, plaza, 0.1)) heights.push(plaza.y);

      const stairs = station.userData.stairRects;
      if (stairs) {
        for (const step of stairs) {
          if (inRect(wx, wz, step, 0.04)) heights.push(step.y);
        }
      }
    }

    // Solid floor inside / on the threshold of the car so you cannot fall through.
    if (this.isOverTrainFloor(wx, wz)) {
      heights.push(carFloorWorldY(this.system.train, wx, wz));
    }

    if (heights.length === 0) return null;
    return Math.max(...heights);
  }

  isOverTrainFloor(wx, wz) {
    this.system.train.updateMatrixWorld(true);
    this._local.set(wx, 0, wz);
    this.system.train.worldToLocal(this._local);
    const { length, width, walkHalfWidth, walkHalfLength } = LIGHT_RAIL_CAR;
    if (this.passenger) {
      return Math.abs(this._local.z) <= walkHalfLength + 0.05 && Math.abs(this._local.x) <= walkHalfWidth + 0.05;
    }
    return Math.abs(this._local.z) < length * 0.5 && Math.abs(this._local.x) < width * 0.5;
  }

  isOnRailCorridor(wx, wz) {
    if (this.isRiding() || this.passenger) return true;
    if (this.isOverTrainFloor(wx, wz)) return true;
    for (const rect of this.system.connectors) {
      if (rect && inRect(wx, wz, rect, 0.35)) return true;
    }
    for (const station of [this.system.startStation, this.system.endStation]) {
      const plat = station.userData.platformRect;
      if (plat && inRect(wx, wz, plat, 0.4)) return true;
      const deck = station.userData.platformDeckRect;
      if (deck && inRect(wx, wz, deck, 0.3)) return true;
      const plaza = station.userData.plazaRect;
      if (plaza && inRect(wx, wz, plaza, 0.3)) return true;
      const stairs = station.userData.stairRects;
      if (stairs) {
        for (const step of stairs) {
          if (inRect(wx, wz, step, 0.2)) return true;
        }
      }
    }
    return false;
  }

  filterCollisions(wx, wz, collisions) {
    if (!this.isOnRailCorridor(wx, wz)) return collisions;
    return collisions.filter((box) => {
      if (box.cx > 8 && box.cx < 40) return false;
      return true;
    });
  }

  positionTrain() {
    const curve = this.system.curve;
    const { point, yaw, pitch } = trackFrameAt(curve, this.pathT);

    this.system.train.position.copy(point);
    this.system.train.rotation.order = "YXZ";
    this.system.train.rotation.set(-pitch, yaw, 0);
    this.syncCabFurniture();

    const moving = this.isRiding();
    const headlight = this.system.train.userData.headlight;
    const taillight = this.system.train.userData.taillight;
    const doorGlow = this.system.train.userData.doorGlow;
    if (headlight) headlight.material.emissiveIntensity = moving ? 0.75 : 0.45;
    if (taillight) taillight.material.emissiveIntensity = moving ? 0.55 : 0.3;
    if (doorGlow) {
      doorGlow.material.opacity = moving ? 0.35 : 0.85;
      doorGlow.material.emissiveIntensity = moving ? 0.08 : 0.28;
    }
  }

  distToStation(wx, wz, station) {
    const c = station.userData.center;
    const dx = wx - c.x;
    const dz = wz - c.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  isNearStartStation(cat) {
    return this.isOnStationDock(cat, this.system.startStation, 0);
  }

  isNearEndStation(cat) {
    return this.isOnStationDock(cat, this.system.endStation, 1);
  }

  /** Platform, ramp, boarding radius, or the connector pad into that station. */
  isOnStationDock(cat, station, connectorIndex) {
    const wx = cat.position.x;
    const wz = cat.position.z;

    if (this.distToStation(wx, wz, station) < LIGHT_RAIL_PLATFORM_RADIUS + 2.5) return true;

    const plat = station.userData.platformRect;
    if (plat && inRect(wx, wz, plat, 1.6)) return true;

    const ramp = station.userData.rampRect;
    if (ramp && inRect(wx, wz, ramp, 1.2)) return true;

    const connector = LIGHT_RAIL_CONNECTORS[connectorIndex];
    if (connector && inRect(wx, wz, connector, 0.8)) {
      // Station-side of the pad (east half) — walkway into the dock.
      const midX = (connector.x0 + connector.x1) * 0.5;
      if (wx >= midX - 2) return true;
    }

    return false;
  }

  isOnStartConnector(wx, wz) {
    const rect = LIGHT_RAIL_CONNECTORS[0];
    return rect ? inRect(wx, wz, rect, 0.4) : false;
  }

  isOnEndConnector(wx, wz) {
    const rect = LIGHT_RAIL_CONNECTORS[1];
    return rect ? inRect(wx, wz, rect, 0.4) : false;
  }

  isApproachingStation(cat, options = {}) {
    if (options.elevatorInside || this.isRiding() || this.passenger) return false;

    const { x, z } = cat.position;
    if (this.state === "idleAtStart") {
      if (this.distToStation(x, z, this.system.startStation) < LIGHT_RAIL_APPROACH_RADIUS) return true;
      if (this.isOnStartConnector(x, z)) return true;
      const sign = LIGHT_RAIL_PATH_SIGNS[0];
      if (sign) {
        const dx = x - sign.x;
        const dz = z - sign.z;
        if (dx * dx + dz * dz < 64) return true;
      }
    }
    if (this.state === "idleAtEnd") {
      if (this.distToStation(x, z, this.system.endStation) < LIGHT_RAIL_APPROACH_RADIUS) return true;
      if (this.isOnEndConnector(x, z)) return true;
      const sign = LIGHT_RAIL_PATH_SIGNS[1];
      if (sign) {
        const dx = x - sign.x;
        const dz = z - sign.z;
        if (dx * dx + dz * dz < 64) return true;
      }
    }
    return false;
  }

  formatContextHint(title, message) {
    return { title, message };
  }

  isInsideTrain(cat) {
    return this.isInsideTrainAt(
      cat.position.x,
      cat.position.z,
      cat.position.y
    );
  }

  isInsideTrainAt(wx, wz, wy) {
    this.system.train.updateMatrixWorld(true);
    this._local.set(wx, wy, wz);
    this.system.train.worldToLocal(this._local);

    const { walkHalfWidth, walkHalfLength, length, width } = LIGHT_RAIL_CAR;
    const floorWorld = carFloorWorldY(this.system.train);
    const halfW = this.passenger ? walkHalfWidth + 0.15 : width * 0.42;
    const halfL = this.passenger ? walkHalfLength + 0.2 : length * 0.48;

    return (
      Math.abs(this._local.z) < halfL &&
      Math.abs(this._local.x) < halfW &&
      wy >= floorWorld - 0.35 &&
      wy <= floorWorld + 2.4
    );
  }

  getDoorWorldPosition(target = this._doorPos) {
    const { width, platformSide, passengerFloorY, floorY } = LIGHT_RAIL_CAR;
    this.system.train.updateMatrixWorld(true);
    this._local.set(platformSide * (width * 0.28), this.passenger ? passengerFloorY : floorY, 0);
    this.system.train.localToWorld(this._local);
    target.copy(this._local);
    return target;
  }

  wantsBoard(input) {
    return input.jumpQueued;
  }

  wantsDepart(input) {
    return input.interactQueued;
  }

  wantsDeboard(input) {
    return input.jumpQueued;
  }

  consumeBoardInput(input) {
    if (input.jumpQueued) input.jumpQueued = false;
  }

  consumeDepartInput(input) {
    if (input.interactQueued) input.interactQueued = false;
  }

  getContextHint(cat, options = {}) {
    if (this.isRiding() && this.passenger) {
      return this.formatContextHint(
        "Light rail",
        "Walk the cabin · look out the windows — stay aboard until the next stop"
      );
    }
    if (this.passenger && this.isPassengerAtStation()) {
      return this.formatContextHint(
        "Light rail",
        `${controlHint("board")} get off · ${controlHint("ride")} ride to the other station`
      );
    }
    if (this.canDepart()) {
      return this.formatContextHint("Light rail", `${controlHint("ride")} ride to the other station`);
    }
    if (this.canBoard(cat, options)) {
      return this.formatContextHint("Light rail", `${controlHint("board")} board the train`);
    }
    if (this.isApproachingStation(cat, options)) {
      return this.formatContextHint(
        "Light rail",
        `${controlHint("board")} board · ${controlHint("ride")} ride to the other station`
      );
    }
    return null;
  }

  canBoard(cat, options = {}) {
    if (options.elevatorInside) return false;
    if (this.isRiding() || this.passenger) return false;
    if (this.boardingCooldown > 0) return false;
    const inside = this.isInsideTrain(cat);
    if (this.state === "idleAtStart" && (inside || this.isNearStartStation(cat))) return true;
    if (this.state === "idleAtEnd" && (inside || this.isNearEndStation(cat))) return true;
    return false;
  }

  canDepart() {
    return this.isPassengerAtStation();
  }

  tryBoard(cat, input, options = {}) {
    if (!this.wantsBoard(input)) return false;
    if (!this.canBoard(cat, options)) {
      // Eat Space on the approach pad/dock so it doesn't jump instead of boarding.
      if (this.isApproachingStation(cat, options)) {
        this.consumeBoardInput(input);
      }
      return false;
    }
    this.consumeBoardInput(input);
    this.passenger = true;
    this.applyCatToTrain(cat, false);
    return true;
  }

  tryDepart(cat, input) {
    if (!this.canDepart() || !this.wantsDepart(input)) return false;
    this.consumeDepartInput(input);
    const forward = this.state === "idleAtStart";
    this.beginRide(cat, forward);
    return true;
  }

  tryDeboard(cat, input) {
    // Only allow leaving while the train is stopped at a station.
    if (!this.passenger || this.isRiding() || !this.isPassengerAtStation()) return false;
    if (!this.wantsDeboard(input)) return false;
    this.consumeBoardInput(input);
    this.deboard(cat);
    return true;
  }

  deboard(cat) {
    this.passenger = false;
    this.boardingCooldown = LIGHT_RAIL_BOARD_COOLDOWN;
    this.rideT = 0;
    this._hasPassengerLocal = false;
    this.setPassengerPresentation(false);
    this.setPassengerCatScale(cat, false);

    cat.setSeated(false);
    cat.viewPitch = 0;
    this.getDoorWorldPosition(this._worldPos);
    // Exit onto the platform side while the car eases back to exterior scale.
    this.system.train.scale.set(1, 1, 1);
    this.interiorScale = 1;
    this.getDoorWorldPosition(this._worldPos);
    cat.position.copy(this._worldPos);
    cat.cat.position.set(cat.position.x, cat.position.y, cat.position.z);
    cat.grounded = true;
    cat.verticalVelocity = 0;
    cat.isMoving = false;
    const yaw = this.system.train.rotation.y;
    cat.facing = yaw + Math.PI;
    cat.cat.rotation.y = cat.facing;
    cat.resetWalkPose();
    this.wasInside = this.isInsideTrain(cat);
  }

  /** Place the cat in the aisle (standing) when boarding. */
  applyCatToTrain(cat, atDoor = false) {
    this.system.train.updateMatrixWorld(true);
    const yaw = this.system.train.rotation.y;
    this.syncCabFurniture();
    this.setPassengerPresentation(true);
    this.setPassengerCatScale(cat, true);

    if (atDoor) {
      this.getDoorWorldPosition(this._worldPos);
      this._passengerLocal.set(
        LIGHT_RAIL_CAR.platformSide * 0.15,
        LIGHT_RAIL_CAR.passengerFloorY,
        0
      );
    } else {
      this._passengerLocal.set(0, LIGHT_RAIL_CAR.passengerFloorY, this.getCabSeatLocalZ() * 0.35);
    }
    this.clampPassengerLocal(this._passengerLocal);
    this._hasPassengerLocal = true;
    this.applyPassengerLocal(cat);

    cat.setSeated(false);
    cat.facing = atDoor ? yaw + Math.PI : this.getTravelViewYaw();
    cat.viewPitch = -0.04;
    cat.cat.rotation.y = cat.facing;
    cat.resetWalkPose();
  }

  canInteract(cat, options = {}) {
    return this.canBoard(cat, options) || this.canDepart() || this.passenger;
  }

  finishRide(cat, nextState, pathT) {
    this.state = nextState;
    this.pathT = pathT;
    this.rideT = 0;
    // Stay aboard at the destination so you can walk around and choose when to get off.
    this.passenger = true;
    this.positionTrain();
    this.capturePassengerLocal(cat);
    this.applyPassengerLocal(cat);
    this.setPassengerPresentation(true);
    cat.setSeated(false);
    cat.resetWalkPose();
  }

  beginRide(cat, forward) {
    this.state = forward ? "ridingForward" : "ridingBackward";
    this.rideT = 0;
    this.passenger = true;
    this.setPassengerPresentation(true);
    this.setPassengerCatScale(cat, true);
    this.capturePassengerLocal(cat);
    this.applyPassengerLocal(cat);
  }

  update(dt, cat, input, options = {}) {
    if (this.boardingCooldown > 0) {
      this.boardingCooldown = Math.max(0, this.boardingCooldown - dt);
    }

    this.capturePassengerLocal(cat);
    this.positionTrain();
    this.updateInteriorScale(dt);
    this.applyPassengerLocal(cat);

    const inside = this.isInsideTrain(cat);
    if (!inside) this.wasInside = false;

    if (this.state === "idleAtStart") {
      if (this.tryDeboard(cat, input)) return false;
      if (this.tryBoard(cat, input, options)) return false;
      if (this.tryDepart(cat, input)) return false;
      this.wasInside = inside;
      return false;
    }

    if (this.state === "idleAtEnd") {
      if (this.tryDeboard(cat, input)) return false;
      if (this.tryBoard(cat, input, options)) return false;
      if (this.tryDepart(cat, input)) return false;
      this.wasInside = inside;
      return false;
    }

    if (this.state === "ridingForward") {
      // Swallow board/deboard taps while moving so they can't jump off mid-ride.
      if (this.wantsDeboard(input) || this.wantsBoard(input)) this.consumeBoardInput(input);
      this.rideT += dt / LIGHT_RAIL_RIDE_DURATION;
      const eased = easeInOut(Math.min(1, this.rideT));
      this.pathT = THREE.MathUtils.lerp(LIGHT_RAIL_START_T, LIGHT_RAIL_END_T, eased);
      this.capturePassengerLocal(cat);
      this.positionTrain();
      this.updateInteriorScale(dt);
      this.applyPassengerLocal(cat);
      if (this.rideT >= 1) {
        this.finishRide(cat, "idleAtEnd", LIGHT_RAIL_END_T);
      }
      return false;
    }

    if (this.state === "ridingBackward") {
      if (this.wantsDeboard(input) || this.wantsBoard(input)) this.consumeBoardInput(input);
      this.rideT += dt / LIGHT_RAIL_RIDE_DURATION;
      const eased = easeInOut(Math.min(1, this.rideT));
      this.pathT = THREE.MathUtils.lerp(LIGHT_RAIL_END_T, LIGHT_RAIL_START_T, eased);
      this.capturePassengerLocal(cat);
      this.positionTrain();
      this.updateInteriorScale(dt);
      this.applyPassengerLocal(cat);
      if (this.rideT >= 1) {
        this.finishRide(cat, "idleAtStart", LIGHT_RAIL_START_T);
      }
      return false;
    }

    return false;
  }

  animateStations(elapsed) {
    const pulse = 0.35 + Math.sin(elapsed * 2.4) * 0.18;
    const signPulse = 0.45 + Math.sin(elapsed * 2.1) * 0.2;

    for (const station of [this.system.startStation, this.system.endStation]) {
      const glow = station.userData.glow;
      if (glow) {
        const active =
          (station === this.system.startStation && this.state === "idleAtStart") ||
          (station === this.system.endStation && this.state === "idleAtEnd");
        glow.material.emissiveIntensity = active ? pulse : 0.1;
        glow.material.opacity = active ? 0.5 : 0.14;

        const beacon = station.userData.beacon;
        if (beacon) {
          beacon.material.emissiveIntensity = active ? 0.55 + pulse * 0.35 : 0.28;
        }
      }

      const flag = station.userData.catFlag;
      const cloth = flag?.userData?.flagCloth;
      if (cloth) {
        const phase = flag.userData.flagPhase ?? 0;
        cloth.rotation.z = Math.sin(elapsed * 1.7 + phase) * 0.07;
        cloth.rotation.x = Math.sin(elapsed * 2.3 + phase * 1.3) * 0.04;
      }
    }

    for (const sign of this.system.pathSigns ?? []) {
      if (!sign) continue;
      const board = sign.userData.board;
      const arrow = sign.userData.arrow;
      if (board) board.material.emissiveIntensity = signPulse;
      if (arrow) arrow.material.emissiveIntensity = signPulse * 0.75;
    }
  }
}
