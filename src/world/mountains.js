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
  const snow = new THREE.Color(0xf2e8ee);
  const foothill = new THREE.Color(0x7a7078);
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

const TITLE_FONT =
  '"SF Pro Rounded", "Nunito", "Quicksand", ui-rounded, "Segoe UI", system-ui, sans-serif';

function createMountainTitle() {
  const scale = 2;
  const nameSize = 72 * scale;
  const roleSize = 38 * scale;
  const padX = 48 * scale;
  const padY = 36 * scale;
  const name = "Rhiannon Black";
  const roles = "Developer  ·  UX Designer";

  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `700 ${nameSize}px ${TITLE_FONT}`;
  const nameW = measure.measureText(name).width;
  measure.font = `600 ${roleSize}px ${TITLE_FONT}`;
  const roleW = measure.measureText(roles).width;

  const width = Math.ceil(Math.max(nameW, roleW) + padX * 2);
  const height = Math.ceil(padY * 2 + nameSize + roleSize * 1.35);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#f7eef2";
  ctx.font = `700 ${nameSize}px ${TITLE_FONT}`;
  ctx.fillText(name, width / 2, padY + nameSize * 0.52);

  ctx.fillStyle = "#e8c4d4";
  ctx.font = `600 ${roleSize}px ${TITLE_FONT}`;
  ctx.fillText(roles, width / 2, padY + nameSize + roleSize * 0.85);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const worldWidth = 56;
  const worldHeight = worldWidth * (height / width);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth, worldHeight),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  panel.name = "mountain-title";
  // Tallest ridge crest — slightly forward so it reads against the peaks.
  panel.position.set(-4, 86, 98);
  panel.lookAt(-4, 72, 20);
  panel.renderOrder = 3;
  panel.frustumCulled = false;
  return panel;
}

function createPineSilhouette(x, z, h, tint) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.14, h * 0.22, 5),
    new THREE.MeshStandardMaterial({ color: 0x4a4248, roughness: 1, fog: true })
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
      color: 0xa898a4,
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
      color: 0x8a8290,
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
      color: 0xb8a8b4,
      fogged: true,
    })
  );

  // Sparse silhouette trees on the near foothills — mauve, not green.
  const pineTint = 0x6a6070;
  for (let i = 0; i < 28; i += 1) {
    const t = i / 27;
    const x = -52 + t * 108 + (hash2(i, 3) - 0.5) * 6;
    const z = 34 + hash2(i, 9) * 10;
    const h = 3.2 + hash2(i, 17) * 4.5;
    const tree = createPineSilhouette(x, z, h, pineTint);
    root.add(tree);
  }

  root.add(createMountainTitle());

  return root;
}
