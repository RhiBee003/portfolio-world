import * as THREE from "three";

/** Real Space Needle: 605 ft tall, 138 ft wide saucer, deck at 520 ft. */
const HEIGHT = 52;
const SAUCER_DIAMETER = (138 / 605) * HEIGHT;
const SAUCER_RADIUS = SAUCER_DIAMETER / 2;
const DECK_HEIGHT = (520 / 605) * HEIGHT;
const FOUNDATION_DIAMETER = (120 / 605) * HEIGHT;
const LEG_HEIGHT = HEIGHT * 0.335;
const WAIST_HEIGHT = HEIGHT * 0.5;
const SHAFT_TOP_HEIGHT = DECK_HEIGHT - 1.35;

const ASTRONAUT_WHITE = 0xf4f2ee;
const LEG_WHITE = 0xeeede8;
const WINDOW_GLASS = 0x1a2433;
const CONCRETE = 0xada8a0;

function needleMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.62,
    metalness: options.metalness ?? 0.1,
    flatShading: false,
  });
}

function createTripodLeg(angle) {
  const leg = new THREE.Group();
  leg.rotation.y = angle;

  const outerX = FOUNDATION_DIAMETER * 0.46;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, LEG_HEIGHT, 3.65),
    needleMaterial(LEG_WHITE, { roughness: 0.7 })
  );
  mesh.position.set(outerX, LEG_HEIGHT * 0.5, 0);
  mesh.rotation.z = -0.24;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  leg.add(mesh);

  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(2.05, 0.55, 4.15),
    needleMaterial(CONCRETE, { roughness: 0.92, metalness: 0 })
  );
  foot.position.set(outerX + 0.15, 0.28, 0);
  foot.rotation.z = -0.12;
  foot.castShadow = true;
  foot.receiveShadow = true;
  leg.add(foot);

  return leg;
}

function createStem() {
  const stem = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 2.15, LEG_HEIGHT, 20),
    needleMaterial(ASTRONAUT_WHITE)
  );
  core.position.y = LEG_HEIGHT * 0.5;
  core.castShadow = true;
  core.receiveShadow = true;
  stem.add(core);

  const lowerFlare = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 2.05, WAIST_HEIGHT - LEG_HEIGHT, 20),
    needleMaterial(ASTRONAUT_WHITE)
  );
  lowerFlare.position.y = LEG_HEIGHT + (WAIST_HEIGHT - LEG_HEIGHT) * 0.5;
  lowerFlare.castShadow = true;
  stem.add(lowerFlare);

  const waist = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.35, HEIGHT * 0.11, 18),
    needleMaterial(ASTRONAUT_WHITE)
  );
  waist.position.y = WAIST_HEIGHT + HEIGHT * 0.055;
  waist.castShadow = true;
  stem.add(waist);

  const upperFlare = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 0.95, SHAFT_TOP_HEIGHT - WAIST_HEIGHT - HEIGHT * 0.11, 18),
    needleMaterial(ASTRONAUT_WHITE)
  );
  upperFlare.position.y = (WAIST_HEIGHT + HEIGHT * 0.11 + SHAFT_TOP_HEIGHT) * 0.5;
  upperFlare.castShadow = true;
  stem.add(upperFlare);

  return stem;
}

function createSaucer() {
  const saucer = new THREE.Group();

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 0.98, SAUCER_RADIUS * 1.02, 0.95, 40),
    needleMaterial(ASTRONAUT_WHITE)
  );
  skirt.position.y = DECK_HEIGHT - 0.42;
  skirt.castShadow = true;
  saucer.add(skirt);

  const windowBand = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 1.005, SAUCER_RADIUS * 0.99, 0.72, 40, 1, true),
    new THREE.MeshStandardMaterial({
      color: WINDOW_GLASS,
      emissive: 0x0a1420,
      emissiveIntensity: 0.18,
      roughness: 0.25,
      metalness: 0.35,
      side: THREE.DoubleSide,
    })
  );
  windowBand.position.y = DECK_HEIGHT + 0.02;
  saucer.add(windowBand);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 0.9, SAUCER_RADIUS * 0.98, 1.35, 40),
    needleMaterial(ASTRONAUT_WHITE)
  );
  body.position.y = DECK_HEIGHT + 0.72;
  body.castShadow = true;
  saucer.add(body);

  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 0.72, SAUCER_RADIUS * 0.88, 0.42, 32),
    needleMaterial(ASTRONAUT_WHITE)
  );
  roof.position.y = DECK_HEIGHT + 1.55;
  roof.castShadow = true;
  saucer.add(roof);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.85, 1.15, 20),
    needleMaterial(ASTRONAUT_WHITE)
  );
  crown.position.y = DECK_HEIGHT + 2.2;
  crown.castShadow = true;
  saucer.add(crown);

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.85, 0.55, 16),
    needleMaterial(0xfff8ee, { metalness: 0.2 })
  );
  beacon.position.y = DECK_HEIGHT + 2.95;
  saucer.add(beacon);

  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.22, HEIGHT - DECK_HEIGHT - 3.1, 10),
    needleMaterial(ASTRONAUT_WHITE, { metalness: 0.16 })
  );
  spire.position.y = DECK_HEIGHT + 3.1 + (HEIGHT - DECK_HEIGHT - 3.1) * 0.5;
  spire.castShadow = true;
  saucer.add(spire);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.55, 10),
    needleMaterial(ASTRONAUT_WHITE, { metalness: 0.22 })
  );
  tip.position.y = HEIGHT - 0.28;
  saucer.add(tip);

  return saucer;
}

export function createSpaceNeedle() {
  const needle = new THREE.Group();
  needle.name = "space-needle";

  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(FOUNDATION_DIAMETER * 0.5, FOUNDATION_DIAMETER * 0.54, 0.75, 28),
    needleMaterial(CONCRETE, { roughness: 0.94, metalness: 0 })
  );
  foundation.position.y = 0.38;
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  needle.add(foundation);

  for (let i = 0; i < 3; i += 1) {
    needle.add(createTripodLeg((i * Math.PI * 2) / 3));
  }

  needle.add(createStem());
  needle.add(createSaucer());

  needle.frustumCulled = false;
  return needle;
}

/** West skyline beside the path — visible from the start and About stop. */
export const SPACE_NEEDLE_POSITION = { x: -36, y: 0, z: 6 };

export function addSpaceNeedleToScene(scene, collisions = []) {
  const needle = createSpaceNeedle();
  needle.position.set(SPACE_NEEDLE_POSITION.x, SPACE_NEEDLE_POSITION.y, SPACE_NEEDLE_POSITION.z);
  scene.add(needle);

  collisions.push({
    cx: SPACE_NEEDLE_POSITION.x,
    cz: SPACE_NEEDLE_POSITION.z,
    hx: FOUNDATION_DIAMETER * 0.5 + 0.5,
    hz: FOUNDATION_DIAMETER * 0.5 + 0.5,
    cos: 1,
    sin: 0,
    minY: 0,
    maxY: HEIGHT + 2,
  });

  return needle;
}
