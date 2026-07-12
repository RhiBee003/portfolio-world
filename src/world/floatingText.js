import * as THREE from "three";
import { pathSideAt, pathCenterAt, closestPathT } from "./pathLayout.js";
import { WAYPOINTS, RING_T_OFFSET } from "./waypoints.js";
import { RESUME_FLOAT_SECTIONS } from "./resume.js";

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif';
const FLOATING_TEXT_COLOR = "#000000";
/** Path-t distance ahead of the cat where labels begin fading in. */
const PATH_FADE_RANGE = 0.14;
const GLOW_MAX_OPACITY = 0.55;
const TEXT_SHOW_THRESHOLD = 0.1;
const LOOK_DOT_START = 0.58;
const LOOK_DOT_FULL = 0.9;

const _panelWorld = new THREE.Vector3();
const _toPanel = new THREE.Vector3();
const _cameraForward = new THREE.Vector3();

function smoothstep(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function proximityAt(catPosition, anchor, radius) {
  const dx = catPosition.x - anchor.x;
  const dz = catPosition.z - anchor.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return smoothstep(1 - dist / radius);
}

function textFadeAt(catPosition, anchor, radius) {
  const dx = catPosition.x - anchor.x;
  const dz = catPosition.z - anchor.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist >= radius) return 0;
  return smoothstep(1 - dist / radius);
}

function pathApproachFade(catPathT, labelPathT) {
  const ahead = labelPathT - catPathT;
  if (ahead <= 0) return 1;
  if (ahead >= PATH_FADE_RANGE) return 0;
  return smoothstep(1 - ahead / PATH_FADE_RANGE);
}

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = text.split("\n");
  const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function createTextTexture(text, options = {}) {
  const fontSize = options.fontSize ?? 56;
  const fontWeight = options.fontWeight ?? 600;
  const maxWidth = options.maxWidth ?? 720;
  const padding = options.padding ?? 28;
  const color = options.color ?? FLOATING_TEXT_COLOR;

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  measureCtx.font = `${fontWeight} ${fontSize}px ${FONT}`;
  const lines = wrapLines(measureCtx, text, maxWidth - padding * 2);
  const lineHeight = fontSize * (options.lineHeight ?? 1.35);

  let textWidth = 0;
  for (const line of lines) {
    textWidth = Math.max(textWidth, measureCtx.measureText(line).width);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.ceil(lines.length * lineHeight + padding * 2);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontWeight} ${fontSize}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  lines.forEach((line, index) => {
    const y = padding + lineHeight * index + lineHeight / 2;
    ctx.fillText(line, canvas.width / 2, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, width: canvas.width, height: canvas.height };
}

function createGlowTexture(text, options = {}) {
  const fontSize = options.fontSize ?? 56;
  const fontWeight = options.fontWeight ?? 600;
  const maxWidth = options.maxWidth ?? 720;
  const padding = options.padding ?? 28;

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  measureCtx.font = `${fontWeight} ${fontSize}px ${FONT}`;
  const lines = wrapLines(measureCtx, text, maxWidth - padding * 2);
  const lineHeight = fontSize * (options.lineHeight ?? 1.35);

  let textWidth = 0;
  for (const line of lines) {
    textWidth = Math.max(textWidth, measureCtx.measureText(line).width);
  }

  const innerWidth = Math.ceil(textWidth + padding * 2);
  const innerHeight = Math.ceil(lines.length * lineHeight + padding * 2);
  const bleed = Math.ceil(fontSize * 2.2);

  const mask = document.createElement("canvas");
  mask.width = innerWidth;
  mask.height = innerHeight;
  const maskCtx = mask.getContext("2d");
  maskCtx.font = `${fontWeight} ${fontSize}px ${FONT}`;
  maskCtx.fillStyle = "#ffffff";
  maskCtx.textAlign = "center";
  maskCtx.textBaseline = "middle";
  lines.forEach((line, index) => {
    const y = padding + lineHeight * index + lineHeight / 2;
    maskCtx.fillText(line, innerWidth / 2, y);
  });

  const canvas = document.createElement("canvas");
  canvas.width = innerWidth + bleed * 2;
  canvas.height = innerHeight + bleed * 2;
  const ctx = canvas.getContext("2d");
  const blurPx = Math.max(6, fontSize * 0.72);
  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(mask, bleed, bleed);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(255, 240, 246, 0.82)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, width: canvas.width, height: canvas.height };
}

function createTextPanel(text, options = {}) {
  const { texture, width, height } = createTextTexture(text, options);
  const { texture: glowTexture } = createGlowTexture(text, options);
  const worldWidth = options.worldWidth ?? 10;
  const worldHeight = worldWidth * (height / width);
  const glowScale = Math.max(glowTexture.image.width / width, glowTexture.image.height / height);

  const panel = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
  const glowGeometry = new THREE.PlaneGeometry(worldWidth * glowScale, worldHeight * glowScale);

  const glowMesh = new THREE.Mesh(
    glowGeometry,
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  glowMesh.renderOrder = 8;
  glowMesh.frustumCulled = false;

  const textMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      alphaTest: 0.12,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  textMesh.renderOrder = 10;
  textMesh.frustumCulled = false;

  panel.add(glowMesh);
  panel.add(textMesh);
  panel.userData.textMesh = textMesh;
  panel.userData.glowMesh = glowMesh;
  panel.userData.glowLevel = 0;
  panel.userData.baseY = options.y ?? 4;
  panel.userData.phase = options.phase ?? 0;
  panel.userData.freq = options.freq ?? 0.7;
  panel.userData.drift = options.drift ?? 0.08;
  return panel;
}

function createPathRing() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 2.1, 40),
    new THREE.MeshBasicMaterial({
      color: 0xf0d4de,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.14;
  ring.renderOrder = 5;
  ring.frustumCulled = false;
  return ring;
}


function createUnderline(width) {
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.1),
    new THREE.MeshBasicMaterial({
      color: 0xe8a4bc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    })
  );
  line.renderOrder = 9;
  line.frustumCulled = false;
  return line;
}

