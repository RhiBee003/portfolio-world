import * as THREE from "three";

export function pathNormalAt(curve, t) {
  const tangent = curve.getTangentAt(t).normalize();
  return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
}

export function pathCenterAt(curve, t) {
  const p = curve.getPointAt(t);
  return { x: p.x, z: p.z };
}

export function pathSideAt(curve, t, side = 1, offset = 6) {
  const center = curve.getPointAt(t);
  const normal = pathNormalAt(curve, t);
  return {
    x: center.x + normal.x * side * offset,
    z: center.z + normal.z * side * offset,
  };
}

/** Nearest path parameter t for a world XZ position (sampled). */
export function closestPathT(curve, x, z, samples = 140) {
  let bestT = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const dx = p.x - x;
    const dz = p.z - z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestT = t;
    }
  }
  return bestT;
}
