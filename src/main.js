import * as THREE from "three";
import { createSunLighting, SUN_DIRECTION } from "./world/materials.js";
import { createPath } from "./world/path.js";
import { createCherryBlossoms } from "./world/cherryBlossoms.js";
import { createCityAsync, createGround, createPathCurve, checkCollision } from "./world/city.js";
import { createRoadTermini, animateFountain } from "./world/roadTermini.js";
import { createCat, CatController } from "./world/cat.js";
import { WAYPOINTS, getWaypointRingPosition, getWaypointRingRadius, getWaypointRingT } from "./world/waypoints.js";
import { createZoneUI, createInput, createBioBar, createContextHint } from "./world/ui.js";
import { createPathArrows, animatePathArrows } from "./world/pathGuide.js";
import { createSky, animateSky, resizeSky } from "./world/sky.js";
import { animateSkyThankYouMessage } from "./world/skyMessage.js";
import { createLightRail, LightRailController } from "./world/lightRail.js";
import { createFootstepTrail } from "./world/footsteps.js";
import { addSpaceNeedleToScene } from "./world/spaceNeedle.js";
import {
  createSpaceNeedleElevator,
  SpaceNeedleElevatorController,
} from "./world/spaceNeedleElevator.js";
import { isInSpaceNeedleCompound, isOnStairCorridor, createWalkHeightQuery, filterNeedleCollisions } from "./world/spaceNeedleInterior.js";

const canvas = document.getElementById("world-canvas");
const loading = document.getElementById("loading");
const loadingStatus = document.getElementById("loading-status");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setClearColor(0xefc4d6);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const sceneFog = new THREE.Fog(0xefc4d6, 35, 120);
scene.fog = sceneFog;

const sky = createSky();
scene.add(sky);

const { sun } = createSunLighting(scene);

const curve = createPathCurve();
const { group: terminiGroup, collisions: terminiCollisions } = createRoadTermini(curve);
scene.add(terminiGroup);

const { group: pathGroup } = createPath(curve);
scene.add(pathGroup);

const lightRailSystem = createLightRail();
scene.add(lightRailSystem.root);
const lightRail = new LightRailController(lightRailSystem);

function getCombinedGroundY(x, z, elevatorState, inNeedle, onStairs) {
  let y = 0;
  const railY = lightRail.getWalkHeight(x, z);
  if (railY !== null) y = Math.max(y, railY);
  if (inNeedle || elevatorState.atTop || onStairs) {
    y = Math.max(y, getWalkHeight(x, z, elevatorState));
  }
  return y;
}

const pathArrows = createPathArrows(curve);
scene.add(pathArrows);

const ground = createGround();
scene.add(ground);

const catMesh = createCat();
scene.add(catMesh);
const cat = new CatController(catMesh);

const footsteps = createFootstepTrail();
scene.add(footsteps.group);

let updateCherryPetals = () => {};

let cityCollisions = [];
let collisions = [...terminiCollisions];
let spaceNeedle = null;
let spaceElevator = null;
let getWalkHeight = () => 0;
let floatingText = null;
let animateFloatingText = () => {};
let pickFloatingLink = () => null;

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

const zoneUI = createZoneUI();
const bioBar = createBioBar();
const contextHint = createContextHint();

const orbitDistance = 10.5;
const orbitHeight = 4.8;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 250);
const overviewTarget = new THREE.Vector3();
const eyePosition = new THREE.Vector3();
const eyeLookAt = new THREE.Vector3();
const cameraScratch = new THREE.Vector3();

const input = createInput(canvas, {
  onCanvasClick(e) {
    if (input.pointerLocked) return false;
    const href = floatingText
      ? pickFloatingLink(floatingText, camera, e.clientX, e.clientY, canvas)
      : null;
    if (!href) return false;
    if (href.startsWith("mailto:")) {
      window.location.href = href;
    } else {
      window.open(href, "_blank", "noopener noreferrer");
    }
    return true;
  },
});

function setLoadingStatus(text) {
  if (loadingStatus) loadingStatus.textContent = text;
}

