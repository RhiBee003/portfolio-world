import * as THREE from "three";
import { worldHeight } from "./terrain.js";

const DROP_COUNT = 2200;
const FLAKE_COUNT = 2800;
const AREA = 36;
const CEILING = 16;
const FLOOR = -0.5;
const RAIN_STREAK = 0.55;
const SNOW_STREAK = 0.18;

/**
 * 0 = full city rain, 1 = mountain snow.
 * Strong near the Cascades backdrop / overpass (+Z).
 */
export function mountainSnowBlend(x, z) {
  // Fully snowy by the overpass; rain returns as you head south into the city.
  const towardPeaks = THREE.MathUtils.smoothstep(-8, 18, z);
  const elev = THREE.MathUtils.smoothstep(2, 16, worldHeight(x, z));
  return THREE.MathUtils.clamp(towardPeaks * 1.05 + elev * 0.4, 0, 1);
}

function createStreakSystem({
  count,
  name,
  color,
  opacity,
  streak,
  placeSpeed,
  placeDrift,
  fallMultiplier,
  driftStyle,
  useFog,
}) {
  const positions = new Float32Array(count * 6);
  const speeds = new Float32Array(count);
  const drifts = new Float32Array(count);
  const phases = new Float32Array(count);

  function place(index, randomizeY) {
    const i6 = index * 6;
    const x = (Math.random() - 0.5) * AREA * 2;
    const z = (Math.random() - 0.5) * AREA * 2;
    const y = randomizeY ? Math.random() * CEILING : CEILING + Math.random() * 4;
    positions[i6] = x;
    positions[i6 + 1] = y;
    positions[i6 + 2] = z;
    positions[i6 + 3] = x + (driftStyle === "snow" ? (Math.random() - 0.5) * 0.12 : -0.04);
    positions[i6 + 4] = y - streak;
    positions[i6 + 5] = z + (driftStyle === "snow" ? (Math.random() - 0.5) * 0.12 : 0.02);
    speeds[index] = placeSpeed();
    drifts[index] = placeDrift();
    phases[index] = Math.random() * Math.PI * 2;
  }

  for (let i = 0; i < count; i += 1) {
    place(i, true);
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttr);

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: useFog,
    toneMapped: false,
  });

  const mesh = new THREE.LineSegments(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = driftStyle === "snow" ? 5 : 4;
  mesh.visible = opacity > 0.02;

  const origin = new THREE.Vector3();
  let time = 0;

  function update(dt, center) {
    origin.copy(center);
    time += dt;
    const fall = Math.min(dt, 0.05);

    for (let i = 0; i < count; i += 1) {
      const i6 = i * 6;
      const dy = speeds[i] * fall * fallMultiplier;
      const dx = drifts[i] * fall;

      if (driftStyle === "snow") {
        const sway = Math.sin(time * 1.6 + phases[i]) * drifts[i];
        positions[i6] += sway * fall * 0.7;
        positions[i6 + 1] -= dy;
        positions[i6 + 2] += Math.cos(time * 1.2 + phases[i]) * drifts[i] * fall * 0.55;
        positions[i6 + 3] = positions[i6] + Math.sin(phases[i]) * 0.08;
        positions[i6 + 4] = positions[i6 + 1] - streak;
        positions[i6 + 5] = positions[i6 + 2] + Math.cos(phases[i]) * 0.08;
      } else {
        positions[i6] -= dx * 0.35;
        positions[i6 + 1] -= dy;
        positions[i6 + 2] += dx * 0.12;
        positions[i6 + 3] = positions[i6] - 0.04;
        positions[i6 + 4] = positions[i6 + 1] - streak;
        positions[i6 + 5] = positions[i6 + 2] + 0.02;
      }

      if (positions[i6 + 1] < FLOOR) {
        place(i, false);
      }
    }

    positionAttr.needsUpdate = true;
    mesh.position.set(origin.x, worldHeight(origin.x, origin.z), origin.z);
  }

  return { mesh, material, update };
}

/**
 * City rain that clears into visible mountain snow near the Cascades backdrop.
 * Snow uses LineSegments (same as rain) so it reliably renders on mobile/desktop.
 */
export function createRainfall() {
  const rain = createStreakSystem({
    count: DROP_COUNT,
    name: "rainfall",
    color: 0xc5d2de,
    opacity: 0.32,
    streak: RAIN_STREAK,
    placeSpeed: () => 11 + Math.random() * 10,
    placeDrift: () => 0.35 + Math.random() * 0.55,
    fallMultiplier: 1,
    driftStyle: "rain",
    useFog: true,
  });

  const snow = createStreakSystem({
    count: FLAKE_COUNT,
    name: "snowfall",
    color: 0xffffff,
    opacity: 0,
    streak: SNOW_STREAK,
    placeSpeed: () => 1.2 + Math.random() * 1.8,
    placeDrift: () => 0.6 + Math.random() * 1.2,
    fallMultiplier: 1,
    driftStyle: "snow",
    useFog: false,
  });

  const group = new THREE.Group();
  group.name = "precipitation";
  group.add(rain.mesh, snow.mesh);

  function update(dt, center) {
    const blend = mountainSnowBlend(center.x, center.z);
    const rainAmount = Math.max(0, 1 - blend * 1.2);
    const snowAmount = THREE.MathUtils.smoothstep(0.05, 0.55, blend);

    rain.update(dt, center);
    snow.update(dt, center);

    rain.material.opacity = 0.32 * rainAmount;
    rain.mesh.visible = rainAmount > 0.04;

    snow.material.opacity = 0.85 * snowAmount;
    snow.mesh.visible = snowAmount > 0.02;
  }

  return { mesh: group, update, mountainSnowBlend };
}
