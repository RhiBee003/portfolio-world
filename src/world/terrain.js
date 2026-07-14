import * as THREE from "three";

/**
 * Seattle-style grade: flat bowl at the start, then a clear climb from mid-city
 * toward the south end. Shared by city ground, buildings, and the light-rail line.
 * Buildings stay world-upright (no pitch/roll).
 */
export function worldHeight(x, z) {
  // Path runs z: 27 → -136. Climb begins after leaving the start, steepens mid-route.
  const along = THREE.MathUtils.clamp((-z - 12) / 95, 0, 1);
  // Ease-in then keep rising — reads as a real hill, not a soft ripple.
  const rise = along * along * (2.2 - 1.2 * along);

  // Crown around mid/late city so the grade isn't only at the fountain.
  const midBump = Math.exp(-((z + 72) ** 2) / (48 * 48)) * 0.35;

  let h = (rise * 0.88 + midBump) * 38;

  // Mild falloff far west so the needle plaza doesn't lift as high.
  const west = 1 - THREE.MathUtils.smoothstep(-40, -26, x);
  h *= 1 - west * 0.22;

  return h;
}

/** Surface for walking paths / ribbons sitting just above grade. */
export function pathSurfaceY(x, z, lift = 0.02) {
  return worldHeight(x, z) + lift;
}

/**
 * Y for an upright building base on the hill: lowest footprint corner, then
 * sink slightly so walls punch through the grade instead of floating above it.
 */
export function buildingGroundY(x, z, w, d, rotY = 0, sink = 0.55) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const hx = w * 0.5;
  const hz = d * 0.5;
  let minY = Infinity;
  for (const [lx, lz] of [
    [hx, hz],
    [-hx, hz],
    [hx, -hz],
    [-hx, -hz],
  ]) {
    const wx = x + lx * cos - lz * sin;
    const wz = z + lx * sin + lz * cos;
    minY = Math.min(minY, worldHeight(wx, wz));
  }
  return minY - sink;
}
