import * as THREE from "three";
import { windowMaterialDark, windowMaterialLit } from "./materials.js";

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
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
  const litMat = windowMaterialLit();
  const darkMat = windowMaterialDark();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const u = startU + col * (winW + gapX);
      const y = startY + row * (winH + gapY);
      const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), rand() > 0.48 ? litMat : darkMat);
      windowMesh.frustumCulled = false;
      windowMesh.castShadow = false;
      windowMesh.receiveShadow = false;

      if (axis === "z") {
        windowMesh.position.set(u, y, sign * (faceDepth / 2 + inset));
        if (sign < 0) windowMesh.rotation.y = Math.PI;
      } else {
        windowMesh.position.set(sign * (faceDepth / 2 + inset), y, u);
        windowMesh.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      parent.add(windowMesh);
    }
  }
}

export function addBuildingWindows(parent, w, d, h, seed = 1) {
  if (h < 4.5 || w < 2 || d < 2) return;

  const rand = seededRandom(seed);
  addWindowFace(parent, w, d, h, "z", 1, rand);
  addWindowFace(parent, w, d, h, "z", -1, rand);
  addWindowFace(parent, d, w, h, "x", 1, rand);
  addWindowFace(parent, d, w, h, "x", -1, rand);
}
