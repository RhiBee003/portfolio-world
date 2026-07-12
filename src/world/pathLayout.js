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
