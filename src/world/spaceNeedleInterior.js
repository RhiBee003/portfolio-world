import * as THREE from "three";
import {
  SPACE_NEEDLE_POSITION,
  SPACE_NEEDLE_OBSERVATION_Y,
  SPACE_NEEDLE_CAR_WALK_Y,
  SPACE_NEEDLE_STAIR_AXIS_Z,
  SPACE_NEEDLE_SHAFT,
  SPACE_NEEDLE_CAR,
  SPACE_NEEDLE_STAIR,
  SPACE_NEEDLE_STAIR_FLIGHTS,
  isInElevatorDoorway,
} from "./spaceNeedleConfig.js";

const NEEDLE_X = SPACE_NEEDLE_POSITION.x;
const NEEDLE_Z = SPACE_NEEDLE_POSITION.z;

const FOUNDATION_R = 5.15;
const PLAZA_Y = 0.14;
const PLATFORM_TOP_Y = 0.14;
const CORE_RADIUS = 1.15;
const DECK_INNER_R = 2.35;
const DECK_OUTER_R = 5.15;

const STAIR = SPACE_NEEDLE_STAIR;
const STAIR_AXIS_Z = SPACE_NEEDLE_STAIR_AXIS_Z;
const STAIR_WIDTH = STAIR.width;

const CONCRETE = 0xa8a39c;
const STAIR_GREY = 0x9e9890;

function toWorld(lx, lz) {
  return { x: NEEDLE_X + lx, z: NEEDLE_Z + lz };
}

function inBox(wx, wz, cx, cz, hx, hz) {
  return Math.abs(wx - cx) <= hx && Math.abs(wz - cz) <= hz;
}

function inCircle(wx, wz, cx, cz, r) {
  const dx = wx - cx;
  const dz = wz - cz;
  return dx * dx + dz * dz <= r * r;
}

function inRing(wx, wz, cx, cz, innerR, outerR) {
  const dx = wx - cx;
  const dz = wz - cz;
  const d2 = dx * dx + dz * dz;
  return d2 >= innerR * innerR && d2 <= outerR * outerR;
}

function stairMaterial() {
  return new THREE.MeshStandardMaterial({ color: STAIR_GREY, roughness: 0.92, metalness: 0.04 });
}

function createStairRun(group, startX, endX, y0, y1, steps) {
  const stepDepth = Math.abs(endX - startX) / steps;
  const stepH = (y1 - y0) / steps;
  const dir = endX >= startX ? 1 : -1;
  const mat = stairMaterial();

  for (let i = 0; i < steps; i += 1) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(stepDepth * 0.98, stepH, STAIR_WIDTH),
      mat
    );
    const x = startX + dir * (i * stepDepth + stepDepth * 0.5);
    step.position.set(x, y0 + stepH * (i + 0.5), STAIR_AXIS_Z);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }
}

function createSymmetricalFlight(group, startX, endX, y0, y1, steps, railMat) {
  createStairRun(group, startX, endX, y0, y1, steps);

  const span = Math.abs(endX - startX);
  const midX = (startX + endX) / 2;
  const railY = (y0 + y1) / 2 + 0.28;
  const railHalfZ = STAIR_WIDTH / 2 + 0.06;

  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 0.55, 0.07), railMat);
    rail.position.set(midX, railY, STAIR_AXIS_Z + side * railHalfZ);
    rail.castShadow = true;
    group.add(rail);
  }
}

function createLandingPad(group, centerX, y, lengthX) {
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(lengthX, 0.12, STAIR_WIDTH),
    stairMaterial()
  );
  pad.position.set(centerX, y - 0.06, STAIR_AXIS_Z);
  pad.castShadow = true;
  pad.receiveShadow = true;
  group.add(pad);
}

