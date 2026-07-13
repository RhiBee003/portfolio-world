import * as THREE from "three";

const BASE = import.meta.env.BASE_URL;

export const PROJECT_PREVIEWS = {
  whiskerwatch: {
    worldWidth: 5.6,
    y: 2.35,
    aspect: 16 / 10,
    procedural: "whiskerwatch",
  },
  "cotton-elder": {
    worldWidth: 5.6,
    y: 2.35,
    aspect: 16 / 10,
    src: `${BASE}previews/cotton-elder.jpg`,
  },
};

export function createWhiskerwatchPreviewTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#fff6fa");
  bg.addColorStop(1, "#f7dce8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(180, 90, 120, 0.18)";
  ctx.shadowBlur = 28;
  ctx.fillRect(48, 52, canvas.width - 96, canvas.height - 104);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#f3b8cc";
  ctx.fillRect(48, 52, canvas.width - 96, 72);
  ctx.fillStyle = "#ffffff";
  ctx.font = '600 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText("WhiskerWatch", 78, 102);

  ctx.fillStyle = "#2a2a2a";
  ctx.font = '700 42px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText("Daily cat care", 78, 198);
  ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = "#555";
  ctx.fillText("Breed guides · Vet records · Routines", 78, 242);

  const cards = [
    { x: 78, y: 300, label: "Vet visit", color: "#ffd8e6" },
    { x: 360, y: 300, label: "Feeding", color: "#ffe8f1" },
    { x: 642, y: 300, label: "Grooming", color: "#f8d4e3" },
  ];
  cards.forEach((card) => {
    ctx.fillStyle = card.color;
    ctx.fillRect(card.x, card.y, 220, 150);
    ctx.fillStyle = "#333";
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(card.label, card.x + 20, card.y + 42);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
