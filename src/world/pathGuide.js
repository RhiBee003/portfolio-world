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

export function createPathArrows(curve) {
  const group = new THREE.Group();
  const step = 4.6;
  const length = curve.getLength();
  const count = Math.floor(length / step);

  const pink = new THREE.MeshStandardMaterial({
    color: 0xf8a8c4,
    emissive: 0xffc0d8,
    emissiveIntensity: 0.32,
    roughness: 0.55,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);

    const arrow = new THREE.Mesh(arrowGeo, pink);
    arrow.rotation.order = "YXZ";
    arrow.rotation.set(-Math.PI / 2, yaw + Math.PI, 0);
    arrow.position.set(center.x, 0.05, center.z);
    arrow.scale.set(1.2, 1.2, 1);
    arrow.receiveShadow = true;
    arrow.frustumCulled = false;

    group.add(arrow);
  }

  return group;
}

export function animatePathArrows() {
  // Static arrows — no pulse animation.
}