export function createSpaceNeedleInterior(needleGroup, collisions) {
  const interior = new THREE.Group();
  interior.name = "space-needle-interior";

  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(4.35, 4.55, 0.12, 32),
    new THREE.MeshStandardMaterial({ color: CONCRETE, roughness: 0.94, metalness: 0 })
  );
  plaza.position.y = PLAZA_Y - 0.06;
  plaza.receiveShadow = true;
  interior.add(plaza);

  const railMat = new THREE.MeshStandardMaterial({ color: 0xc8c4bc, metalness: 0.25, roughness: 0.65 });

  createSymmetricalFlight(
    interior,
    SPACE_NEEDLE_STAIR_FLIGHTS[0].startX,
    SPACE_NEEDLE_STAIR_FLIGHTS[0].endX,
    SPACE_NEEDLE_STAIR_FLIGHTS[0].y0,
    SPACE_NEEDLE_STAIR_FLIGHTS[0].y1,
    SPACE_NEEDLE_STAIR_FLIGHTS[0].steps,
    railMat
  );
  createLandingPad(interior, STAIR.platformX - 0.45, PLATFORM_TOP_Y, 1.2);
  createSymmetricalFlight(
    interior,
    SPACE_NEEDLE_STAIR_FLIGHTS[1].startX,
    SPACE_NEEDLE_STAIR_FLIGHTS[1].endX,
    SPACE_NEEDLE_STAIR_FLIGHTS[1].y0,
    SPACE_NEEDLE_STAIR_FLIGHTS[1].y1,
    SPACE_NEEDLE_STAIR_FLIGHTS[1].steps,
    railMat
  );

  const cabHalfW = SPACE_NEEDLE_CAR.width / 2;
  createLandingPad(
    interior,
    (STAIR.topX + SPACE_NEEDLE_SHAFT.x) / 2,
    SPACE_NEEDLE_CAR_WALK_Y,
    STAIR.topX - SPACE_NEEDLE_SHAFT.x + cabHalfW + 0.25
  );

  const deckRing = new THREE.Mesh(
    new THREE.RingGeometry(DECK_INNER_R, DECK_OUTER_R, 48),
    new THREE.MeshStandardMaterial({ color: 0xf0eeea, roughness: 0.82, metalness: 0.06, side: THREE.DoubleSide })
  );
  deckRing.rotation.x = -Math.PI / 2;
  deckRing.position.y = SPACE_NEEDLE_OBSERVATION_Y;
  interior.add(deckRing);

  needleGroup.add(interior);
  addInteriorCollisions(collisions);
}

function addInteriorCollisions(collisions) {
  const legAngles = [Math.PI / 6, Math.PI / 6 + (2 * Math.PI) / 3, Math.PI / 6 + (4 * Math.PI) / 3];

  for (const angle of legAngles) {
    const dist = 3.65;
    const lx = Math.cos(angle) * dist;
    const lz = Math.sin(angle) * dist;
    const world = toWorld(lx, lz);
    collisions.push({
      cx: world.x,
      cz: world.z,
      hx: 0.85,
      hz: 2.35,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      minY: 0,
      maxY: 20,
      needleLeg: true,
    });
  }

  const core = toWorld(0, 0);
  collisions.push({
    cx: core.x,
    cz: core.z,
    hx: CORE_RADIUS,
    hz: CORE_RADIUS,
    cos: 1,
    sin: 0,
    minY: 0,
    maxY: 48,
    needleCore: true,
  });

  const shellSegments = [
    { lx: -4.8, lz: -3.6, hx: 1.1, hz: 2.4, rot: -0.55 },
    { lx: -4.8, lz: 3.6, hx: 1.1, hz: 2.4, rot: 0.55 },
    { lx: 0.2, lz: -5.0, hx: 2.2, hz: 0.9, rot: 0 },
  ];

  for (const seg of shellSegments) {
    const world = toWorld(seg.lx, seg.lz);
    collisions.push({
      cx: world.x,
      cz: world.z,
      hx: seg.hx,
      hz: seg.hz,
      cos: Math.cos(seg.rot),
      sin: Math.sin(seg.rot),
      minY: 0,
      maxY: 3.5,
      needleShell: true,
    });
  }
}

export function isInSpaceNeedleCompound(wx, wz, wy = 0) {
  const lx = wx - NEEDLE_X;
  const lz = wz - NEEDLE_Z;

  if (wy > 40) {
    return inRing(wx, wz, NEEDLE_X, NEEDLE_Z, DECK_INNER_R - 0.5, DECK_OUTER_R + 0.8);
  }

  if (inCircle(wx, wz, NEEDLE_X, NEEDLE_Z, FOUNDATION_R + 1.2)) return true;
  if (lx > 4.5 && Math.abs(lz - STAIR_AXIS_Z) < 2.4) return true;

  return false;
}

function heightOnStairRun(lx, startX, endX, y0, y1, steps) {
  const stepDepth = Math.abs(endX - startX) / steps;
  const stepH = (y1 - y0) / steps;
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);

  if (lx < minX || lx > maxX + stepDepth * 0.15) return null;

  let stepIndex;
  if (endX >= startX) {
    stepIndex = Math.floor((lx - startX) / stepDepth);
  } else {
    stepIndex = Math.floor((startX - lx) / stepDepth);
  }
  stepIndex = THREE.MathUtils.clamp(stepIndex, 0, steps - 1);
  return y0 + stepH * (stepIndex + 1);
}

