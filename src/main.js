import * as THREE from "three";
import { createSunLighting, SUN_DIRECTION } from "./world/materials.js";
import { createPath } from "./world/path.js";
import { createCity, createGround, createPathCurve, checkCollision } from "./world/city.js";
import { createRoadTermini, animateFountain } from "./world/roadTermini.js";
import { createCat, CatController } from "./world/cat.js";
import { WAYPOINTS, getWaypointRingPosition, getWaypointRingRadius } from "./world/waypoints.js";
import { createZoneUI, createInput } from "./world/ui.js";
import { createPathFloatingLabels, animateFloatingText } from "./world/floatingText.js";
import { createPathArrows, animatePathArrows } from "./world/pathGuide.js";

const canvas = document.getElementById("world-canvas");
const loading = document.getElementById("loading");
const hudHint = document.getElementById("hud-hint");

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

const pathStartT = 0.03;
const pathStart = curve.getPointAt(pathStartT);
const pathStartTangent = curve.getTangentAt(pathStartT).normalize();
const pathNormal = new THREE.Vector3(-pathStartTangent.z, 0, pathStartTangent.x).normalize();
const laneOffset = 1.1;
cat.position.set(
  pathStart.x + pathNormal.x * laneOffset,
  0,
  pathStart.z + pathNormal.z * laneOffset
);
cat.facing = Math.atan2(pathStartTangent.x, pathStartTangent.z);
cat.cat.rotation.y = cat.facing;

let fpBlend = 0;
let lastZone = null;
let viewYaw = cat.facing;
let viewPitch = -0.06;

let input;
let zoneUI;

zoneUI = createZoneUI({
  onShow: () => input?.enterFreeMode(),
});

input = createInput(canvas, {
  isPanelOpen: () => zoneUI.isOpen(),
});

const orbitDistance = 10.5;
const orbitHeight = 4.8;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 250);
const overviewTarget = new THREE.Vector3();
const eyePosition = new THREE.Vector3();
const eyeLookAt = new THREE.Vector3();
const cameraScratch = new THREE.Vector3();

function checkZones() {
  let found = null;
  const zoneRadius = getWaypointRingRadius();
  const zoneRadiusSq = zoneRadius * zoneRadius;

  for (const wp of WAYPOINTS) {
    const trigger = getWaypointRingPosition(wp, curve);
    const dx = cat.position.x - trigger.x;
    const dz = cat.position.z - trigger.z;
    if (dx * dx + dz * dz < zoneRadiusSq) {
      found = wp;
      break;
    }
  }
  if (found && found.id !== lastZone) {
    zoneUI.show(found);
    lastZone = found.id;
  } else if (!found && lastZone) {
    zoneUI.hide();
    lastZone = null;
  }
}

function smoothstep(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function updateViewAngles(dt) {
  const { dx, dy } = input.consumeLook();
  const hadLook = Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001;

  viewYaw -= dx;
  viewPitch = THREE.MathUtils.clamp(viewPitch + dy, -0.52, 0.38);
  cat.viewPitch = THREE.MathUtils.lerp(cat.viewPitch, viewPitch, 1 - Math.exp(-10 * dt));

  return hadLook;
}

function updateCameraBlend(dt) {
  const wantFirstPerson = input.pointerLocked && !zoneUI.isOpen();
  const target = wantFirstPerson ? 1 : 0;
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
  const firstPerson = easedBlend > 0.28;

  catMesh.visible = easedBlend < 0.9;

  if (hudHint) {
    const panelOpen = zoneUI.isOpen();
    hudHint.classList.toggle("is-hidden", panelOpen);

    if (!panelOpen) {
      if (input.pointerLocked) {
        hudHint.textContent = "WASD move · Esc to free cursor";
      } else if (firstPerson) {
        hudHint.textContent = "WASD move · click to look";
      } else {
        hudHint.textContent = "WASD to move · click to look";
      }
    }
  }

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
  cat.update(dt, input, collisions, checkCollision, firstPerson ? "firstPerson" : "overview", viewYaw);
  checkZones();
  applyCamera();

  const elapsed = clock.elapsedTime;
  animateFloatingText(floatingText, elapsed, cat.position);
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
  loading.classList.add("is-done");
  animate();
});

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
