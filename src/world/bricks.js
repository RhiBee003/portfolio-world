import * as THREE from "three";
import { brickMaterial } from "./materials.js";

const BRICK_W = 0.42;
const BRICK_H = 0.2;
const BRICK_D = 0.28;
const BRICK_GAP = 0.04;

const brickGeo = new THREE.BoxGeometry(BRICK_W, BRICK_H, BRICK_D);

/** 5-wide pixel font rows as strings (# = brick) */
const GLYPHS = {
  R: ["###", "# #", "## ", "# #", "# #"],
  H: ["# #", "# #", "###", "# #", "# #"],
  I: ["###", " # ", " # ", " # ", "###"],
  A: [" # ", "# #", "###", "# #", "# #"],
  N: ["# #", "## ", "# #", "# #", "# #"],
  O: ["###", "# #", "# #", "# #", "###"],
  B: ["## ", "# #", "## ", "# #", "## "],
  L: ["#  ", "#  ", "#  ", "#  ", "###"],
  K: ["# #", "# #", "## ", "# #", "# #"],
};

export function createBrickLetters(text, options = {}) {
  const group = new THREE.Group();
  const pink = options.color ?? 0xe8a4bc;
  const pinkDark = options.darkColor ?? 0xc97a96;
  const pinkLight = options.lightColor ?? 0xf6c8d7;

  const letters = text.toUpperCase().split("");
  const letterSpacing = 3.2;
  const startX = -((letters.length - 1) * letterSpacing) / 2;

  letters.forEach((char, letterIndex) => {
    const rows = GLYPHS[char];
    if (!rows) return;

    const letterGroup = new THREE.Group();
    const rowCount = rows.length;
    const colCount = 5;

    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < colCount; col += 1) {
        if (rows[row][col] !== "#") continue;

        const brick = new THREE.Mesh(brickGeo, brickMaterial(pink));
        brick.castShadow = true;
        brick.receiveShadow = true;
        brick.frustumCulled = false;

        const x = (col - colCount / 2 + 0.5) * (BRICK_W + BRICK_GAP);
        const y = (rowCount / 2 - row - 0.5) * (BRICK_H + BRICK_GAP);
        const z = (Math.random() - 0.5) * 0.06;
        brick.position.set(x, y, z);

        // Slight color variation for depth
        const tone = (row + col + letterIndex) % 3;
        brick.material = brickMaterial(
          tone === 0 ? pink : tone === 1 ? pinkDark : pinkLight
        );

        letterGroup.add(brick);
      }
    }

    letterGroup.position.x = startX + letterIndex * letterSpacing;
    group.add(letterGroup);
  });

  group.position.set(options.x ?? 0, options.y ?? 2.8, options.z ?? 8);
  return group;
}

export function createBrickPath(curve, collisions) {
  const group = new THREE.Group();
  const pathBricks = [];
  const pathWidth = 2.8;
  const step = 0.55;
  const length = curve.getLength();
  const count = Math.floor(length / step);

  const mortar = brickMaterial(0xd8d0d4, { roughness: 0.92 });
  const brickA = brickMaterial(0xb85c6e);
  const brickB = brickMaterial(0xc97a96);
  const brickC = brickMaterial(0xa84860);

  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const rows = 3;
    for (let row = -rows; row <= rows; row += 1) {
      const offset = normal.clone().multiplyScalar(row * 0.48);
      const pos = center.clone().add(offset);
      pos.y = BRICK_H / 2;

      const brick = new THREE.Mesh(brickGeo, i % 3 === 0 ? brickA : i % 3 === 1 ? brickB : brickC);
      brick.castShadow = true;
      brick.receiveShadow = true;
      brick.frustumCulled = false;
      brick.position.copy(pos);
      brick.rotation.y = Math.atan2(tangent.x, tangent.z);

      if (row === 0 && i % 4 === 0) {
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(BRICK_W * 0.9, BRICK_H * 0.15, BRICK_D * 0.9),
          mortar
        );
        cap.position.copy(pos);
        cap.position.y += BRICK_H * 0.55;
        cap.rotation.y = brick.rotation.y;
        group.add(cap);
      }

      group.add(brick);
      pathBricks.push({ x: pos.x, z: pos.z, half: 0.35 });
    }
  }

  return { group, pathBricks };
}

export { BRICK_W, BRICK_H };
