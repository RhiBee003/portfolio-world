import * as THREE from "three";
import { pathSideAt, pathCenterAt, closestPathT } from "./pathLayout.js";
import { WAYPOINTS, RING_T_OFFSET } from "./waypoints.js";
import { createResumePdfPage, ensureResumePdfLoaded } from "./resumePage.js";
import { PROJECT_PREVIEWS } from "./projectPreviews.js";

const textureLoader = new THREE.TextureLoader();

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif';
const FLOATING_TEXT_COLOR = "#000000";
/** High-contrast ink — light pink washed out against the cherry world. */
const PROJECT_TEXT_COLOR = "#1a1216";
const LINK_TEXT_COLOR = "#7a3048";
const UNDERLINE_HEX = "#e8a4bc";
const RING_COLOR = 0xe891ad;
const TEXT_RENDER_SCALE = 2;

function configureTextTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  return texture;
}
/** Path-t distance ahead of the cat where labels begin fading in. */
const PATH_FADE_RANGE = 0.28;
/** Longer path fade so the resume eases in/out instead of popping. */
const RESUME_PATH_FADE_RANGE = 0.38;

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

function pathDistanceFade(catPathT, anchorPathT, range = PATH_FADE_RANGE) {
  const dist = Math.abs(catPathT - anchorPathT);
  if (dist >= range) return 0;
  return smoothstep(1 - dist / range);
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
  const scale = options.renderScale ?? TEXT_RENDER_SCALE;
  const fontSize = (options.fontSize ?? 56) * scale;
  const fontWeight = options.fontWeight ?? 600;
  const maxWidth = (options.maxWidth ?? 720) * scale;
  const padding = (options.padding ?? 28) * scale;
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
    if (options.isLink) {
      const lineWidth = ctx.measureText(line).width;
      ctx.fillRect(
        canvas.width / 2 - lineWidth / 2,
        y + fontSize * 0.42,
        lineWidth,
        Math.max(2, fontSize * 0.07)
      );
    }
  });

  const texture = configureTextTexture(new THREE.CanvasTexture(canvas));
  return { texture, width: canvas.width / scale, height: canvas.height / scale };
}

function createTextPanel(text, options = {}) {
  const { texture, width, height } = createTextTexture(text, options);
  const worldWidth = options.worldWidth ?? 10;
  const worldHeight = worldWidth * (height / width);

  const panel = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);

  let backMesh = null;
  if (options.showBackground) {
    const backPadX = options.backgroundPadX ?? 0.28;
    const backPadY = options.backgroundPadY ?? 0.2;
    backMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldWidth + backPadX, worldHeight + backPadY),
      new THREE.MeshBasicMaterial({
        color: 0xfffef9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        fog: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      })
    );
    backMesh.renderOrder = 7;
    backMesh.frustumCulled = false;
    backMesh.position.z = -0.03;
    panel.add(backMesh);
  }

  const textMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      // Low alphaTest so soft canvas glyphs still show while fading in.
      alphaTest: 0.02,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  textMesh.renderOrder = 10;
  textMesh.frustumCulled = false;

  panel.add(textMesh);
  panel.userData.textMesh = textMesh;
  if (backMesh) panel.userData.backMesh = backMesh;
  panel.userData.href = options.href ?? null;
  panel.userData.baseY = options.y ?? 4;
  panel.userData.phase = options.phase ?? 0;
  panel.userData.freq = options.freq ?? 0.7;
  panel.userData.drift = options.drift ?? 0.08;
  return panel;
}

function createPreviewPanel(previewConfig, phaseSeed) {
  const { worldWidth, y, aspect, src } = previewConfig;
  const worldHeight = worldWidth / aspect;
  const pad = 0.16;
  const group = new THREE.Group();

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth + pad, worldHeight + pad),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  frame.renderOrder = 7;

  const imageMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const image = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldHeight), imageMat);
  image.renderOrder = 7;
  image.position.z = 0.01;

  if (src) {
    textureLoader.load(
      src,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        imageMat.map = tex;
        imageMat.needsUpdate = true;
      }
    );
  }

  group.add(frame);
  group.add(image);
  group.userData.frameMesh = frame;
  group.userData.imageMesh = image;
  group.userData.baseY = y;
  group.userData.phase = phaseSeed;
  group.userData.freq = 0.38;
  group.userData.drift = 0.02;
  group.position.y = y;
  return group;
}

