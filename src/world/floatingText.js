import * as THREE from "three";
import { pathSideAt, pathCenterAt } from "./pathLayout.js";
import { WAYPOINTS, RING_T_OFFSET } from "./waypoints.js";
import { RESUME_FLOAT_SECTIONS } from "./resume.js";

const TEXT_FADE_MIN = 0.1;
const TEXT_FADE_MAX = 1;

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
  const color = options.color ?? "#1a1a1a";

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

function createTextPanel(text, options = {}) {
  const { texture, width, height } = createTextTexture(text, options);
  const worldWidth = options.worldWidth ?? 10;
  const worldHeight = worldWidth * (height / width);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth, worldHeight),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: TEXT_FADE_MIN,
      alphaTest: 0.08,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  mesh.userData.baseY = options.y ?? 4;
  mesh.userData.phase = options.phase ?? 0;
  mesh.userData.freq = options.freq ?? 0.7;
  mesh.userData.drift = options.drift ?? 0.08;
  return mesh;
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
  stop.userData.proximityAnchor = ringCenter;
  stop.userData.proximityRadius = proximityRadius;

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
      color: section.color ?? "#333",
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
          color: "#1a1a1a",
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
      wp.id === "resume" ? { underlineWidth: 5.2, ringTOffset: RING_T_OFFSET } : {}
    );
    group.add(stop);
  });

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

function applyProximity(stop, proximity, elapsed, catPosition) {
  stop.userData.ring.material.opacity = proximity * 0.65;
  stop.userData.ring.scale.set(0.85 + proximity * 0.25, 0.85 + proximity * 0.25, 1);

  if (stop.userData.underline) {
    stop.userData.underline.material.opacity = proximity;
    stop.userData.underline.scale.x = 0.15 + proximity * 0.85;
  }

  stop.userData.panels.forEach((panel) => {
    const { baseY, phase, freq, drift } = panel.userData;
    panel.position.y = baseY + Math.sin(elapsed * freq + phase) * drift;
    panel.material.opacity =
      TEXT_FADE_MIN + proximity * (TEXT_FADE_MAX - TEXT_FADE_MIN);
  });

  if (stop.userData.textGroup && catPosition) {
    faceGroup(stop.userData.textGroup, catPosition);
  }
}

export function animateFloatingText(group, elapsed, catPosition) {
  if (!catPosition) return;

  group.children.forEach((stop) => {
    if (!stop.userData.proximityAnchor) return;

    const proximity = proximityAt(
      catPosition,
      stop.userData.proximityAnchor,
      stop.userData.proximityRadius
    );
    applyProximity(stop, proximity, elapsed, catPosition);
  });
}
