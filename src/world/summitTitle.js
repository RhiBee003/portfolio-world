import * as THREE from "three";

const TITLE_FONT =
  '"SF Pro Rounded", "Nunito", "Quicksand", ui-rounded, "Segoe UI", system-ui, sans-serif';

/** Grade progress 0→1 from terrain.js — climb begins after z≈-12. */
function slopeAlong(z) {
  return THREE.MathUtils.clamp((-z - 12) / 95, 0, 1);
}

function smoothstep(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Nameplate on the Cascades above the near foothills, facing the city / start.
 * Visible once the cat is about halfway up the hillside grade.
 */
export function createSummitTitle() {
  const scale = 2;
  const nameSize = 86 * scale;
  const roleSize = 44 * scale;
  const padX = 56 * scale;
  const padY = 42 * scale;
  const name = "Rhiannon Black";
  const roles = "Developer  ·  UX Designer";

  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `700 ${nameSize}px ${TITLE_FONT}`;
  const nameW = measure.measureText(name).width;
  measure.font = `600 ${roleSize}px ${TITLE_FONT}`;
  const roleW = measure.measureText(roles).width;

  const width = Math.ceil(Math.max(nameW, roleW) + padX * 2);
  const height = Math.ceil(padY * 2 + nameSize + roleSize * 1.4);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const nameY = padY + nameSize * 0.52;
  const roleY = padY + nameSize + roleSize * 0.9;

  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(36, 24, 32, 0.65)";
  ctx.lineWidth = Math.max(8, nameSize * 0.09);
  ctx.font = `700 ${nameSize}px ${TITLE_FONT}`;
  ctx.strokeText(name, width / 2, nameY);
  ctx.fillStyle = "#fff6f9";
  ctx.fillText(name, width / 2, nameY);

  ctx.lineWidth = Math.max(5, roleSize * 0.11);
  ctx.font = `600 ${roleSize}px ${TITLE_FONT}`;
  ctx.strokeText(roles, width / 2, roleY);
  ctx.fillStyle = "#f2c9d8";
  ctx.fillText(roles, width / 2, roleY);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const worldWidth = 48;
  const planeHeight = worldWidth * (height / width);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth, planeHeight),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  panel.name = "summit-title";

  // Mid Cascades front — closer/larger than the far peaks so it reads from mid-slope.
  panel.position.set(-2, 44, 56);
  panel.lookAt(-2, 16, 8);
  panel.renderOrder = 8;
  panel.frustumCulled = false;
  panel.visible = false;
  panel.userData.fade = 0;
  return panel;
}

/** Fade the mountain title in after the cat passes halfway up the city grade. */
export function animateSummitTitle(panel, catPosition, dt = 0.016) {
  if (!panel || !catPosition) return;

  const along = slopeAlong(catPosition.z);
  // Start revealing around mid-climb (~z -60); fully in by ~0.58.
  const target = smoothstep((along - 0.48) / 0.1);
  panel.userData.fade = THREE.MathUtils.lerp(
    panel.userData.fade ?? 0,
    target,
    1 - Math.exp(-4.5 * dt)
  );
  const fade = panel.userData.fade;
  panel.material.opacity = fade;
  panel.visible = fade > 0.02;
}