function checkZones() {
  const zoneRadius = getWaypointRingRadius();
  const zoneRadiusSq = zoneRadius * zoneRadius;
  const zonesReady = bioBar?.isEntranceDone?.() ?? true;

  let found = null;

  for (const wp of WAYPOINTS) {
    if (wp.id === "hero") continue;

    const trigger = getWaypointRingPosition(wp, curve);
    const dx = cat.position.x - trigger.x;
    const dz = cat.position.z - trigger.z;
    const distSq = dx * dx + dz * dz;
    if (distSq >= zoneRadiusSq) continue;

    if (!found || wp.pathT > found.pathT) {
      found = wp;
    }
  }

  if (!zonesReady) return;

  if (found) {
    bioBar?.hideForZone?.();
    if (found.id !== lastZone) {
      zoneUI.show(found);
      lastZone = found.id;
    } else if (!zoneUI.isOpen()) {
      zoneUI.show(found);
    }
  } else {
    if (lastZone || zoneUI.isOpen()) {
      zoneUI.hide();
      bioBar?.restoreAfterZone?.();
      lastZone = null;
    }
  }
}

function smoothstep(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

const KEY_LOOK_YAW = 1.75;
const KEY_LOOK_PITCH = 1.15;
/** Radians: negative = look up, positive = look down */
const VIEW_PITCH_MIN = -1.45;
const VIEW_PITCH_MAX = 0.42;
const ELEVATOR_VIEW_PITCH_MIN = -1.52;
const ELEVATOR_VIEW_PITCH_MAX = 1.45;

function getViewPitchLimits() {
  const inElevator =
    spaceElevator &&
    (spaceElevator.isRiding?.() || spaceElevator.passenger || spaceElevator.isCatInsideCar?.(cat));
  if (inElevator) {
    return { min: ELEVATOR_VIEW_PITCH_MIN, max: ELEVATOR_VIEW_PITCH_MAX };
  }
  return { min: VIEW_PITCH_MIN, max: VIEW_PITCH_MAX };
}

function updateViewAngles(dt) {
  const { dx, dy } = input.consumeLook();
  const { min: pitchMin, max: pitchMax } = getViewPitchLimits();

  if (input.lookLeft) viewYaw += KEY_LOOK_YAW * dt;
  if (input.lookRight) viewYaw -= KEY_LOOK_YAW * dt;
  if (input.lookUp) viewPitch = THREE.MathUtils.clamp(viewPitch - KEY_LOOK_PITCH * dt, pitchMin, pitchMax);
  if (input.lookDown) viewPitch = THREE.MathUtils.clamp(viewPitch + KEY_LOOK_PITCH * dt, pitchMin, pitchMax);

  viewYaw -= dx;
  viewPitch = THREE.MathUtils.clamp(viewPitch + dy, pitchMin, pitchMax);
  cat.viewPitch = THREE.MathUtils.lerp(cat.viewPitch, viewPitch, 1 - Math.exp(-10 * dt));
}

function updateCameraBlend(dt) {
  const target = input.isLookActive?.() || input.pointerLocked || input.touchMode ? 1 : 0;
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
  const onTrain = lightRail.isPassenger();
  const inElevator =
    spaceElevator &&
    (spaceElevator.isRiding?.() || spaceElevator.passenger);

  catMesh.visible = easedBlend < 0.9;

  cat.getEyePosition(eyePosition);
  if (onTrain) {
    const travelYaw = lightRail.getTravelViewYaw();
    const cosPitch = Math.cos(viewPitch);
    // Sit in the cab looking out the forward windshield.
    eyePosition.y = lightRail.getPassengerEyeWorldY();
    eyePosition.x += Math.sin(travelYaw) * 0.2;
    eyePosition.z += Math.cos(travelYaw) * 0.2;
    eyeLookAt.set(
      eyePosition.x + Math.sin(travelYaw) * 28 * cosPitch,
      eyePosition.y - Math.sin(viewPitch) * 28 + 0.4,
      eyePosition.z + Math.cos(travelYaw) * 28 * cosPitch
    );
  } else if (inElevator) {
    // Free look from the car — use viewYaw directly so body facing isn't required.
    const cosPitch = Math.cos(viewPitch);
    eyeLookAt.set(
      eyePosition.x + Math.sin(viewYaw) * 18 * cosPitch,
      eyePosition.y - Math.sin(viewPitch) * 18,
      eyePosition.z + Math.cos(viewYaw) * 18 * cosPitch
    );
  } else {
    cat.getEyeLookAt(eyeLookAt);
  }

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

  spaceNeedle?.updateMatrixWorld(true);

  const elevatorState = spaceElevator?.getState() ?? { carY: 0, atTop: false, moving: false };
  const inNeedle = isInSpaceNeedleCompound(cat.position.x, cat.position.z, cat.position.y);
  const onNeedleStairs = inNeedle && isOnStairCorridor(cat.position.x, cat.position.z);
  const onRail = lightRail.isOnRailCorridor(cat.position.x, cat.position.z);
  const useVariableGround = inNeedle || elevatorState.atTop || onRail || onNeedleStairs;
  const getGroundY = useVariableGround
    ? (x, z) => getCombinedGroundY(x, z, elevatorState, inNeedle, onNeedleStairs)
    : undefined;
  const activeCollisions = onRail
    ? lightRail.filterCollisions(cat.position.x, cat.position.z, collisions)
    : inNeedle
      ? filterNeedleCollisions(cat.position.x, cat.position.z, collisions)
      : collisions;

  const elevatorInside = spaceElevator?.isCatInsideCar?.(cat) ?? false;
  const lockMovement = spaceElevator ? spaceElevator.update(dt, cat, input) : false;
  const railLock =
    !lockMovement && lightRail
      ? lightRail.update(dt, cat, input, { elevatorInside })
      : false;
  const movementLocked = lockMovement || railLock;

  if (lockMovement || elevatorInside || spaceElevator?.passenger) {
    // Stay in first-person free-look while aboard the elevator.
    fpBlend = Math.max(fpBlend, THREE.MathUtils.lerp(fpBlend, 1, 1 - Math.exp(-10 * dt)));
    cat.facing = viewYaw;
    cat.cat.rotation.y = viewYaw;
    cat.viewPitch = viewPitch;
  }

  if (!movementLocked) {
    const firstPerson = easedBlend > 0.28 || inNeedle;
    // Mobile drag is screen/camera-relative, not path-stickied.
    const pathCurve = input.touchMode ? null : curve;
    cat.update(dt, input, activeCollisions, checkCollision, firstPerson ? "firstPerson" : "overview", viewYaw, pathCurve, {
      getGroundY,
      maxStepUp: onNeedleStairs ? 0.2 : inNeedle ? 0.65 : onRail ? 0.22 : 0.42,
    });
    if (input.touchMode && cat.wantsMove(input) && !firstPerson && !input.isTouchLooking?.()) {
      // Keep the camera behind the cat while dragging, unless looking with left thumb.
      viewYaw = lerpAngle(viewYaw, cat.facing + Math.PI, 1 - Math.exp(-4 * dt));
    }
    checkZones();
  }

  if (lightRail.isRiding() && lightRail.isPassenger()) {
    const travelYaw = lightRail.getTravelViewYaw();
    viewYaw = lerpAngle(viewYaw, travelYaw, 1 - Math.exp(-5 * dt));
    viewPitch = THREE.MathUtils.lerp(viewPitch, -0.08, 1 - Math.exp(-5 * dt));
    cat.facing = travelYaw;
    cat.viewPitch = viewPitch;
    fpBlend = Math.max(fpBlend, THREE.MathUtils.lerp(fpBlend, 1, 1 - Math.exp(-12 * dt)));
  } else if (lightRail.isPassenger() && !lightRail.isRiding()) {
    // Boarded and waiting — preview the direction the ride will go.
    const travelYaw = lightRail.getTravelViewYaw();
    viewYaw = lerpAngle(viewYaw, travelYaw, 1 - Math.exp(-4 * dt));
    cat.facing = travelYaw;
    cat.viewPitch = viewPitch;
    fpBlend = Math.max(fpBlend, THREE.MathUtils.lerp(fpBlend, 1, 1 - Math.exp(-10 * dt)));
  }

  footsteps.update(dt, cat);
  updateCherryPetals(dt);
  if (movementLocked && zoneUI.isOpen()) {
    zoneUI.hide();
    bioBar?.restoreAfterZone?.();
    lastZone = null;
  }

  const hint =
    spaceElevator?.getContextHint?.(cat) ??
    lightRail.getContextHint?.(cat, { elevatorInside }) ??
    null;
  if (hint && !zoneUI.isOpen()) {
    contextHint.show(hint);
  } else {
    contextHint.hide();
  }

  applyCamera();

  const elapsed = clock.elapsedTime;
  if (floatingText) {
    animateFloatingText(floatingText, elapsed, cat.position, camera, dt);
  }
  animatePathArrows(pathArrows, elapsed);
  animateFountain(terminiGroup, elapsed);
  lightRail.animateStations(elapsed);

  sky.position.set(cat.position.x, 0, cat.position.z);
  animateSky(sky, elapsed);
  animateSkyThankYouMessage(sky.userData.thankYouMessage, {
    atTop: elevatorState.atTop,
    catPosition: cat.position,
    camera,
    elapsed,
    dt,
  });

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  const width = Math.round(window.visualViewport?.width ?? window.innerWidth);
  const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  resizeSky(sky);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => window.dispatchEvent(new Event("resize")));
}