function createLabelStop(curve, triggerT, side, sideOffset, proximityRadius, buildText, options = {}) {
  const ringTOffset = options.ringTOffset ?? RING_T_OFFSET;
  const ringT = THREE.MathUtils.clamp(triggerT + ringTOffset, 0.02, 0.98);
  const ringCenter = pathCenterAt(curve, ringT);
  const sidePos = pathSideAt(curve, triggerT, side, sideOffset);

  const stop = new THREE.Group();
  stop.position.set(ringCenter.x, 0, ringCenter.z);
  stop.userData.pathT = triggerT;
  stop.userData.proximityAnchor = ringCenter;
  stop.userData.proximityRadius = proximityRadius;
  stop.userData.textAnchor = { x: sidePos.x, z: sidePos.z };
  const labelRadius = proximityRadius / 1.8;
  stop.userData.textProximityRadius =
    options.textProximityRadius ?? sideOffset + labelRadius * 1.25;

  const ring = createPathRing();
  stop.userData.ring = ring;
  stop.add(ring);

  const textGroup = new THREE.Group();
  textGroup.position.set(sidePos.x - ringCenter.x, 0, sidePos.z - ringCenter.z);
  stop.userData.textGroup = textGroup;
  stop.userData.panels = [];

  buildText(textGroup, stop.userData.panels);

  if (stop.userData.panels.length > 0) {
    const baseY = stop.userData.panels[0].userData.baseY;
    const underline = createUnderline(options.underlineWidth ?? 4.2);
    underline.position.y = baseY - 0.55;
    stop.userData.underline = underline;
    textGroup.add(underline);
  }

  stop.add(textGroup);
  return stop;
}

function addFloatingPanels(textGroup, panels, sections, phaseSeed) {
  sections.forEach((section, sectionIndex) => {
    const panel = createTextPanel(section.text, {
      fontSize: section.fontSize ?? 16,
      fontWeight: section.fontWeight ?? 500,
      color: FLOATING_TEXT_COLOR,
      worldWidth: section.worldWidth ?? 7,
      maxWidth: section.maxWidth ?? 480,
      lineHeight: section.lineHeight ?? 1.35,
      y: section.y,
      phase: phaseSeed + sectionIndex * 0.35,
      freq: section.freq ?? 0.42,
      drift: section.drift ?? 0.025,
    });
    panel.position.y = section.y;
    panel.userData.baseY = section.y;
    panels.push(panel);
    textGroup.add(panel);
  });
}

