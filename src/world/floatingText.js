import * as THREE from "three";
import { pathSideAt, pathCenterAt } from "./pathLayout.js";
import { WAYPOINTS, RING_T_OFFSET } from "./waypoints.js";

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif';

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
  const words = text.split(/\s+/);
  const lines = [];
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
      opacity: 1,
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
      color: 0xf6c8d7,
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

function createTextBackdrop(width, height) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: 0xfff5f8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    })
  );
  mesh.position.z = -0.05;
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  return mesh;
}

function createUnderline(width) {
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.09),
    new THREE.MeshBasicMaterial({
      color: 0xe8a4bc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    })
  );
  line.renderOrder = 4;
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

  const accents = { backdrop: null, underline: null };
  buildText(textGroup, stop.userData.panels, accents);
  stop.userData.backdrop = accents.backdrop;
  stop.userData.underline = accents.underline;

  stop.add(textGroup);
  return stop;
}

function createSkyName(curve) {
  const cityCenter = curve.getPointAt(0.38);
  const ringT = THREE.MathUtils.clamp(0.38 + RING_T_OFFSET, 0.02, 0.98);
  const ringCenter = pathCenterAt(curve, ringT);

  const stop = new THREE.Group();
  stop.position.set(ringCenter.x, 0, ringCenter.z);
  stop.userData.proximityAnchor = ringCenter;
  stop.userData.proximityRadius = 24;
  stop.userData.isSkyStop = true;

  const ring = createPathRing();
  stop.userData.ring = ring;
  stop.add(ring);

  const name = createTextPanel("Rhiannon Black", {
    fontSize: 88,
    fontWeight: 700,
    color: "#1a1a1a",
    worldWidth: 14,
    maxWidth: 900,
    phase: 0,
    freq: 0.45,
    drift: 0.14,
  });
  name.position.set(cityCenter.x - ringCenter.x, 22, cityCenter.z - ringCenter.z);
  name.userData.baseY = 22;

  const textGroup = new THREE.Group();
  textGroup.add(name);
  stop.userData.panels = [name];
  stop.userData.textGroup = textGroup;
  stop.add(textGroup);

  return stop;
}

const FLOATING_LABELS = [
  {
    text: "Creative developer and designer. Walk the trail to explore projects and ways to connect.",
    pathT: 0.11,
    side: -1,
    offset: 9.5,
    y: 5.2,
    fontSize: 30,
    fontWeight: 500,
    color: "#4a4a4a",
    worldWidth: 8.5,
    maxWidth: 640,
    phase: 1.2,
    freq: 0.6,
    drift: 0.07,
    proximityRadius: 10,
  },
];

export function createPathFloatingLabels(curve) {
  const group = new THREE.Group();

  group.add(createSkyName(curve));

  FLOATING_LABELS.forEach((cfg) => {
    const stop = createLabelStop(curve, cfg.pathT, cfg.side, cfg.offset, cfg.proximityRadius, (textGroup, panels, accents) => {
      const backdrop = createTextBackdrop(9, 3.5);
      backdrop.position.y = cfg.y;
      accents.backdrop = backdrop;
      textGroup.add(backdrop);

      const panel = createTextPanel(cfg.text, cfg);
      panel.position.y = cfg.y;
      panel.userData.baseY = cfg.y;
      panels.push(panel);
      textGroup.add(panel);

      const underline = createUnderline(7);
      underline.position.y = cfg.y - 1.2;
      accents.underline = underline;
      textGroup.add(underline);
    });
    group.add(stop);
  });

  WAYPOINTS.forEach((wp, index) => {
    const stop = createLabelStop(
      curve,
      wp.pathT,
      wp.side,
      wp.sideOffset,
      wp.radius * 1.8,
      (textGroup, panels, accents) => {
        if (wp.id === "hero") return;

        accents.backdrop = createTextBackdrop(8.5, 5.5);
        accents.backdrop.position.y = 5;
        textGroup.add(accents.backdrop);

        const panel = createTextPanel(wp.title, {
          fontSize: 36,
          fontWeight: 700,
          color: "#1a1a1a",
          worldWidth: 7.5,
          maxWidth: 520,
          y: 5.6,
          phase: index * 1.1,
          freq: 0.58,
          drift: 0.08,
        });
        panel.position.y = 5.6;
        panel.userData.baseY = 5.6;
        panels.push(panel);
        textGroup.add(panel);

        const tag = createTextPanel(wp.tag, {
          fontSize: 22,
          fontWeight: 600,
          color: "#c97a96",
          worldWidth: 4.5,
          maxWidth: 320,
          y: 4.2,
          phase: index * 1.1 + 0.4,
          freq: 0.62,
          drift: 0.06,
        });
        tag.position.y = 4.2;
        tag.userData.baseY = 4.2;
        panels.push(tag);
        textGroup.add(tag);

        accents.underline = createUnderline(5.5);
        accents.underline.position.y = 3.85;
        textGroup.add(accents.underline);
      }
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
  const pulse = 1 + Math.sin(elapsed * 2.4) * 0.04 * proximity;
  const ringScale = stop.userData.isSkyStop ? 2.4 : 1;

  stop.userData.ring.material.opacity = proximity * 0.9;
  stop.userData.ring.scale.set(
    (0.6 + proximity * 0.5) * pulse * ringScale,
    (0.6 + proximity * 0.5) * pulse * ringScale,
    1
  );

  if (stop.userData.backdrop) {
    stop.userData.backdrop.material.opacity = 0;
  }

  if (stop.userData.underline) {
    stop.userData.underline.material.opacity = proximity;
    stop.userData.underline.scale.x = 0.25 + proximity * 0.75;
  }

  stop.userData.panels.forEach((panel) => {
    const { baseY, phase, freq, drift } = panel.userData;
    panel.position.y = baseY + Math.sin(elapsed * freq + phase) * drift + proximity * 0.22;
    panel.material.opacity = 1;
    panel.material.transparent = true;
    panel.material.fog = false;
    panel.material.toneMapped = false;
    panel.scale.setScalar(1);
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
