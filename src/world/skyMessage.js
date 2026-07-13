import * as THREE from "three";
import { getMoonLocalPosition } from "./skyMoon.js";
import { SPACE_NEEDLE_OBSERVATION_Y } from "./spaceNeedleConfig.js";

const FONT =
  '"SF Pro Rounded", "Nunito", "Quicksand", ui-rounded, "Segoe UI", system-ui, sans-serif';
const TEXT_COLOR = "#ffe4f0";
const GLOW_COLOR = "rgba(255, 200, 225, 0.95)";
const HEART_COLOR = "#ff9ec4";
const LOOK_DOT_START = 0.62;
const LOOK_DOT_FULL = 0.88;

const _panelWorld = new THREE.Vector3();
const _toPanel = new THREE.Vector3();
const _cameraForward = new THREE.Vector3();
const _moonPos = new THREE.Vector3();

function smoothstep(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
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

function drawHeart(ctx, cx, cy, size) {
  ctx.save();
  ctx.fillStyle = HEART_COLOR;
  ctx.beginPath();
  const s = size * 0.5;
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx, cy - s * 0.15, cx - s, cy - s * 0.55, cx - s * 0.5, cy - s * 0.15);
  ctx.bezierCurveTo(cx - s * 0.1, cy + s * 0.05, cx, cy + s * 0.25, cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx, cy + s * 0.25, cx + s * 0.1, cy + s * 0.05, cx + s * 0.5, cy - s * 0.15);
  ctx.bezierCurveTo(cx + s, cy - s * 0.55, cx, cy - s * 0.15, cx, cy + s * 0.35);
  ctx.fill();
  ctx.restore();
}

function createMessageTextures(text, options = {}) {
  const scale = 2;
  const fontSize = (options.fontSize ?? 64) * scale;
  const fontWeight = options.fontWeight ?? 700;
  const maxWidth = (options.maxWidth ?? 720) * scale;
  const padding = 36 * scale;
  const lineHeight = fontSize * 1.22;
  const heartSize = fontSize * 0.72;

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  measureCtx.font = `${fontWeight} ${fontSize}px ${FONT}`;
  const lines = wrapLines(measureCtx, text, maxWidth - padding * 2);

  let textWidth = 0;
  for (const line of lines) {
    textWidth = Math.max(textWidth, measureCtx.measureText(line).width);
  }

  const heartPad = heartSize * 1.6;
  const innerWidth = Math.ceil(textWidth + padding * 2);
  const innerHeight = Math.ceil(lines.length * lineHeight + padding * 2 + heartPad);

  const textCanvas = document.createElement("canvas");
  textCanvas.width = innerWidth;
  textCanvas.height = innerHeight;
  const textCtx = textCanvas.getContext("2d");
  textCtx.font = `${fontWeight} ${fontSize}px ${FONT}`;
  textCtx.fillStyle = TEXT_COLOR;
  textCtx.textAlign = "center";
  textCtx.textBaseline = "middle";
  lines.forEach((line, index) => {
    const y = padding + lineHeight * index + lineHeight / 2;
    textCtx.fillText(line, innerWidth / 2, y);
  });
  drawHeart(textCtx, innerWidth / 2, innerHeight - heartPad * 0.55, heartSize);

  const bleed = Math.ceil(fontSize * 2.6);
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = innerWidth + bleed * 2;
  glowCanvas.height = innerHeight + bleed * 2;
  const glowCtx = glowCanvas.getContext("2d");
  const blurPx = Math.max(10, fontSize * 0.82);
  glowCtx.filter = `blur(${blurPx}px)`;
  glowCtx.drawImage(textCanvas, bleed, bleed);
  glowCtx.filter = "none";
  glowCtx.globalCompositeOperation = "source-atop";
  glowCtx.fillStyle = GLOW_COLOR;
  glowCtx.fillRect(0, 0, glowCanvas.width, glowCanvas.height);

  const configure = (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  };

  return {
    textTexture: configure(new THREE.CanvasTexture(textCanvas)),
    glowTexture: configure(new THREE.CanvasTexture(glowCanvas)),
    width: innerWidth / scale,
    height: innerHeight / scale,
    glowScale: Math.max(glowCanvas.width / innerWidth, glowCanvas.height / innerHeight),
  };
}

function lookAtMessageFactor(camera, panel) {
  panel.getWorldPosition(_panelWorld);
  _toPanel.copy(_panelWorld).sub(camera.position);
  const dist = _toPanel.length();
  if (dist < 0.5) return 1;

  _toPanel.multiplyScalar(1 / dist);
  camera.getWorldDirection(_cameraForward);
  const dot = _cameraForward.dot(_toPanel);
  if (dot <= LOOK_DOT_START) return 0;
  return smoothstep((dot - LOOK_DOT_START) / (LOOK_DOT_FULL - LOOK_DOT_START));
}

export function createSkyThankYouMessage() {
  const text = "thank you\nfor exploring";
  const { textTexture, glowTexture, width, height, glowScale } = createMessageTextures(text, {
    fontSize: 68,
    fontWeight: 700,
  });

  const worldWidth = 52;
  const worldHeight = worldWidth * (height / width);
  const panel = new THREE.Group();
  panel.name = "sky-thank-you";

  const glowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth * glowScale, worldHeight * glowScale),
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
  glowMesh.renderOrder = -997;
  glowMesh.frustumCulled = false;

  const textMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth, worldHeight),
    new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
      opacity: 0,
      alphaTest: 0.1,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  textMesh.renderOrder = -996;
  textMesh.frustumCulled = false;

  panel.add(glowMesh, textMesh);
  panel.userData.textMesh = textMesh;
  panel.userData.glowMesh = glowMesh;
  panel.userData.fadeLevel = 0;
  panel.userData.bobPhase = Math.random() * Math.PI * 2;
  panel.frustumCulled = false;

  getMoonLocalPosition(_moonPos);
  panel.position.copy(_moonPos);
  panel.position.x += 68;
  panel.position.y -= 20;
  panel.position.z -= 6;
  panel.userData.basePosition = panel.position.clone();
  panel.lookAt(0, panel.position.y, 0);

  return panel;
}

export function animateSkyThankYouMessage(
  panel,
  { atTop, catPosition, camera, elapsed = 0, dt = 0.016 }
) {
  if (!panel || !camera) return;

  const onDeck = atTop || (catPosition && catPosition.y >= SPACE_NEEDLE_OBSERVATION_Y - 1.2);
  const lookFactor = onDeck ? lookAtMessageFactor(camera, panel) : 0;
  const targetFade = onDeck ? lookFactor : 0;

  panel.userData.fadeLevel = THREE.MathUtils.lerp(
    panel.userData.fadeLevel ?? 0,
    targetFade,
    1 - Math.exp(-5 * dt)
  );
  const fade = panel.userData.fadeLevel;

  const base = panel.userData.basePosition;
  if (base) {
    const bob = Math.sin(elapsed * 1.15 + (panel.userData.bobPhase ?? 0)) * 2.4;
    panel.position.set(base.x, base.y + bob, base.z);
  }

  panel.lookAt(camera.position);

  const breathe = 1 + Math.sin(elapsed * 1.8 + 0.4) * 0.035;
  panel.scale.setScalar(breathe);

  const textMesh = panel.userData.textMesh;
  const glowMesh = panel.userData.glowMesh;
  const visible = fade > 0.01;

  textMesh.material.opacity = fade * 0.98;
  textMesh.visible = visible;
  glowMesh.material.opacity = fade * 0.68;
  glowMesh.visible = visible;
}