export function createPathFloatingLabels(curve) {
  const group = new THREE.Group();

  WAYPOINTS.forEach((wp, index) => {
    const stop = createLabelStop(
      curve,
      wp.pathT,
      wp.side,
      wp.sideOffset,
      wp.radius * 1.8,
      (textGroup, panels) => {
        if (wp.id === "hero") return;

        if (wp.id === "resume") {
          addFloatingPanels(textGroup, panels, RESUME_FLOAT_SECTIONS, index * 0.8);
          return;
        }

        const panel = createTextPanel(wp.title, {
          fontSize: 30,
          fontWeight: 600,
          color: FLOATING_TEXT_COLOR,
          worldWidth: 6,
          maxWidth: 420,
          y: 4.8,
          phase: index * 0.8,
          freq: 0.45,
          drift: 0.03,
        });
        panel.position.y = 4.8;
        panel.userData.baseY = 4.8;
        panels.push(panel);
        textGroup.add(panel);
      },
      wp.id === "resume"
        ? { underlineWidth: 5.2, ringTOffset: RING_T_OFFSET, textProximityRadius: wp.sideOffset + wp.radius * 1.55 }
        : {}
    );
    group.add(stop);
  });

  group.userData.curve = curve;
  return group;
}

function faceGroup(group, catPosition) {
  const world = new THREE.Vector3();
  group.getWorldPosition(world);
  const dx = catPosition.x - world.x;
  const dz = catPosition.z - world.z;
  if (dx * dx + dz * dz > 0.01) {
    group.rotation.y = Math.atan2(dx, dz);
  }
}

function lookAtPanelFactor(camera, panel) {
  if (!camera) return 0;

  const textMesh = panel.userData.textMesh;
  if (textMesh) {
    textMesh.getWorldPosition(_panelWorld);
  } else {
    panel.getWorldPosition(_panelWorld);
  }

  _toPanel.copy(_panelWorld).sub(camera.position);
  const dist = _toPanel.length();
  if (dist < 0.5) return 1;

  _toPanel.multiplyScalar(1 / dist);
  camera.getWorldDirection(_cameraForward);

  const dot = _cameraForward.dot(_toPanel);
  if (dot <= LOOK_DOT_START) return 0;
  return smoothstep((dot - LOOK_DOT_START) / (LOOK_DOT_FULL - LOOK_DOT_START));
}

function applyProximity(stop, ringProximity, textProximity, elapsed, catPosition, camera, dt) {
  stop.userData.ring.material.opacity = ringProximity * 0.65;
  stop.userData.ring.scale.set(0.85 + ringProximity * 0.25, 0.85 + ringProximity * 0.25, 1);

  if (stop.userData.underline) {
    stop.userData.underline.material.opacity = textProximity;
    stop.userData.underline.scale.x = 0.15 + textProximity * 0.85;
  }

  stop.userData.panels.forEach((panel) => {
    const { baseY, phase, freq, drift, textMesh, glowMesh } = panel.userData;
    panel.position.y = baseY + Math.sin(elapsed * freq + phase) * drift;

    const showText = textProximity > TEXT_SHOW_THRESHOLD;
    const lookFactor = lookAtPanelFactor(camera, panel);
    const glowTarget = Math.max(lookFactor, showText ? textProximity * 0.45 : 0);
    panel.userData.glowLevel = THREE.MathUtils.lerp(
      panel.userData.glowLevel ?? 0,
      glowTarget,
      1 - Math.exp(-9 * dt)
    );
    textMesh.material.opacity = showText ? 1 : 0;
    textMesh.visible = showText;

    const glowOpacity = showText ? panel.userData.glowLevel * GLOW_MAX_OPACITY : 0;
    glowMesh.material.opacity = glowOpacity;
    glowMesh.visible = glowOpacity > 0.008;
  });

  if (stop.userData.textGroup && catPosition) {
    faceGroup(stop.userData.textGroup, catPosition);
  }
}

export function animateFloatingText(group, elapsed, catPosition, camera, dt = 0.016) {
  if (!catPosition) return;

  const curve = group.userData.curve;
  const catPathT = curve ? closestPathT(curve, catPosition.x, catPosition.z) : 0;

  group.children.forEach((stop) => {
    if (!stop.userData.proximityAnchor) return;

    const ringProximity = proximityAt(
      catPosition,
      stop.userData.proximityAnchor,
      stop.userData.proximityRadius
    );
    const spatialFade = textFadeAt(
      catPosition,
      stop.userData.textAnchor,
      stop.userData.textProximityRadius
    );
    const pathFade = pathApproachFade(catPathT, stop.userData.pathT ?? 0);
    const textProximity = pathFade * Math.max(spatialFade, ringProximity * 0.9);
    applyProximity(stop, ringProximity, textProximity, elapsed, catPosition, camera, dt);
  });
}
