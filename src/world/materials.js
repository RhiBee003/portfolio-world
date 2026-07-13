import * as THREE from "three";

/** Sun from top-left — used for all shaded materials */
export const SUN_DIRECTION = new THREE.Vector3(-0.65, 1, 0.45).normalize();

export function createSunLighting(scene) {
  const ambient = new THREE.AmbientLight(0xfff4f8, 0.38);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xf2d0df, 0x9a9aa2, 0.42);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0xffd6e8, 0.22);
  fill.position.set(30, 20, -40);
  scene.add(fill);

  return { sun, ambient, hemi, fill };
}

export function cuteEyeIrisMaterial(color = 0xe8b878) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: 0x2a2010,
    emissiveIntensity: 0.08,
    roughness: 0.2,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.14,
  });
}

export function brickMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.88,
    metalness: options.metalness ?? 0.04,
    flatShading: false,
  });
}

export function buildingMaterial(tone) {
  const colors = {
    dark: 0x2a2a2e,
    mid: 0x4a4a52,
    light: 0x6e6e78,
  };
  return new THREE.MeshStandardMaterial({
    color: colors[tone] ?? colors.mid,
    roughness: 0.82,
    metalness: 0.08,
  });
}

export function groundMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xfafafa,
    roughness: 0.95,
    metalness: 0,
  });
}
