import * as THREE from "three";
import { pathSurfaceY } from "./terrain.js";

function createArrowShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.42);
  shape.lineTo(0.34, 0);
  shape.lineTo(0.12, 0);
  shape.lineTo(0.12, -0.36);
  shape.lineTo(-0.12, -0.36);
  shape.lineTo(-0.12, 0);
  shape.lineTo(-0.34, 0);
  shape.closePath();
  return shape;
}

const arrowGeo = new THREE.ShapeGeometry(createArrowShape());

const ARROW_DIM = new THREE.Color(0x6a1f42);
const ARROW_BRIGHT = new THREE.Color(0xad3568);
export const ARROW_DIM_HEX = "#6a1f42";
export const ARROW_BRIGHT_HEX = "#ad3568";
const ARROW_WAVE_SPEED = 1.6;
const _arrowColor = new THREE.Color();

function createArrowMaterial() {
  return new THREE.MeshBasicMaterial({
    color: ARROW_DIM.clone(),
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}

function arrowWaveBrightness(index, progress) {
  const dist = progress - index;
  if (dist < 0 || dist >= 1) return 0;
  const t = 1 - dist;
  return t * t * (3 - 2 * t);
}

export function createPathArrows(curve) {
  const group = new THREE.Group();
  const step = 8;
  const length = curve.getLength();
  const count = Math.floor(length / step);
  let arrowIndex = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);

    // Sample nearby path height so arrows pitch with the grade.
    const dt = 0.012;
    const t0 = THREE.MathUtils.clamp(t - dt, 0, 1);
    const t1 = THREE.MathUtils.clamp(t + dt, 0, 1);
    a.copy(curve.getPointAt(t0));
    b.copy(curve.getPointAt(t1));
    a.y = pathSurfaceY(a.x, a.z);
    b.y = pathSurfaceY(b.x, b.z);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const horiz = Math.hypot(dx, dz) || 1e-6;
    const gradePitch = Math.atan2(dy, horiz);

    const arrow = new THREE.Mesh(arrowGeo, createArrowMaterial());
    arrow.rotation.order = "YXZ";
    // Flat on path (-PI/2), then tip follows the hill (+gradePitch; tip faces +tangent).
    arrow.rotation.set(-Math.PI / 2 + gradePitch, yaw + Math.PI, 0);
    arrow.position.set(center.x, pathSurfaceY(center.x, center.z) + 0.09, center.z);
    arrow.scale.set(1.55, 1.55, 1);
    arrow.renderOrder = 2;
    arrow.frustumCulled = false;
    arrow.userData.index = arrowIndex;
    arrowIndex += 1;

    group.add(arrow);
  }

  group.userData.arrowCount = arrowIndex;
  return group;
}

export function animatePathArrows(group, elapsed) {
  if (!group || group.userData.arrowCount < 1) return;

  const progress = (elapsed * ARROW_WAVE_SPEED) % group.userData.arrowCount;

  group.children.forEach((arrow) => {
    const brightness = arrowWaveBrightness(arrow.userData.index ?? 0, progress);
    const mat = arrow.material;
    _arrowColor.copy(ARROW_DIM).lerp(ARROW_BRIGHT, brightness);
    mat.color.copy(_arrowColor);
    mat.opacity = 0.42 + brightness * 0.58;
  });
}
