import * as THREE from "three";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { RESUME_PDF_SRC } from "./resume.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const RESUME_ASPECT = 1224 / 1584;
export const RESUME_PAGE_WIDTH = 16.5;
export const RESUME_PAGE_HEIGHT = RESUME_PAGE_WIDTH / RESUME_ASPECT;
export const RESUME_CENTER_Y = RESUME_PAGE_HEIGHT * 0.52;

export async function loadResumePdfTexture(pdfUrl = RESUME_PDF_SRC) {
  const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 3.2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function createResumePdfPage(phaseSeed, pdfUrl = RESUME_PDF_SRC) {
  const pageWidth = RESUME_PAGE_WIDTH;
  const pageHeight = RESUME_PAGE_HEIGHT;
  const centerY = RESUME_CENTER_Y;
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(pageWidth * 1.02, pageHeight * 1.02),
    new THREE.MeshBasicMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  shadow.position.set(0.14, -0.1, -0.1);
  shadow.renderOrder = 5;

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(pageWidth + 0.12, pageHeight + 0.12),
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
  frame.renderOrder = 5;
  frame.position.z = -0.05;

  const page = new THREE.Mesh(
    new THREE.PlaneGeometry(pageWidth, pageHeight),
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
  page.renderOrder = 6;
  page.position.z = -0.02;

  group.add(shadow);
  group.add(frame);
  group.add(page);
  group.position.y = centerY;
  group.userData.baseY = centerY;
  group.userData.pageMesh = page;
  group.userData.frameMesh = frame;
  group.userData.shadowMesh = shadow;
  group.userData.phase = phaseSeed;
  group.userData.freq = 0.38;
  group.userData.drift = 0.018;

  loadResumePdfTexture(pdfUrl)
    .then((texture) => {
      page.material.map = texture;
      page.material.needsUpdate = true;
    })
    .catch((err) => {
      console.error("Failed to load resume PDF texture", err);
    });

  return group;
}
