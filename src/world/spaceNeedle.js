import * as THREE from "three";
import { createSpaceNeedleInterior } from "./spaceNeedleInterior.js";
import { SPACE_NEEDLE_POSITION } from "./spaceNeedleConfig.js";

/** Real Space Needle: 605 ft tall, 138 ft saucer, observation deck at 520 ft. */
const HEIGHT = 52;
const SAUCER_DIAMETER = (138 / 605) * HEIGHT;
const SAUCER_RADIUS = SAUCER_DIAMETER / 2;
const DECK_HEIGHT = (520 / 605) * HEIGHT;
const FOUNDATION_DIAMETER = (120 / 605) * HEIGHT;
const WAIST_HEIGHT = HEIGHT * (373 / 605);
const LEG_MERGE_HEIGHT = HEIGHT * 0.34;
const TOP_HOUSE_HEIGHT = HEIGHT * (30 / 605);

const ASTRONAUT_WHITE = 0xf3f1ec;
const LEG_WHITE = 0xeceae4;
const STEEL_GREY = 0xb8b4ae;
const WINDOW_GLASS = 0x14202e;
const CONCRETE = 0xa8a39c;
const ROOF_WHITE = 0xfaf8f4;

function needleMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0.12,
    flatShading: false,
  });
}

function glassMaterial(intensity = 0.22) {
  return new THREE.MeshStandardMaterial({
    color: WINDOW_GLASS,
    emissive: 0x0a1420,
    emissiveIntensity: intensity,
    roughness: 0.18,
    metalness: 0.42,
    side: THREE.DoubleSide,
  });
}

function createFoundation() {
  const group = new THREE.Group();

  const slab = new THREE.Mesh(
    new THREE.CylinderGeometry(FOUNDATION_DIAMETER * 0.56, FOUNDATION_DIAMETER * 0.6, 0.55, 36),
    needleMaterial(CONCRETE, { roughness: 0.94, metalness: 0 })
  );
  slab.position.y = 0.28;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(FOUNDATION_DIAMETER * 0.46, FOUNDATION_DIAMETER * 0.52, 0.42, 32),
    needleMaterial(CONCRETE, { roughness: 0.9, metalness: 0 })
  );
  pedestal.position.y = 0.76;
  pedestal.castShadow = true;
  group.add(pedestal);

  const plazaRing = new THREE.Mesh(
    new THREE.TorusGeometry(FOUNDATION_DIAMETER * 0.5, 0.09, 8, 40),
    needleMaterial(STEEL_GREY, { roughness: 0.75, metalness: 0.2 })
  );
  plazaRing.rotation.x = Math.PI / 2;
  plazaRing.position.y = 0.12;
  group.add(plazaRing);

  return group;
}

function createCurvedLeg(angle) {
  const leg = new THREE.Group();
  leg.rotation.y = angle;

  const baseSpread = FOUNDATION_DIAMETER * 0.47;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(baseSpread, 0.55, 0),
    new THREE.Vector3(baseSpread * 0.96, LEG_MERGE_HEIGHT * 0.42, 0.05),
    new THREE.Vector3(2.05, LEG_MERGE_HEIGHT, 0),
    new THREE.Vector3(1.15, WAIST_HEIGHT * 0.92, 0),
    new THREE.Vector3(1.55, DECK_HEIGHT - 2.8, 0),
  ]);

  const legTube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 28, 0.48, 10, false),
    needleMaterial(LEG_WHITE, { roughness: 0.68, metalness: 0.14 })
  );
  legTube.castShadow = true;
  legTube.receiveShadow = true;
  leg.add(legTube);

  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.42, 2.85),
    needleMaterial(STEEL_GREY, { roughness: 0.82, metalness: 0.22 })
  );
  foot.position.set(baseSpread + 0.08, 0.22, 0);
  foot.rotation.z = -0.1;
  foot.castShadow = true;
  leg.add(foot);

  const kneePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.1, 0.22),
    needleMaterial(STEEL_GREY, { metalness: 0.25 })
  );
  kneePlate.position.set(1.35, LEG_MERGE_HEIGHT * 0.72, 0);
  kneePlate.rotation.z = -0.35;
  leg.add(kneePlate);

  return leg;
}

