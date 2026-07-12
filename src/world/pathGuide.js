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
  const step = 2.8;
  const length = curve.getLength();
  const count = Math.floor(length / step);

  const pink = new THREE.MeshStandardMaterial({
    color: 0xf6c8d7,
    emissive: 0xe8a4bc,
    emissiveIntensity: 0.28,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const pinkDark = new THREE.MeshStandardMaterial({
    color: 0xe8a4bc,
    emissive: 0xc97a96,
    emissiveIntensity: 0.22,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);

    const arrow = new THREE.Mesh(arrowGeo, i % 2 === 0 ? pink : pinkDark);
    arrow.rotation.order = "YXZ";
    arrow.rotation.set(-Math.PI / 2, yaw + Math.PI, 0);
    arrow.position.set(center.x, 0.028, center.z);
    arrow.scale.set(1.15, 1.15, 1);
    arrow.receiveShadow = true;
    arrow.frustumCulled = false;
    arrow.userData.phase = i * 0.55;

    group.add(arrow);
  }

  return group;
}

export function animatePathArrows(group, elapsed) {
  group.children.forEach((arrow) => {
    const pulse = 0.92 + Math.sin(elapsed * 2.4 + arrow.userData.phase) * 0.08;
    arrow.scale.set(1.15 * pulse, 1.15 * pulse, 1);
    arrow.material.emissiveIntensity =
      0.18 + Math.sin(elapsed * 2.4 + arrow.userData.phase) * 0.12;
  });
}
