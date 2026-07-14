import * as THREE from "three";

/** Sun from top-left — used for all shaded materials */
export const SUN_DIRECTION = new THREE.Vector3(-0.65, 1, 0.45).normalize();

export function createSunLighting(scene) {
  const ambient = new THREE.AmbientLight(0xe8d6e0, 0.48);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xd4c0cc, 0x8a9098, 0.52);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xe8e4ea, 0.62);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0xd8c4d0, 0.18);
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

const buildingMaterials = {};

export function buildingMaterial(tone) {
  if (!buildingMaterials[tone]) {
    const colors = {
      dark: 0x2a2a2e,
      mid: 0x4a4a52,
      light: 0x6e6e78,
    };
    buildingMaterials[tone] = new THREE.MeshStandardMaterial({
      color: colors[tone] ?? colors.mid,
      roughness: 0.82,
      metalness: 0.08,
    });
  }
  return buildingMaterials[tone];
}

let windowLitMaterial;
let windowDarkMaterial;

export function windowMaterialLit() {
  if (!windowLitMaterial) {
    windowLitMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff4dc,
      emissive: 0xffe8c0,
      emissiveIntensity: 0.52,
      roughness: 0.35,
      metalness: 0.06,
    });
  }
  return windowLitMaterial;
}

export function windowMaterialDark() {
  if (!windowDarkMaterial) {
    windowDarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c2230,
      emissive: 0x080c14,
      emissiveIntensity: 0.08,
      roughness: 0.45,
      metalness: 0.12,
    });
  }
  return windowDarkMaterial;
}

export function groundMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xfafafa,
    roughness: 0.95,
    metalness: 0,
  });
}