function stairCorridorHeight(wx, wz, elevatorState) {
  const lx = wx - NEEDLE_X;
  const lz = wz - NEEDLE_Z;
  const halfW = STAIR_WIDTH / 2 + 0.12;
  const cabHalfW = SPACE_NEEDLE_CAR.width / 2;

  if (Math.abs(lz - STAIR_AXIS_Z) > halfW) return null;

  const candidates = [];

  if (lx >= STAIR.platformX - 1.05 && lx <= STAIR.platformX + 0.55) {
    candidates.push(PLATFORM_TOP_Y);
  }

  for (const flight of SPACE_NEEDLE_STAIR_FLIGHTS) {
    const top = heightOnStairRun(lx, flight.startX, flight.endX, flight.y0, flight.y1, flight.steps);
    if (top !== null) candidates.push(top);
  }

  const carFloorY = elevatorState?.carY ?? SPACE_NEEDLE_CAR_WALK_Y - 0.1;
  const carWalkY = carFloorY + 0.1;

  if (
    lx >= SPACE_NEEDLE_SHAFT.x - cabHalfW - 0.15 &&
    lx <= STAIR.topX + 0.45
  ) {
    candidates.push(carWalkY);
  }

  if (isInElevatorDoorway(lx, lz, 0.15)) {
    candidates.push(carWalkY);
  }

  if (lx >= STAIR.entryX0 - 0.85 && lx < STAIR.entryX0) {
    candidates.push(PLATFORM_TOP_Y);
  }

  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

export function isOnStairCorridor(wx, wz) {
  const lx = wx - NEEDLE_X;
  const lz = wz - NEEDLE_Z;
  const halfW = STAIR_WIDTH / 2 + 0.35;
  return (
    lx >= STAIR.entryX0 - 0.8 &&
    lx <= STAIR.topX + 1.2 &&
    Math.abs(lz - STAIR_AXIS_Z) <= halfW
  );
}

function plazaHeight(wx, wz) {
  const lx = wx - NEEDLE_X;
  if (!inCircle(wx, wz, NEEDLE_X, NEEDLE_Z, 4.4)) return null;
  if (inCircle(wx, wz, NEEDLE_X, NEEDLE_Z, CORE_RADIUS + 0.35)) return null;
  if (lx > STAIR.entryX0 - 0.5) return null;
  return PLAZA_Y;
}

function deckHeight(wx, wz) {
  if (!inRing(wx, wz, NEEDLE_X, NEEDLE_Z, DECK_INNER_R, DECK_OUTER_R)) return null;
  return SPACE_NEEDLE_OBSERVATION_Y;
}

export function createWalkHeightQuery(elevatorSystem) {
  return function getWalkHeight(wx, wz, elevatorState) {
    const heights = [];

    const plaza = plazaHeight(wx, wz);
    if (plaza !== null) heights.push(plaza);

    const stair = stairCorridorHeight(wx, wz, elevatorState);
    if (stair !== null) heights.push(stair);

    if (elevatorState?.atTop) {
      const deck = deckHeight(wx, wz);
      if (deck !== null) heights.push(deck);
    }

    if (heights.length === 0) return 0;
    return Math.max(...heights);
  };
}

export function filterNeedleCollisions(wx, wz, collisions) {
  const lx = wx - NEEDLE_X;
  const lz = wz - NEEDLE_Z;
  const onStairs =
    lx >= STAIR.entryX0 - 1.0 &&
    lx <= STAIR.topX + 1.4 &&
    Math.abs(lz - STAIR_AXIS_Z) < STAIR_WIDTH / 2 + 1.3;
  const inElevatorWalk =
    lx > SPACE_NEEDLE_SHAFT.x - SPACE_NEEDLE_CAR.width / 2 - 1.4 &&
    lx <= STAIR.topX + 0.9 &&
    Math.abs(lz - STAIR_AXIS_Z) < STAIR_WIDTH / 2 + 1.1;

  if (!onStairs && !inElevatorWalk) return collisions;

  return collisions.filter((box) => !box.needleCore && !box.needleLeg && !box.needleShell);
}

export function getShaftWorldPosition(target = new THREE.Vector3()) {
  return target.set(NEEDLE_X + SPACE_NEEDLE_SHAFT.x, 0, NEEDLE_Z + SPACE_NEEDLE_SHAFT.z);
}
