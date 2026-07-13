import * as THREE from "three";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { RESUME_PDF_SRC } from "./resume.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const RESUME_PAGE_ASPECT = 612 / 792;
/** ~perimeter building height (16–28) with a little extra for readability at cat level */
export const RESUME_PAGE_HEIGHT = 21;
export const RESUME_PAGE_WIDTH = RESUME_PAGE_HEIGHT * RESUME_PAGE_ASPECT;
export const RESUME_CENTER_Y = RESUME_PAGE_HEIGHT * 0.5;

function cropCanvasToContent(sourceCanvas, threshold = 248) {
  const ctx = sourceCanvas.getContext("2d");
  const { width, height } = sourceCanvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < threshold || g < threshold || b < threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return { canvas: sourceCanvas, aspect: width / height };
  }

  const pad = Math.round(Math.min(width, height) * 0.01);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = document.createElement("canvas");
  cropped.width = cropW;
  cropped.height = cropH;
  cropped.getContext("2d").drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  return { canvas: cropped, aspect: cropW / cropH };
}

function resizeResumeMeshes(group, pageWidth, aspect) {
  const pageHeight = pageWidth / aspect;
  const centerY = pageHeight * 0.5;
  const { pageMesh, frameMesh, shadowMesh } = group.userData;

  pageMesh.geometry.dispose();
  pageMesh.geometry = new THREE.PlaneGeometry(pageWidth, pageHeight);

  frameMesh.geometry.dispose();
  frameMesh.geometry = new THREE.PlaneGeometry(pageWidth + 0.12, pageHeight + 0.12);

  shadowMesh.geometry.dispose();
  shadowMesh.geometry = new THREE.PlaneGeometry(pageWidth * 1.02, pageHeight * 1.02);

  group.position.y = centerY;
  group.userData.baseY = centerY;
}

export async function loadResumePdfTexture(pdfUrl = RESUME_PDF_SRC) {
  const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 4 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  const { canvas: cropped, aspect } = cropCanvasToContent(canvas);
  const texture = new THREE.CanvasTexture(cropped);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return { texture, aspect };
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
    .then(({ texture, aspect }) => {
      page.material.map = texture;
      page.material.needsUpdate = true;
      resizeResumeMeshes(group, pageWidth, aspect);
    })
    .catch((err) => {
      console.error("Failed to load resume PDF texture", err);
    });

  return group;
}