function createLegRing(y, radius, tube) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 8, 24),
    needleMaterial(STEEL_GREY, { metalness: 0.28, roughness: 0.7 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  return ring;
}

function createHourglassCore() {
  const points = [
    new THREE.Vector2(2.05, 0.95),
    new THREE.Vector2(2.12, LEG_MERGE_HEIGHT * 0.55),
    new THREE.Vector2(1.95, LEG_MERGE_HEIGHT),
    new THREE.Vector2(1.45, WAIST_HEIGHT * 0.82),
    new THREE.Vector2(0.88, WAIST_HEIGHT),
    new THREE.Vector2(0.82, WAIST_HEIGHT + (DECK_HEIGHT - WAIST_HEIGHT) * 0.28),
    new THREE.Vector2(1.02, WAIST_HEIGHT + (DECK_HEIGHT - WAIST_HEIGHT) * 0.62),
    new THREE.Vector2(1.38, DECK_HEIGHT - 1.45),
  ];

  const core = new THREE.Mesh(
    new THREE.LatheGeometry(points, 36),
    needleMaterial(ASTRONAUT_WHITE, { metalness: 0.1 })
  );
  core.castShadow = true;
  core.receiveShadow = true;
  return core;
}

function createSaucer() {
  const saucer = new THREE.Group();
  const deckY = DECK_HEIGHT;

  const underside = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 0.94, SAUCER_RADIUS * 1.04, 1.05, 48, 1, true),
    needleMaterial(ASTRONAUT_WHITE)
  );
  underside.position.y = deckY - 0.55;
  underside.castShadow = true;
  saucer.add(underside);

  const undersideCone = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 0.55, SAUCER_RADIUS * 0.94, 0.85, 32),
    needleMaterial(ASTRONAUT_WHITE)
  );
  undersideCone.position.y = deckY - 1.35;
  saucer.add(undersideCone);

  const restaurantBand = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 0.99, SAUCER_RADIUS, 0.55, 48),
    needleMaterial(ASTRONAUT_WHITE)
  );
  restaurantBand.position.y = deckY - 0.05;
  saucer.add(restaurantBand);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(SAUCER_RADIUS * 1.02, 0.14, 10, 48),
    needleMaterial(ASTRONAUT_WHITE)
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = deckY + 0.08;
  saucer.add(halo);

  const windowBand = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 1.01, SAUCER_RADIUS * 0.97, 0.82, 48, 1, true),
    glassMaterial(0.28)
  );
  windowBand.position.y = deckY + 0.48;
  saucer.add(windowBand);

  const windowMullion = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 1.015, SAUCER_RADIUS * 1.015, 0.86, 48, 1, true),
    needleMaterial(ASTRONAUT_WHITE, { metalness: 0.18 })
  );
  windowMullion.material.transparent = true;
  windowMullion.material.opacity = 0.12;
  windowMullion.position.y = deckY + 0.48;
  saucer.add(windowMullion);

  const observationDeck = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 0.9, SAUCER_RADIUS * 0.98, 0.62, 48),
    needleMaterial(ASTRONAUT_WHITE)
  );
  observationDeck.position.y = deckY + 1.02;
  observationDeck.castShadow = true;
  saucer.add(observationDeck);

  const railing = new THREE.Mesh(
    new THREE.TorusGeometry(SAUCER_RADIUS * 0.93, 0.045, 6, 40),
    needleMaterial(STEEL_GREY, { metalness: 0.35 })
  );
  railing.rotation.x = Math.PI / 2;
  railing.position.y = deckY + 1.28;
  saucer.add(railing);

  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(SAUCER_RADIUS * 0.68, SAUCER_RADIUS * 0.86, 0.38, 36),
    needleMaterial(ROOF_WHITE)
  );
  roof.position.y = deckY + 1.52;
  saucer.add(roof);

  const roofDome = new THREE.Mesh(
    new THREE.SphereGeometry(SAUCER_RADIUS * 0.42, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
    needleMaterial(ROOF_WHITE, { roughness: 0.5 })
  );
  roofDome.position.y = deckY + 1.78;
  saucer.add(roofDome);

  const penthouse = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.75, 1.05, 20),
    needleMaterial(ASTRONAUT_WHITE)
  );
  penthouse.position.y = deckY + 2.25;
  penthouse.castShadow = true;
  saucer.add(penthouse);

  const beaconHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.78, 0.48, 16),
    needleMaterial(0xfff6ea, { metalness: 0.24 })
  );
  beaconHousing.position.y = deckY + 2.92;
  saucer.add(beaconHousing);

  const beaconRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.06, 8, 20),
    needleMaterial(0xfff0dc, { emissive: 0xffe8c8, emissiveIntensity: 0.15, metalness: 0.3 })
  );
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.y = deckY + 2.92;
  saucer.add(beaconRing);

  const spireBase = deckY + TOP_HOUSE_HEIGHT * 0.72;
  const spireHeight = HEIGHT - spireBase - 0.35;
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.2, spireHeight, 12),
    needleMaterial(ASTRONAUT_WHITE, { metalness: 0.22, roughness: 0.45 })
  );
  spire.position.y = spireBase + spireHeight * 0.5;
  spire.castShadow = true;
  saucer.add(spire);

  const aviationBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    needleMaterial(0xff4444, { emissive: 0xaa1111, emissiveIntensity: 0.35, metalness: 0.1 })
  );
  aviationBall.position.y = HEIGHT - 0.42;
  saucer.add(aviationBall);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.42, 10),
    needleMaterial(ASTRONAUT_WHITE, { metalness: 0.28 })
  );
  tip.position.y = HEIGHT - 0.16;
  saucer.add(tip);

  return saucer;
}

export function createSpaceNeedle() {
  const needle = new THREE.Group();
  needle.name = "space-needle";

  needle.add(createFoundation());

  for (let i = 0; i < 3; i += 1) {
    needle.add(createCurvedLeg((i * Math.PI * 2) / 3 + Math.PI / 6));
  }

  needle.add(createLegRing(LEG_MERGE_HEIGHT * 0.55, FOUNDATION_DIAMETER * 0.28, 0.06));
  needle.add(createHourglassCore());
  needle.add(createSaucer());

  needle.frustumCulled = false;
  return needle;
}

export {
  SPACE_NEEDLE_DECK_Y,
  SPACE_NEEDLE_OBSERVATION_Y,
  SPACE_NEEDLE_CAR_FLOOR_Y,
  SPACE_NEEDLE_POSITION,
  SPACE_NEEDLE_VISTA,
} from "./spaceNeedleConfig.js";

export function addSpaceNeedleToScene(scene, collisions = []) {
  const needle = createSpaceNeedle();
  needle.position.set(SPACE_NEEDLE_POSITION.x, SPACE_NEEDLE_POSITION.y, SPACE_NEEDLE_POSITION.z);
  scene.add(needle);

  createSpaceNeedleInterior(needle, collisions);

  return needle;
}
