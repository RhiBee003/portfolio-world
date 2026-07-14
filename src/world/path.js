import * as THREE from "three";
import { pathSurfaceY } from "./terrain.js";

function buildRibbonGeometry(curve, width, segments) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const normal = new THREE.Vector3();
  const left = new THREE.Vector3();
  const right = new THREE.Vector3();
  const leftN = new THREE.Vector3();
  const rightN = new THREE.Vector3();

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    normal.set(-tangent.z, 0, tangent.x).normalize();

    left.copy(point).addScaledVector(normal, -width / 2);
    right.copy(point).addScaledVector(normal, width / 2);
    left.y = pathSurfaceY(left.x, left.z);
    right.y = pathSurfaceY(right.x, right.z);

    // Approx upright normal with a mild tilt from the grade between edges.
    const dy = right.y - left.y;
    leftN.set(-dy * 0.15, 1, 0).normalize();
    rightN.copy(leftN);

    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    normals.push(leftN.x, leftN.y, leftN.z, rightN.x, rightN.y, rightN.z);
    uvs.push(0, t, 1, t);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createPath(curve) {
  const group = new THREE.Group();
  const segments = 240;
  const roadWidth = 3.2;

  const roadGeo = buildRibbonGeometry(curve, roadWidth, segments);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xf5f0f3,
    roughness: 0.94,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  road.frustumCulled = false;
  group.add(road);

  return { group };
}
