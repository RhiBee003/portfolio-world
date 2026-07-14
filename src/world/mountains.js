import * as THREE from "three";

/**
 * Cascades-ish ridgeline past the start overpass (+Z).
 * Layered meshes tint toward the city fog so they read as landscape, not hard geometry.
 */

function hash2(x, z) {
  return THREE.MathUtils.euclideanModulo(Math.sin(x * 127.1 + z * 311.7) * 43758.5453, 1);
}

function ridgeHeight(x, z, opts) {
  const {
    peakH,
    ridgeZ,
    ridgeHalfDepth,
    centerX = 0,
    halfWidth,
    detail = 1,
  } = opts;

  const along = (x - centerX) / halfWidth;
  const across = (z - ridgeZ) / ridgeHalfDepth;
  if (Math.abs(along) > 1.05 || across < -0.15 || across > 1.15) return 0;

  const envelope =
    (1 - along * along) *
    (1 - THREE.MathUtils.smoothstep(0.55, 1.05, Math.abs(across - 0.35)));

  const n1 = Math.sin(along * Math.PI * 1.6 + 0.4) * 0.55;
  const n2 = Math.sin(along * Math.PI * 3.4 - 1.2) * 0.28;
  const n3 = Math.sin(along * Math.PI * 7.1 + z * 0.08) * 0.12 * detail;
  const bumps = 0.55 + 0.45 * (0.5 + 0.5 * (n1 + n2 + n3));
  const noise = 0.85 + 0.15 * hash2(Math.floor(x * 0.2), Math.floor(z * 0.2));

  return Math.max(0, peakH * envelope * bumps * noise);
}

function createRidgeMesh(opts) {
  const {
    width,
    depth,
    segsX,
    segsZ,
    centerX,
    centerZ,
    peakH,
    ridgeZ,
    ridgeHalfDepth,
    halfWidth,
    detail,
    color,
    fogged = true,
  } = opts;

  const geo = new THREE.PlaneGeometry(width, depth, segsX, segsZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  const snow = new THREE.Color(0xe8e4ea);
  const foothill = new THREE.Color(0x6a6e68);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const wx = centerX + lx;
    const wz = centerZ + lz;
    const h = ridgeHeight(wx, wz, {
      peakH,
      ridgeZ,
      ridgeHalfDepth,
      centerX,
      halfWidth,
      detail,
    });
    pos.setY(i, h);

    const snowMix = THREE.MathUtils.smoothstep(peakH * 0.62, peakH * 0.92, h);
    const footMix = 1 - THREE.MathUtils.smoothstep(2, peakH * 0.35, h);
    tmp.copy(base).lerp(foothill, footMix * 0.55).lerp(snow, snowMix);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  pos.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: false,
    fog: fogged,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(centerX, 0, centerZ);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function createPineSilhouette(x, z, h, tint) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.14, h * 0.22, 5),
    new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 1, fog: true })
  );
  trunk.position.set(x, h * 0.11, z);

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(h * 0.22, h * 0.85, 6),
    new THREE.MeshStandardMaterial({ color: tint, roughness: 0.95, fog: true })
  );
  canopy.position.set(x, h * 0.55, z);

  const g = new THREE.Group();
  g.add(trunk, canopy);
  return g;
}

export function createMountainLandscape() {
  const root = new THREE.Group();
  root.name = "mountain-landscape";

  // Near foothills just past the overpass / north map edge.
  root.add(
    createRidgeMesh({
      width: 150,
      depth: 36,
      segsX: 72,
      segsZ: 18,
      centerX: -4,
      centerZ: 46,
      peakH: 22,
      ridgeZ: 44,
      ridgeHalfDepth: 16,
      halfWidth: 68,
      detail: 1.15,
      color: 0x7a8478,
    })
  );

  // Mid Cascades band.
  root.add(
    createRidgeMesh({
      width: 190,
      depth: 52,
      segsX: 80,
      segsZ: 22,
      centerX: 2,
      centerZ: 72,
      peakH: 48,
      ridgeZ: 70,
      ridgeHalfDepth: 24,
      halfWidth: 88,
      detail: 1.35,
      color: 0x6d7682,
    })
  );

  // Far colder peaks — soft into fog.
  root.add(
    createRidgeMesh({
      width: 220,
      depth: 64,
      segsX: 64,
      segsZ: 18,
      centerX: -6,
      centerZ: 108,
      peakH: 78,
      ridgeZ: 104,
      ridgeHalfDepth: 30,
      halfWidth: 100,
      detail: 1.5,
      color: 0x8a8492,
      fogged: true,
    })
  );

  // Sparse pine band on the near foothills.
  const pineTint = 0x4a5648;
  for (let i = 0; i < 28; i += 1) {
    const t = i / 27;
    const x = -52 + t * 108 + (hash2(i, 3) - 0.5) * 6;
    const z = 34 + hash2(i, 9) * 10;
    const h = 3.2 + hash2(i, 17) * 4.5;
    const tree = createPineSilhouette(x, z, h, pineTint);
    root.add(tree);
  }

  return root;
}