async function loadWorldContent() {
  setLoadingStatus("Building skyline…");

  const { group: cityGroup, collisions: builtCollisions } = await createCityAsync(curve, {
    batchSize: 5,
    onProgress(done, total) {
      if (total > 0 && done % 15 === 0) {
        setLoadingStatus(`Building skyline… ${Math.min(99, Math.round((done / total) * 100))}%`);
      }
    },
  });
  scene.add(cityGroup);
  cityCollisions = builtCollisions;
  collisions = [...cityCollisions, ...terminiCollisions];

  setLoadingStatus("Adding landmarks…");
  await new Promise((resolve) => requestAnimationFrame(resolve));

  spaceNeedle = addSpaceNeedleToScene(scene, cityCollisions);
  const spaceElevatorSystem = createSpaceNeedleElevator(spaceNeedle);
  spaceElevator = new SpaceNeedleElevatorController(spaceElevatorSystem);
  getWalkHeight = createWalkHeightQuery(spaceElevatorSystem);
  collisions = [...cityCollisions, ...terminiCollisions];

  setLoadingStatus("Planting cherry blossoms…");
  const cherryBlossoms = createCherryBlossoms({
    pathCurve: curve,
    collisions,
    checkCollision,
  });
  scene.add(cherryBlossoms.group);
  updateCherryPetals = cherryBlossoms.updateCherryPetals;

  setLoadingStatus("Preparing signs…");
  const floatingTextModule = await import("./world/floatingText.js");
  floatingText = floatingTextModule.createPathFloatingLabels(curve);
  animateFloatingText = floatingTextModule.animateFloatingText;
  pickFloatingLink = floatingTextModule.pickFloatingLink;
  scene.add(floatingText);
}

function boot() {
  const modeSelect = document.getElementById("mode-select");
  let started = false;

  function startPlay(mode) {
    if (started) return;
    started = true;
    input.setControlMode(mode);
    if (modeSelect) modeSelect.hidden = true;
    bioBar?.playEntrance();
    animate();
  }

  requestAnimationFrame(() => {
    applyCamera();
    renderer.render(scene, camera);
    loading.classList.add("is-done");
    if (modeSelect) {
      modeSelect.hidden = false;
      modeSelect.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-mode]");
        if (!btn) return;
        startPlay(btn.getAttribute("data-mode") === "mobile" ? "mobile" : "desktop");
      });
    } else {
      startPlay("desktop");
    }
  });

  loadWorldContent().catch((err) => {
    console.error("World content failed to load", err);
    setLoadingStatus("Something went wrong — try refreshing");
  });
}

boot();

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
