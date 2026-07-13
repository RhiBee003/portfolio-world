import * as THREE from "three";
import { createSunLighting, SUN_DIRECTION } from "./world/materials.js";
import { createPath } from "./world/path.js";
import { createCity, createGround, createPathCurve, checkCollision } from "./world/city.js";
import { createRoadTermini, animateFountain } from "./world/roadTermini.js";
import { createCat, CatController } from "./world/cat.js";
import { WAYPOINTS, getWaypointRingPosition, getWaypointRingRadius, getWaypointRingT } from "./world/waypoints.js";
import { closestPathT } from "./world/pathLayout.js";
import { createZoneUI, createInput, createBioBar } from "./world/ui.js";
import { createPathFloatingLabels, animateFloatingText, pickFloatingLink } from "./world/floatingText.js";
import { createPathArrows, animatePathArrows } from "./world/pathGuide.js";

const canvas = document.getElementById("world-canvas");
const loading = document.getElementById("loading");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const sceneFog = new THREE.Fog(0xfafafa, 35, 120);
scene.fog = sceneFog;

const { sun } = createSunLighting(scene);

const curve = createPathCurve();
const { group: cityGroup, collisions: cityCollisions } = createCity(curve);
scene.add(cityGroup);

const { group: terminiGroup, collisions: terminiCollisions } = createRoadTermini(curve);
scene.add(terminiGroup);
const collisions = [...cityCollisions, ...terminiCollisions];

const { group: pathGroup } = createPath(curve);
scene.add(pathGroup);

const pathArrows = createPathArrows(curve);
scene.add(pathArrows);

const floatingText = createPathFloatingLabels(curve);
scene.add(floatingText);

const ground = createGround();
scene.add(ground);

const catMesh = createCat();
scene.add(catMesh);
const cat = new CatController(catMesh);

const heroWaypoint = WAYPOINTS.find((wp) => wp.id === "hero");
const spawnT = getWaypointRingT(heroWaypoint);
const spawnRing = getWaypointRingPosition(heroWaypoint, curve);
const spawnTangent = curve.getTangentAt(spawnT).normalize();

cat.position.set(spawnRing.x, 0, spawnRing.z);
const roadFacing = Math.atan2(spawnTangent.x, spawnTangent.z);
let viewYaw = roadFacing + 0.38;
cat.facing = viewYaw + Math.PI;
cat.cat.rotation.y = cat.facing;
let fpBlend = 0;
let lastZone = null;
let viewPitch = -0.14;

let input;
const zoneUI = createZoneUI();
const bioBar = createBioBar();

input = createInput(canvas, {
  onCanvasClick(e) {
    if (input.pointerLocked) return false;
    const href = pickFloatingLink(floatingText, camera, e.clientX, e.clientY, canvas);
    if (!href) return false;
    if (href.startsWith("mailto:")) {
      window.location.href = href;
    } else {
      window.open(href, "_blank", "noopener noreferrer");
    }
    return true;
  },
});

const orbitDistance = 10.5;
const orbitHeight = 4.8;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 250);
const overviewTarget = new THREE.Vector3();
const eyePosition = new THREE.Vector3();
const eyeLookAt = new THREE.Vector3();
const cameraScratch = new THREE.Vector3();

function checkZones() {
  const catPathT = closestPathT(curve, cat.position.x, cat.position.z);
  const zoneRadius = getWaypointRingRadius();
  const zoneRadiusSq = zoneRadius * zoneRadius;
  const passedThreshold = 0.07;

  let found = null;

  for (const wp of WAYPOINTS) {
    if (wp.id === "hero") continue;

    const ringT = getWaypointRingT(wp);
    if (catPathT - ringT > passedThreshold) continue;

    const trigger = getWaypointRingPosition(wp, curve);
    const dx = cat.position.x - trigger.x;
    const dz = cat.position.z - trigger.z;
    if (dx * dx + dz * dz >= zoneRadiusSq) continue;

    if (!found || wp.pathT > found.pathT) {
      found = wp;
    }
  }

  if (found) {
    if (found.id !== lastZone) {
      zoneUI.show(found);
      bioBar?.dismissForZone?.();
      lastZone = found.id;
    }
  } else if (lastZone) {
    zoneUI.hide();
    lastZone = null;
  }
}