function createPathRing() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.55, 2.35, 48),
    new THREE.MeshBasicMaterial({
      color: RING_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  ring.renderOrder = 4;
  ring.frustumCulled = false;
  return ring;
}

function createUnderline(width) {
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.04),
    new THREE.MeshBasicMaterial({
      color: parseInt(UNDERLINE_HEX.slice(1), 16),
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

function createInfoCardBackground({ width, topY, bottomY, padX = 0.4, padY = 0.45, phase = 0 }) {
  const height = topY - bottomY + padY * 2;
  const centerY = (topY + bottomY) / 2;
  const group = new THREE.Group();

  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(width + padX, height),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  card.renderOrder = 6;
  card.position.z = -0.05;

  group.add(card);
  group.position.y = centerY;
  group.userData.baseY = centerY;
  group.userData.cardMesh = card;
  group.userData.phase = phase;
  group.userData.freq = 0.38;
  group.userData.drift = 0.018;
  return group;
}

function createLabelStop(curve, triggerT, side, sideOffset, proximityRadius, buildText, options = {}) {
  const ringTOffset = options.ringTOffset ?? RING_T_OFFSET;
  const ringT = THREE.MathUtils.clamp(triggerT + ringTOffset, 0.02, 0.98);
  const ringCenter = pathCenterAt(curve, ringT);
  const sidePos = pathSideAt(curve, triggerT, side, sideOffset);

  const stop = new THREE.Group();
  stop.position.set(ringCenter.x, 0, ringCenter.z);
  stop.userData.pathT = triggerT;
  stop.userData.ringT = ringT;
  stop.userData.proximityAnchor = ringCenter;
  stop.userData.proximityRadius = proximityRadius;
  stop.userData.textAnchor = { x: sidePos.x, z: sidePos.z };
  const labelRadius = proximityRadius / 1.8;
  stop.userData.textProximityRadius =
    options.textProximityRadius ?? sideOffset + labelRadius * 1.55;

  const ring = createPathRing();
  stop.userData.ring = ring;
  stop.add(ring);

  const textGroup = new THREE.Group();
  textGroup.position.set(sidePos.x - ringCenter.x, 0, sidePos.z - ringCenter.z);
  stop.userData.textGroup = textGroup;
  stop.userData.panels = [];
  stop.userData.previews = [];
  stop.userData.pageBack = null;

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
      wp.radius * 2.4,
      (textGroup, panels) => {
        if (wp.id === "hero") return;

        if (wp.id === "resume") return;

        if (wp.id === "contact") {
          const titlePanel = createTextPanel(wp.title, {
            fontSize: 30,
            fontWeight: 600,
            color: PROJECT_TEXT_COLOR,
            worldWidth: 6,
            maxWidth: 420,
            y: 4.8,
            phase: index * 0.8,
            freq: 0.45,
            drift: 0.03,
          });
          titlePanel.position.y = 4.8;
          titlePanel.userData.baseY = 4.8;
          panels.push(titlePanel);
          textGroup.add(titlePanel);

          (wp.floatLinks ?? []).forEach((link, linkIndex) => {
            const linkPanel = createTextPanel(link.text, {
              fontSize: 16,
              fontWeight: 500,
              color: LINK_TEXT_COLOR,
              worldWidth: 4.2,
              maxWidth: 320,
              y: link.y,
              href: link.href,
              phase: index * 0.8 + (linkIndex + 1) * 0.25,
              freq: 0.42,
              drift: 0.025,
            });
            linkPanel.position.y = link.y;
            linkPanel.userData.baseY = link.y;
            panels.push(linkPanel);
            textGroup.add(linkPanel);
          });
          return;
        }

        const titlePanel = createTextPanel(wp.title, {
          fontSize: 30,
          fontWeight: 600,
          color: PROJECT_PREVIEWS[wp.id] ? PROJECT_TEXT_COLOR : FLOATING_TEXT_COLOR,
          worldWidth: 6,
          maxWidth: 420,
          y: 4.8,
          phase: index * 0.8,
          freq: 0.45,
          drift: 0.03,
        });
        titlePanel.position.y = 4.8;
        titlePanel.userData.baseY = 4.8;
        panels.push(titlePanel);
        textGroup.add(titlePanel);

        if (wp.floatSections?.length) {
          addFloatingPanels(textGroup, panels, wp.floatSections, index * 0.8);
        }
      },
      wp.id === "resume"
        ? { underlineWidth: 5.2, ringTOffset: RING_T_OFFSET, textProximityRadius: wp.sideOffset + wp.radius * 1.55 }
        : {}
    );

    if (wp.id === "resume") {
      const pageBack = createResumePdfPage(index * 0.8);
      stop.userData.textGroup.add(pageBack);
      stop.userData.pageBack = pageBack;
    }

    if (wp.id === "about") {
      const infoCard = createInfoCardBackground({
        width: 8.8,
        topY: 5.45,
        bottomY: -0.2,
        phase: index * 0.8,
      });
      stop.userData.infoCard = infoCard;
      stop.userData.textGroup.add(infoCard);
    }

    const previewConfig = PROJECT_PREVIEWS[wp.id];
    if (previewConfig) {
      const preview = createPreviewPanel(previewConfig, index * 0.8 + 0.25);
      stop.userData.textGroup.add(preview);
      stop.userData.previews.push(preview);
    }

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

function applyProximity(stop, ringProximity, textProximity, elapsed, catPosition, camera, dt) {
  // Stronger floor so pink rings read clearly on the pale path.
  stop.userData.ring.material.opacity = ringProximity * 0.95;
  stop.userData.ring.visible = ringProximity > 0.02;
  stop.userData.ring.scale.set(0.9 + ringProximity * 0.28, 0.9 + ringProximity * 0.28, 1);

  const fade = smoothstep(textProximity);
  const visible = fade > 0.008;

  if (stop.userData.underline) {
    stop.userData.underline.material.opacity = fade;
    stop.userData.underline.scale.x = 0.04 + fade * 1.55;
  }

  stop.userData.previews.forEach((preview) => {
    const { baseY, phase, freq, drift, frameMesh, imageMesh } = preview.userData;
    preview.position.y = baseY + Math.sin(elapsed * freq + phase) * drift;
    frameMesh.material.opacity = fade * 0.97;
    imageMesh.material.opacity = fade;
    preview.visible = visible;
  });

  if (stop.userData.infoCard) {
    const infoCard = stop.userData.infoCard;
    const { baseY, phase, freq, drift, cardMesh } = infoCard.userData;
    infoCard.position.y = baseY + Math.sin(elapsed * freq + phase) * drift;
    cardMesh.material.opacity = fade * 0.98;
    infoCard.visible = visible;
  }

  if (stop.userData.pageBack) {
    const pageBack = stop.userData.pageBack;
    const { baseY, phase, freq, drift, pageMesh, frameMesh, shadowMesh } = pageBack.userData;
    pageBack.position.y = baseY + Math.sin(elapsed * freq + phase) * drift;

    pageBack.userData.fadeLevel = THREE.MathUtils.lerp(
      pageBack.userData.fadeLevel ?? 0,
      fade,
      1 - Math.exp(-5 * dt)
    );
    const pageFade = pageBack.userData.fadeLevel;
    pageMesh.material.opacity = pageFade;
    if (frameMesh) frameMesh.material.opacity = pageFade * 0.98;
    shadowMesh.material.opacity = pageFade * 0.12;
    pageBack.visible = pageFade > 0.008;
  }

  stop.userData.panels.forEach((panel) => {
    const { baseY, phase, freq, drift, textMesh, backMesh } = panel.userData;
    panel.position.y = baseY + Math.sin(elapsed * freq + phase) * drift;

    if (backMesh) {
      backMesh.material.opacity = fade * 0.96;
      backMesh.visible = visible;
    }
    textMesh.material.opacity = fade;
    textMesh.visible = visible;
  });

  if (stop.userData.textGroup && catPosition) {
    faceGroup(stop.userData.textGroup, catPosition);
  }
}

const _linkRaycaster = new THREE.Raycaster();
const _linkPointer = new THREE.Vector2();

export function pickFloatingLink(group, camera, clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  _linkPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _linkPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _linkRaycaster.setFromCamera(_linkPointer, camera);

  const targets = [];
  group.traverse((obj) => {
    if (obj.userData?.href && obj.userData.textMesh?.visible && obj.userData.textMesh.material.opacity > 0.2) {
      targets.push(obj.userData.textMesh);
    }
  });

  const hits = _linkRaycaster.intersectObjects(targets, false);
  if (!hits.length) return null;

  let panel = hits[0].object.parent;
  while (panel && !panel.userData?.href) {
    panel = panel.parent;
  }
  return panel?.userData.href ?? null;
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
    const pathFadeRange = stop.userData.pageBack ? RESUME_PATH_FADE_RANGE : PATH_FADE_RANGE;
    const ringT = stop.userData.ringT ?? stop.userData.pathT ?? 0;
    const labelT = stop.userData.pathT ?? 0;
    const ringPathFade = pathDistanceFade(catPathT, ringT, pathFadeRange);
    const labelPathFade = pathDistanceFade(catPathT, labelT, pathFadeRange);
    const pathFade = Math.max(ringPathFade, labelPathFade);

    const proximityBlend = Math.max(spatialFade, ringProximity * 0.9);
    // Path fade guides the clean approach; spatial fade still reveals labels when
    // free-roaming (mobile) walks up to a building off the path centerline.
    let textProximity = Math.max(pathFade * proximityBlend, spatialFade);
    if (ringProximity > 0.12) {
      textProximity = Math.max(textProximity, ringPathFade * ringProximity);
    }

    if (stop.userData.pageBack) {
      const resumeAhead = (stop.userData.pathT ?? 0) - catPathT;
      if (resumeAhead < 0.28) {
        ensureResumePdfLoaded(stop.userData.pageBack);
      }
    }

    applyProximity(stop, ringProximity, textProximity, elapsed, catPosition, camera, dt);
  });
}
