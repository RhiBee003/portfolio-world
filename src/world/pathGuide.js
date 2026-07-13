import * as THREE from "three";

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
const _arrowColor = new THREE.Color();

function createArrowMaterial() {
  return new THREE.MeshBasicMaterial({
    color: ARROW_DIM.clone(),
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}

export function createPathArrows(curve) {
  const group = new THREE.Group();
  const step = 8;
  const length = curve.getLength();
  const count = Math.floor(length / step);

  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);

    const arrow = new THREE.Mesh(arrowGeo, createArrowMaterial());
    arrow.rotation.order = "YXZ";
    arrow.rotation.set(-Math.PI / 2, yaw + Math.PI, 0);
    arrow.position.set(center.x, 0.09, center.z);
    arrow.scale.set(1.55, 1.55, 1);
    arrow.renderOrder = 2;
    arrow.frustumCulled = false;
    arrow.userData.phase = i * 0.62;

    group.add(arrow);
  }

  return group;
}

export function animatePathArrows(group, elapsed) {
  if (!group) return;

  group.children.forEach((arrow) => {
    const phase = arrow.userData.phase ?? 0;
    const wave = 0.5 + 0.5 * Math.sin(elapsed * 2.35 + phase);
    const mat = arrow.material;
    _arrowColor.copy(ARROW_DIM).lerp(ARROW_BRIGHT, wave);
    mat.color.copy(_arrowColor);
    mat.opacity = 0.58 + wave * 0.42;
  });
}
