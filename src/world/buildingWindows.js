import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { windowMaterialDark, windowMaterialLit } from "./materials.js";

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _euler = new THREE.Euler();

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function addMergedWindows(parent, geometries, material) {
  if (!geometries.length) return;
  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
}

function addWindowFace(parent, faceWidth, faceDepth, h, axis, sign, rand) {
  const winW = faceWidth > 7 ? 0.46 : 0.38;
  const winH = h > 14 ? 0.58 : 0.5;
  const gapX = 0.62;
  const gapY = 0.78;
  const inset = 0.045;

  const cols = Math.max(1, Math.floor((faceWidth - 0.8) / (winW + gapX)));
  const rows = Math.max(1, Math.floor((h - 1.4) / (winH + gapY)));
  const totalW = cols * winW + (cols - 1) * gapX;
  const startU = -totalW / 2 + winW / 2;
  const startY = -h / 2 + 1.1 + winH / 2;
  const litGeometries = [];
  const darkGeometries = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const u = startU + col * (winW + gapX);
      const y = startY + row * (winH + gapY);
      const geometry = new THREE.PlaneGeometry(winW, winH);

      if (axis === "z") {
        _position.set(u, y, sign * (faceDepth / 2 + inset));
        _euler.set(0, sign < 0 ? Math.PI : 0, 0);
      } else {
        _position.set(sign * (faceDepth / 2 + inset), y, u);
        _euler.set(0, sign > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      }

      _quaternion.setFromEuler(_euler);
      _matrix.compose(_position, _quaternion, _scale);
      geometry.applyMatrix4(_matrix);

      const scatter = rand();
      const litChance = 0.38 + ((row * 17 + col * 31) % 13) * 0.01;
      if (scatter > litChance) litGeometries.push(geometry);
      else darkGeometries.push(geometry);
    }
  }

  addMergedWindows(parent, litGeometries, windowMaterialLit());
  addMergedWindows(parent, darkGeometries, windowMaterialDark());
}

export function addBuildingWindows(parent, w, d, h, seed = 1) {
  if (h < 3.5 || w < 1.8 || d < 1.8) return;

  const rand = seededRandom(seed);
  addWindowFace(parent, w, d, h, "z", 1, rand);
  addWindowFace(parent, w, d, h, "z", -1, rand);
  addWindowFace(parent, d, w, h, "x", 1, rand);
  addWindowFace(parent, d, w, h, "x", -1, rand);
}
