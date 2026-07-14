import * as THREE from "three";
import { worldHeight } from "./terrain.js";

const DROP_COUNT = 2400;
const FLAKE_COUNT = 1800;
const AREA = 34;
const CEILING = 18;
const FLOOR = -0.4;
const STREAK = 0.55;
const FLAKE_SIZE = 0.07;

/**
 * 0 = full city rain, 1 = mountain snow.
 * Builds as you walk north toward the Cascades backdrop / overpass.
 */
export function mountainSnowBlend(x, z) {
  const towardPeaks = THREE.MathUtils.smoothstep(4, 28, z);
  const elev = THREE.MathUtils.smoothstep(2, 14, worldHeight(x, z));
  return THREE.MathUtils.clamp(towardPeaks * 0.9 + elev * towardPeaks * 0.25, 0, 1);
}

/**
 * Soft diagonal rainfall that follows the cat — reads through the pink city fog.
 */
function createRainSystem() {
  const positions = new Float32Array(DROP_COUNT * 6);
  const speeds = new Float32Array(DROP_COUNT);
  const drifts = new Float32Array(DROP_COUNT);

  function placeDrop(index, randomizeY) {
    const i6 = index * 6;
    const x = (Math.random() - 0.5) * AREA * 2;
    const z = (Math.random() - 0.5) * AREA * 2;
    const y = randomizeY ? Math.random() * CEILING : CEILING + Math.random() * 4;
    positions[i6] = x;
    positions[i6 + 1] = y;
    positions[i6 + 2] = z;
    positions[i6 + 3] = x - 0.04;
    positions[i6 + 4] = y - STREAK;
    positions[i6 + 5] = z + 0.02;
    speeds[index] = 11 + Math.random() * 10;
    drifts[index] = 0.35 + Math.random() * 0.55;
  }

  for (let i = 0; i < DROP_COUNT; i += 1) {
    placeDrop(i, true);
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttr);

  const material = new THREE.LineBasicMaterial({
    color: 0xc5d2de,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    fog: true,
  });

  const mesh = new THREE.LineSegments(geometry, material);
  mesh.name = "rainfall";
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;

  const origin = new THREE.Vector3();

  function update(dt, center) {
    origin.copy(center);
    const fall = Math.min(dt, 0.05);

    for (let i = 0; i < DROP_COUNT; i += 1) {
      const i6 = i * 6;
      const dy = speeds[i] * fall;
      const dx = drifts[i] * fall;

      positions[i6] -= dx * 0.35;
      positions[i6 + 1] -= dy;
      positions[i6 + 2] += dx * 0.12;
      positions[i6 + 3] = positions[i6] - 0.04;
      positions[i6 + 4] = positions[i6 + 1] - STREAK;
      positions[i6 + 5] = positions[i6 + 2] + 0.02;

      if (positions[i6 + 1] < FLOOR) {
        placeDrop(i, false);
      }
    }

    positionAttr.needsUpdate = true;
    mesh.position.set(origin.x, 0, origin.z);
  }

  return { mesh, material, update };
}

function createSnowSystem() {
  const positions = new Float32Array(FLAKE_COUNT * 3);
  const speeds = new Float32Array(FLAKE_COUNT);
  const driftsX = new Float32Array(FLAKE_COUNT);
  const driftsZ = new Float32Array(FLAKE_COUNT);
  const phases = new Float32Array(FLAKE_COUNT);

  function placeFlake(index, randomizeY) {
    const i3 = index * 3;
    positions[i3] = (Math.random() - 0.5) * AREA * 2;
    positions[i3 + 1] = randomizeY ? Math.random() * CEILING : CEILING + Math.random() * 5;
    positions[i3 + 2] = (Math.random() - 0.5) * AREA * 2;
    speeds[index] = 1.1 + Math.random() * 1.8;
    driftsX[index] = 0.4 + Math.random() * 1.1;
    driftsZ[index] = 0.2 + Math.random() * 0.8;
    phases[index] = Math.random() * Math.PI * 2;
  }

  for (let i = 0; i < FLAKE_COUNT; i += 1) {
    placeFlake(i, true);
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttr);

  const material = new THREE.PointsMaterial({
    color: 0xfff8fc,
    size: FLAKE_SIZE,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: true,
    toneMapped: false,
  });

  const mesh = new THREE.Points(geometry, material);
  mesh.name = "snowfall";
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.visible = false;

  const origin = new THREE.Vector3();
  let time = 0;

  function update(dt, center) {
    origin.copy(center);
    time += dt;
    const fall = Math.min(dt, 0.05);

    for (let i = 0; i < FLAKE_COUNT; i += 1) {
      const i3 = i * 3;
      const sway = Math.sin(time * 1.4 + phases[i]) * driftsX[i];
      const bob = Math.cos(time * 1.1 + phases[i] * 1.3) * driftsZ[i];

      positions[i3] += sway * fall * 0.55;
      positions[i3 + 1] -= speeds[i] * fall;
      positions[i3 + 2] += bob * fall * 0.45;

      if (positions[i3 + 1] < FLOOR) {
        placeFlake(i, false);
      }
    }

    positionAttr.needsUpdate = true;
    mesh.position.set(origin.x, 0, origin.z);
  }

  return { mesh, material, update };
}

/**
 * City rain that clears into soft mountain snow near the Cascades backdrop.
 */
export function createRainfall() {
  const rain = createRainSystem();
  const snow = createSnowSystem();

  const group = new THREE.Group();
  group.name = "precipitation";
  group.add(rain.mesh, snow.mesh);

  function update(dt, center) {
    const blend = mountainSnowBlend(center.x, center.z);
    const rainAmount = 1 - blend;
    const snowAmount = blend;

    rain.update(dt, center);
    snow.update(dt, center);

    rain.material.opacity = 0.32 * rainAmount;
    rain.mesh.visible = rainAmount > 0.04;

    snow.material.opacity = 0.72 * snowAmount;
    snow.material.size = FLAKE_SIZE * (0.85 + snowAmount * 0.45);
    snow.mesh.visible = snowAmount > 0.04;
  }

  return { mesh: group, update, mountainSnowBlend };
}
