import * as THREE from "three";
import { worldHeight } from "./terrain.js";

const DROP_COUNT = 2200;
const FLAKE_COUNT = 2600;
const AREA = 32;
const CEILING = 14;
const FLOOR = -0.3;
const RAIN_STREAK = 0.55;

/**
 * 0 = full city rain, 1 = mountain snow.
 * Snow near the Cascades (+Z / overpass) and on the raised city hill.
 */
export function mountainSnowBlend(x, z) {
  const nearMountains = THREE.MathUtils.smoothstep(-30, 10, z);
  const onHill = THREE.MathUtils.smoothstep(5, 18, worldHeight(x, z));
  return THREE.MathUtils.clamp(Math.max(nearMountains, onHill), 0, 1);
}

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
    positions[i6 + 4] = y - RAIN_STREAK;
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
      positions[i6 + 4] = positions[i6 + 1] - RAIN_STREAK;
      positions[i6 + 5] = positions[i6 + 2] + 0.02;

      if (positions[i6 + 1] < FLOOR) {
        placeDrop(i, false);
      }
    }

    positionAttr.needsUpdate = true;
    // Keep rain around the camera eye, not buried under hillside grade.
    mesh.position.set(origin.x, origin.y, origin.z);
  }

  return { mesh, material, update };
}

function createFlakeTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,244,250,0.95)");
  g.addColorStop(1, "rgba(255,244,250,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
    positions[i3 + 1] = randomizeY ? Math.random() * CEILING : CEILING + Math.random() * 3;
    positions[i3 + 2] = (Math.random() - 0.5) * AREA * 2;
    speeds[index] = 0.7 + Math.random() * 1.4;
    driftsX[index] = 0.5 + Math.random() * 1.3;
    driftsZ[index] = 0.4 + Math.random() * 1.1;
    phases[index] = Math.random() * Math.PI * 2;
  }

  for (let i = 0; i < FLAKE_COUNT; i += 1) {
    placeFlake(i, true);
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttr);

  // Pixel-sized flakes — always readable on retina/mobile regardless of distance.
  const material = new THREE.PointsMaterial({
    map: createFlakeTexture(),
    color: 0xffffff,
    size: 8,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Points(geometry, material);
  mesh.name = "snowfall";
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  mesh.visible = false;

  const origin = new THREE.Vector3();
  let time = 0;

  function update(dt, center) {
    origin.copy(center);
    time += dt;
    const fall = Math.min(dt, 0.05);

    for (let i = 0; i < FLAKE_COUNT; i += 1) {
      const i3 = i * 3;
      const sway = Math.sin(time * 1.5 + phases[i]) * driftsX[i];
      const bob = Math.cos(time * 1.15 + phases[i] * 1.4) * driftsZ[i];

      positions[i3] += sway * fall * 0.6;
      positions[i3 + 1] -= speeds[i] * fall;
      positions[i3 + 2] += bob * fall * 0.5;

      if (positions[i3 + 1] < FLOOR) {
        placeFlake(i, false);
      }
    }

    positionAttr.needsUpdate = true;
    // Follow the cat so flakes fill the camera frustum on the hillside.
    mesh.position.set(origin.x, origin.y + 1.2, origin.z);
  }

  return { mesh, material, update };
}

/**
 * City rain that clears into bright mountain snow near the Cascades / high grade.
 */
export function createRainfall() {
  const rain = createRainSystem();
  const snow = createSnowSystem();

  const group = new THREE.Group();
  group.name = "precipitation";
  group.add(rain.mesh, snow.mesh);

  function update(dt, center) {
    const blend = mountainSnowBlend(center.x, center.z);
    const rainAmount = Math.max(0, 1 - blend * 1.15);
    const snowAmount = blend;

    rain.update(dt, center);
    snow.update(dt, center);

    rain.material.opacity = 0.32 * rainAmount;
    rain.mesh.visible = rainAmount > 0.06;

    snow.material.opacity = 0.92 * snowAmount;
    snow.material.size = 6 + snowAmount * 6;
    snow.mesh.visible = snowAmount > 0.04;
  }

  return { mesh: group, update, mountainSnowBlend };
}