function smoothstep(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

const KEY_LOOK_YAW = 1.75;
const KEY_LOOK_PITCH = 1.15;

function updateViewAngles(dt) {
  const { dx, dy } = input.consumeLook();

  if (input.lookLeft) viewYaw += KEY_LOOK_YAW * dt;
  if (input.lookRight) viewYaw -= KEY_LOOK_YAW * dt;
  if (input.lookUp) viewPitch = THREE.MathUtils.clamp(viewPitch - KEY_LOOK_PITCH * dt, -0.52, 0.38);
  if (input.lookDown) viewPitch = THREE.MathUtils.clamp(viewPitch + KEY_LOOK_PITCH * dt, -0.52, 0.38);

  viewYaw -= dx;
  viewPitch = THREE.MathUtils.clamp(viewPitch + dy, -0.52, 0.38);
  cat.viewPitch = THREE.MathUtils.lerp(cat.viewPitch, viewPitch, 1 - Math.exp(-10 * dt));
}

function updateCameraBlend(dt) {
  const target = input.pointerLocked ? 1 : 0;
  fpBlend = THREE.MathUtils.lerp(fpBlend, target, 1 - Math.exp(-6 * dt));
}

function getOverviewPosition(target) {
  const cosPitch = Math.cos(viewPitch);
  const behindYaw = viewYaw + Math.PI;
  const offsetX = Math.sin(behindYaw) * orbitDistance * cosPitch;
  const offsetZ = Math.cos(behindYaw) * orbitDistance * cosPitch;
  const offsetY = orbitHeight + Math.sin(viewPitch) * 2.8;

  overviewTarget.set(cat.position.x, cat.position.y + 1.15, cat.position.z);
  return target.set(
    overviewTarget.x + offsetX,
    overviewTarget.y + offsetY,
    overviewTarget.z + offsetZ
  );
}

function getOverviewLookAt(target) {
  const cosPitch = Math.cos(viewPitch * 0.55);
  return target.set(
    overviewTarget.x + Math.sin(viewYaw) * 4 * cosPitch,
    overviewTarget.y + Math.sin(viewPitch * 0.55) * 2.2,
    overviewTarget.z + Math.cos(viewYaw) * 4 * cosPitch
  );
}

function applyCamera() {
  const easedBlend = smoothstep(fpBlend);

  catMesh.visible = easedBlend < 0.9;

  cat.getEyePosition(eyePosition);
  cat.getEyeLookAt(eyeLookAt);

  getOverviewPosition(cameraScratch);
  const overviewPos = cameraScratch.clone();
  getOverviewLookAt(overviewTarget);

  camera.position.lerpVectors(overviewPos, eyePosition, easedBlend);

  const lookX = THREE.MathUtils.lerp(overviewTarget.x, eyeLookAt.x, easedBlend);
  const lookY = THREE.MathUtils.lerp(overviewTarget.y, eyeLookAt.y, easedBlend);
  const lookZ = THREE.MathUtils.lerp(overviewTarget.z, eyeLookAt.z, easedBlend);
  camera.lookAt(lookX, lookY, lookZ);

  camera.fov = THREE.MathUtils.lerp(50, 68, easedBlend);
  camera.near = THREE.MathUtils.lerp(0.1, 0.25, easedBlend);
  camera.updateProjectionMatrix();

  sceneFog.near = THREE.MathUtils.lerp(35, 55, easedBlend);
  sceneFog.far = THREE.MathUtils.lerp(120, 160, easedBlend);

  sun.position.set(
    cat.position.x + SUN_DIRECTION.x * 80,
    SUN_DIRECTION.y * 80,
    cat.position.z + SUN_DIRECTION.z * 80
  );
  sun.target.position.set(cat.position.x, 0, cat.position.z);
  sun.target.updateMatrixWorld();
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  updateViewAngles(dt);
  updateCameraBlend(dt);

  const easedBlend = smoothstep(fpBlend);
  if (easedBlend > 0.08) {
    cat.facing = lerpAngle(cat.facing, viewYaw, 1 - Math.exp(-6 * easedBlend * dt));
  }

  const firstPerson = easedBlend > 0.28;
  cat.update(dt, input, collisions, checkCollision, firstPerson ? "firstPerson" : "overview", viewYaw, curve);
  checkZones();
  applyCamera();

  const elapsed = clock.elapsedTime;
  animateFloatingText(floatingText, elapsed, cat.position, camera, dt);
  animatePathArrows(pathArrows, elapsed);
  animateFountain(terminiGroup, elapsed);

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(() => {
  applyCamera();
  renderer.render(scene, camera);
  loading.classList.add("is-done");
  bioBar?.playEntrance();
  animate();
});

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
