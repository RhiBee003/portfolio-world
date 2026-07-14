import * as THREE from "three";
import { buildingMaterial } from "./materials.js";
import { addBuildingWindows } from "./buildingWindows.js";
import { SPACE_NEEDLE_POSITION, SPACE_NEEDLE_VISTA, blocksSpaceNeedlePlacement, spaceNeedleBuildingPad } from "./spaceNeedleConfig.js";
import { blocksLightRailPlacement, blocksWalkwayAndRailStructuresForBuilding, LIGHT_RAIL_DISTRICT, isInLightRailDistrictZ, isNearLightRailStationZ, getLightRailEastBuildingX, getLightRailTrackSamples } from "./lightRailConfig.js";
import { PATH_POINTS, START_OVERPASS_T, getPlayerSpawnPoint, isInSpawnClearance } from "./waypoints.js";
import { WORLD_CONFIG } from "./worldConfig.js";
import { worldHeight } from "./terrain.js";

const CITY = WORLD_CONFIG.city;
const PATH_SAMPLES = 48;

let pathSampleCache = null;
let overpassFrameCache = null;

function getOverpassFrame(curve) {
  if (!overpassFrameCache) {
    const start = curve.getPointAt(START_OVERPASS_T);
    const tangent = curve.getTangentAt(START_OVERPASS_T).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    overpassFrameCache = { start, tangent, normal };
  }
  return overpassFrameCache;
}

function isInOverpassClearance(x, z, curve) {
  const { start, tangent, normal } = getOverpassFrame(curve);
  const dx = x - start.x;
  const dz = z - start.z;
  const along = dx * tangent.x + dz * tangent.z;
  const across = dx * normal.x + dz * normal.z;
  return Math.abs(along) <= 10.5 && Math.abs(across) <= 6.5;
}

function getPathSamples(curve) {
  if (!pathSampleCache) {
    pathSampleCache = [];
    for (let i = 0; i <= PATH_SAMPLES; i += 1) {
      pathSampleCache.push(curve.getPoint(i / PATH_SAMPLES));
    }
  }
  return pathSampleCache;
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function distToPath(x, z, curve) {
  const samples = getPathSamples(curve);
  let min = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const p = samples[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < min) min = d;
  }
  return Math.sqrt(min);
}

async function addBuildingBatched(group, collisions, x, z, w, d, h, rotY, tone, batch, withCollision = true) {
  addBuilding(group, collisions, x, z, w, d, h, rotY, tone, withCollision);
  batch.count += 1;
  if (batch.count % batch.size === 0) {
    batch.onProgress?.(batch.count, batch.total);
    await waitFrame();
  }
}

function pushCollision(collisions, x, z, w, d, h, rotY, baseY = 0) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  collisions.push({
    cx: x,
    cz: z,
    hx: w / 2 + 0.3,
    hz: d / 2 + 0.3,
    cos,
    sin,
    minY: baseY,
    maxY: baseY + h + 1,
  });
}

function addBuilding(group, collisions, x, z, w, d, h, rotY, tone, withCollision = true) {
  if (blocksSpaceNeedlePlacement(x, z, spaceNeedleBuildingPad(w, d))) return;

  const baseY = worldHeight(x, z);
  const building = new THREE.Group();
  // Upright on the grade — only yaw, never pitch/roll with the hill.
  building.position.set(x, baseY + h / 2, z);
  building.rotation.y = rotY;

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMaterial(tone));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  building.add(mesh);

  addBuildingWindows(building, w, d, h, Math.round(x * 19 + z * 37 + h * 3));

  if (h > 10) {
    const bands = Math.floor(h / 2.4);
    for (let b = 1; b < bands; b += 1) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.02, 0.14, d * 1.02),
        buildingMaterial("dark")
      );
      band.position.y = b * 2.2 - h / 2;
      building.add(band);
    }
  }

  group.add(building);

  if (withCollision) {
    pushCollision(collisions, x, z, w, d, h, rotY, baseY);
  }
}

function addBackdropBuilding(group, x, z, w, d, h, rotY, tone) {
  addBuilding(group, null, x, z, w, d, h, rotY, tone, false);
}

async function addBackdropBatched(group, x, z, w, d, h, rotY, tone, batch) {
  addBackdropBuilding(group, x, z, w, d, h, rotY, tone);
  batch.count += 1;
  if (batch.count % batch.size === 0) {
    batch.onProgress?.(batch.count, batch.total);
    await waitFrame();
  }
}

function distPointToSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const abLenSq = abx * abx + abz * abz;
  let t = abLenSq > 0 ? (apx * abx + apz * abz) / abLenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cz = az + t * abz;
  const dx = px - cx;
  const dz = pz - cz;
  return Math.sqrt(dx * dx + dz * dz);
}

function getVistaPlacement(x, z) {
  const { pathAnchor, clearRadius, shortBand, zMin, zMax, eastBound } = SPACE_NEEDLE_VISTA;
  if (z > zMax || z < zMin || x > eastBound) return null;

  const dist = distPointToSegment(
    x,
    z,
    pathAnchor.x,
    pathAnchor.z,
    SPACE_NEEDLE_POSITION.x,
    SPACE_NEEDLE_POSITION.z
  );

  if (dist < clearRadius) return { mode: "skip" };
  if (dist < shortBand) return { mode: "short" };
  return null;
}

function resolveBuildingHeight(x, z, minH, maxH, rand) {
  const vista = getVistaPlacement(x, z);
  if (vista?.mode === "skip") return null;
  if (vista?.mode === "short") {
    const { shortMinHeight, shortMaxHeight } = SPACE_NEEDLE_VISTA;
    return shortMinHeight + rand() * (shortMaxHeight - shortMinHeight);
  }
  return minH + rand() * (maxH - minH);
}

const NEEDLE_PLACEMENT_PAD = 8;

function minPathClearance(w = 0, d = 0) {
  const pad = Math.max(w, d) * 0.22;
  return CITY.walkwayClearance + pad;
}

function canPlaceBuilding(x, z, curve, spawn, collisions, w, d) {
  if (checkCollision(x, z, buildingFootprintRadius(w, d), collisions)) return false;
  if (distToPath(x, z, curve) < minPathClearance(w, d)) return false;
  if (blocksWalkwayAndRailStructuresForBuilding(x, z, w, d)) return false;
  if (shouldSkipProceduralSpot(x, z, spawn, curve)) return false;
  return true;
}

/** Map-edge skyline — skips interior overpass keep-outs but not the structure volume. */
function canPlacePerimeterEdgeBuilding(x, z, curve, spawn, collisions, w, d) {
  if (checkCollision(x, z, buildingFootprintRadius(w, d), collisions)) return false;
  if (distToPath(x, z, curve) < CITY.perimeterPathClearance) return false;
  if (blocksWalkwayAndRailStructuresForBuilding(x, z, w, d)) return false;
  if (isInSpawnClearance(x, z, spawn)) return false;
  if (curve && isInOverpassClearance(x, z, curve)) return false;
  if (blocksSpaceNeedlePlacement(x, z, NEEDLE_PLACEMENT_PAD)) return false;
  if (blocksLightRailPlacement(x, z)) return false;
  if (getVistaPlacement(x, z)?.mode === "skip") return false;
  return true;
}

function canPlaceOverpassFlank(x, z, curve, spawn, collisions, w, d) {
  if (checkCollision(x, z, buildingFootprintRadius(w, d), collisions)) return false;
  if (isInOverpassClearance(x, z, curve)) return false;
  if (distToPath(x, z, curve) < minPathClearance(w, d)) return false;
  if (isInSpawnClearance(x, z, spawn)) return false;
  if (blocksSpaceNeedlePlacement(x, z, NEEDLE_PLACEMENT_PAD)) return false;
  if (blocksWalkwayAndRailStructuresForBuilding(x, z, w, d)) return false;
  if (blocksLightRailPlacement(x, z)) return false;
  return true;
}

function shouldSkipProceduralSpot(x, z, spawn, curve) {
  const absX = Math.abs(x);
  const { overpassFlank, startCorridor, midCorridor, endPlaza, overpassExclusion } = CITY;

  if (isInSpawnClearance(x, z, spawn)) return true;
  if (getVistaPlacement(x, z)?.mode === "skip") return true;
  if (blocksSpaceNeedlePlacement(x, z, NEEDLE_PLACEMENT_PAD)) return true;
  if (curve && isInOverpassClearance(x, z, curve)) return true;
  if (z > overpassFlank.zMin && z < overpassFlank.zMax && x < overpassFlank.xMax) return true;
  if (z > overpassExclusion.zMin && z < overpassExclusion.zMax && absX > overpassExclusion.absXMin && absX < overpassExclusion.absXMax) {
    return true;
  }
  if (z > startCorridor.zMin && absX < startCorridor.absXMax) return true;
  if (z > midCorridor.zMin && absX < midCorridor.absXMax) return true;
  if (z < endPlaza.zMax && absX < endPlaza.absXMax) return true;
  if (blocksLightRailPlacement(x, z)) return true;

  return false;
}

async function createPerimeterBuildings(group, collisions, curve, bounds, rand, spawn, batch) {
  const { perimeterSpacing, perimeterInset, perimeterPathClearance, perimeterRows, overpassFlank } = CITY;
  const rowGap = 3.8;
  const rowStagger = 2.2;

  async function tryPlace(x, z, rotY, minH = 18, maxH = 30) {
    const w = 5 + rand() * 4;
    const d = 5 + rand() * 4;
    if (!canPlaceBuilding(x, z, curve, spawn, collisions, w, d)) return false;
    if (isInOverpassClearance(x, z, curve)) return false;
    if (z > overpassFlank.zMin && z < overpassFlank.zMax && x < overpassFlank.xMax) return false;

    const h = resolveBuildingHeight(x, z, minH, maxH, rand);
    if (h === null) return false;

    const tone = rand() > 0.5 ? "dark" : "mid";
    await addBuildingBatched(group, collisions, x, z, w, d, h, rotY, tone, batch);
    return true;
  }

  for (let x = bounds.xMin + 5; x <= bounds.xMax - 5; x += perimeterSpacing) {
    for (let row = 0; row < perimeterRows; row += 1) {
      const z = bounds.zMax - perimeterInset - row * rowGap;
      await tryPlace(x + row * rowStagger, z, 0);
    }
  }

  for (let x = bounds.xMin + 5; x <= bounds.xMax - 5; x += perimeterSpacing) {
    for (let row = 0; row < perimeterRows; row += 1) {
      const z = bounds.zMin + perimeterInset + row * rowGap;
      await tryPlace(x + perimeterSpacing * 0.5 + row * rowStagger, z, Math.PI);
    }
  }

  for (let z = bounds.zMin + 12; z <= bounds.zMax - 12; z += perimeterSpacing) {
    for (let row = 0; row < perimeterRows; row += 1) {
      const x = bounds.xMin + perimeterInset + row * rowGap;
      await tryPlace(x, z + row * rowStagger, Math.PI / 2);
    }
  }

  for (let z = bounds.zMin + 12; z <= bounds.zMax - 12; z += perimeterSpacing) {
    for (let row = 0; row < perimeterRows; row += 1) {
      const x = isInLightRailDistrictZ(z)
        ? getLightRailEastBuildingX(row)
        : bounds.xMax - perimeterInset - row * rowGap;
      if (isInLightRailDistrictZ(z) && row > 0) continue;
      await tryPlace(x, z + row * rowStagger, -Math.PI / 2);
    }
  }
}

/** North + west perimeter skyline around the start overpass (interior keep-outs block normal placement). */
async function createOverpassPerimeterSkyline(group, collisions, curve, bounds, rand, spawn, batch) {
  const { perimeterInset, overpassFlank } = CITY;
  const northZ = bounds.zMax - perimeterInset;
  const westX = bounds.xMin + perimeterInset;
  const spacing = 7.5;

  async function tryEdgeSkyline(x, z, rotY, minH = 16, maxH = 28) {
    const w = 5 + rand() * 3.5;
    const d = 5 + rand() * 3.5;
    if (!canPlacePerimeterEdgeBuilding(x, z, curve, spawn, collisions, w, d)) return false;

    const h = resolveBuildingHeight(x, z, minH, maxH, rand);
    if (h === null) return false;

    const tone = rand() > 0.48 ? "dark" : "mid";
    await addBuildingBatched(group, collisions, x, z, w, d, h, rotY, tone, batch);
    return true;
  }

  for (let x = bounds.xMin + 4; x <= bounds.xMax - 4; x += spacing) {
    if (isInLightRailDistrictZ(northZ) && x > LIGHT_RAIL_DISTRICT.behindMinX - 2) continue;
    await tryEdgeSkyline(x + rand() * 1.5, northZ + rand() * 0.6, 0);
  }

  for (let z = overpassFlank.zMin; z <= overpassFlank.zMax + 2; z += spacing) {
    await tryEdgeSkyline(westX + rand() * 0.8, z + rand() * 1.2, Math.PI / 2);
  }
}

/** Buildings flanking both sides of the start overpass (along the span, offset from deck). */
async function createOverpassFlankBuildings(group, collisions, curve, rand, spawn, batch) {
  const { start, tangent, normal } = getOverpassFrame(curve);
  const yaw = Math.atan2(tangent.x, tangent.z);
  const alongSteps = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
  const sideOffsets = [8.5, 10.5, 12.5, 14.5];

  async function tryFlank(x, z, rotY, minH = 14, maxH = 26) {
    const w = 4.2 + rand() * 3.2;
    const d = 4 + rand() * 2.8;
    if (!canPlaceOverpassFlank(x, z, curve, spawn, collisions, w, d)) return false;

    const h = resolveBuildingHeight(x, z, minH, maxH, rand);
    if (h === null) return false;

    const tone = rand() > 0.45 ? "dark" : rand() > 0.5 ? "mid" : "light";
    await addBuildingBatched(group, collisions, x, z, w, d, h, rotY, tone, batch);
    return true;
  }

  for (const along of alongSteps) {
    const baseX = start.x + tangent.x * along;
    const baseZ = start.z + tangent.z * along;

    for (const side of [-1, 1]) {
      for (const offset of sideOffsets) {
        const x = baseX + normal.x * offset * side;
        const z = baseZ + normal.z * offset * side;
        await tryFlank(x, z, yaw + (rand() - 0.5) * 0.2);
      }
    }
  }
}

async function createPathFlankBuildings(group, collisions, curve, rand, spawn, batch) {
  const step = 0.075;
  const startFlankT = 0.28;

  for (let t = startFlankT; t <= 0.93; t += step) {
    if (t < START_OVERPASS_T + 0.05) continue;

    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const yaw = Math.atan2(tangent.x, tangent.z);

    for (const side of [-1, 1]) {
      const inLrDistrict = isInLightRailDistrictZ(center.z);
      const nearStation = isNearLightRailStationZ(center.z);
      if (inLrDistrict && nearStation && side === 1) continue;

      let offset;
      if (inLrDistrict) {
        offset = nearStation
          ? (side === -1 ? 17 + rand() * 5 : 9 + rand() * 4)
          : (side === 1 ? 9 + rand() * 4 : 11 + rand() * 4);
      } else {
        offset = 10.5 + rand() * 4;
      }
      const x = center.x + normal.x * offset * side;
      const z = center.z + normal.z * offset * side;

      const w = 4.2 + rand() * 3.2;
      const d = 4 + rand() * 2.8;
      if (!canPlaceBuilding(x, z, curve, spawn, collisions, w, d)) continue;

      const vista = getVistaPlacement(x, z);
      if (vista?.mode === "skip") continue;

      const h = resolveBuildingHeight(x, z, 13, 26, rand);
      if (h === null) continue;
      const tone = rand() > 0.42 ? "dark" : rand() > 0.5 ? "mid" : "light";
      const rotY = yaw + (rand() - 0.5) * 0.28;

      await addBuildingBatched(group, collisions, x, z, w, d, h, rotY, tone, batch);
    }
  }
}

async function createLightRailDistrict(group, collisions, curve, rand, spawn, batch) {
  const { zMin, zMax, behindMinX, behindMaxX, perimeterRowX } = LIGHT_RAIL_DISTRICT;

  async function tryPlaceBehind(x, z, minH, maxH, rotY = 0) {
    if (x < behindMinX - 0.5 || x > behindMaxX + 1.5) return false;

    const w = 4.5 + rand() * 4;
    const d = 4 + rand() * 3.5;
    if (!canPlaceBuilding(x, z, curve, spawn, collisions, w, d)) return false;

    const h = minH + rand() * (maxH - minH);
    const tone = rand() > 0.45 ? "dark" : rand() > 0.5 ? "mid" : "light";
    await addBuildingBatched(group, collisions, x, z, w, d, h, rotY + (rand() - 0.5) * 0.2, tone, batch);
    return true;
  }

  const stationAnchors = [
    { x: perimeterRowX, z: -135 },
    { x: behindMaxX - 0.4, z: -138 },
  ];

  for (const anchor of stationAnchors) {
    await tryPlaceBehind(anchor.x, anchor.z, 17, 26, -Math.PI / 2);
    await tryPlaceBehind(anchor.x + 0.6, anchor.z + (anchor.z > 0 ? 5 : -5), 14, 22, -Math.PI / 2);
  }

  for (let z = zMax; z >= zMin; z -= 8 + rand() * 3) {
    if (isNearLightRailStationZ(z)) continue;
    await tryPlaceBehind(perimeterRowX + rand() * 0.4, z + rand() * 2 - 1, 18, 30, -Math.PI / 2);
    await tryPlaceBehind(
      behindMinX + rand() * (behindMaxX - behindMinX) * 0.55,
      z + rand() * 3 - 1.5,
      14,
      26,
      -Math.PI / 2
    );
    await tryPlaceBehind(
      behindMinX + 0.4 + rand() * 1.2,
      z + rand() * 2.5 - 1.2,
      12,
      22,
      -Math.PI / 2
    );
    if (rand() > 0.35) {
      await tryPlaceBehind(behindMaxX - rand() * 0.5, z + rand() * 4 - 2, 12, 22, -Math.PI / 2);
    }
  }
}

/** Tight rows along both sides of the guideway to close empty pockets beside the light rail. */
async function createLightRailCorridorFill(group, collisions, curve, rand, spawn, batch) {
  const samples = getLightRailTrackSamples();
  const eastOffsets = [7.8, 9.8, 11.8, 13.8];
  const westOffsets = [7.8, 10.2, 12.8, 15.5];

  for (let i = 0; i < samples.length; i += 2) {
    const p = samples[i];
    const jz = (rand() - 0.5) * 2.2;
    const nearStation = isNearLightRailStationZ(p.z);

    for (const east of eastOffsets) {
      if (nearStation && east < 10.5) continue;
      await tryInfillPlace(group, collisions, p.x + east, p.z + jz, curve, spawn, rand, batch, {
        minH: 12,
        maxH: 26,
        rotY: -Math.PI / 2 + (rand() - 0.5) * 0.15,
      });
    }

    if (nearStation) continue;

    for (const west of westOffsets) {
      await tryInfillPlace(group, collisions, p.x - west, p.z + jz, curve, spawn, rand, batch, {
        minH: 11,
        maxH: 24,
        rotY: Math.PI / 2 + (rand() - 0.5) * 0.15,
      });
    }
  }
}

async function createOutskirtsFlank(group, collisions, curve, bounds, rand, spawn, batch) {
  const inset = CITY.perimeterInset + 5.5;
  const spacing = () => 10 + rand() * 5;

  async function tryFlank(x, z, rotY, minH, maxH) {
    const w = 5 + rand() * 4;
    const d = 5 + rand() * 4;
    if (!canPlaceBuilding(x, z, curve, spawn, collisions, w, d)) return;
    if (isInOverpassClearance(x, z, curve)) return;

    const h = resolveBuildingHeight(x, z, minH, maxH, rand);
    if (h === null) return;

    const tone = rand() > 0.5 ? "dark" : "mid";
    await addBuildingBatched(group, collisions, x, z, w, d, h, rotY, tone, batch);
  }

  for (let x = bounds.xMin + inset; x <= bounds.xMax - inset; x += spacing()) {
    await tryFlank(x + rand() * 2, bounds.zMax - inset - rand() * 2, 0, 14, 24);
    if (rand() > 0.58) {
      await tryFlank(x + rand() * 3, bounds.zMin + inset + rand() * 2, Math.PI, 14, 24);
    }
  }

  for (let z = bounds.zMin + 14; z <= bounds.zMax - 14; z += spacing()) {
    await tryFlank(bounds.xMin + inset + rand() * 2, z + rand() * 2, Math.PI / 2, 14, 24);
    if (rand() > 0.58 && !isInLightRailDistrictZ(z)) {
      await tryFlank(bounds.xMax - inset - rand() * 2, z + rand() * 3, -Math.PI / 2, 14, 24);
    }
  }
}

async function createMapEdgeBackdrop(group, bounds, curve, rand, spawn, batch) {
  const rowCount = 1;
  const rowGap = 4.8;
  const edgeSpacing = () => 13 + rand() * 6;
  const jitter = () => rand() * 2.5;
  const { backdropRowX } = LIGHT_RAIL_DISTRICT;

  async function tryEdgeBackdrop(x, z, rotY, minH = 20, maxH = 34) {
    if (isInSpawnClearance(x, z, spawn)) return;
    if (isInOverpassClearance(x, z, curve)) return;
    if (blocksSpaceNeedlePlacement(x, z, NEEDLE_PLACEMENT_PAD)) return;
    if (blocksLightRailPlacement(x, z)) return;
    const w = 5 + rand() * 5;
    const d = 4 + rand() * 4;
    const h = minH + rand() * (maxH - minH);
    const tone = rand() > 0.35 ? "dark" : "mid";
    await addBackdropBatched(group, x, z, w, d, h, rotY, tone, batch);
  }

  for (let row = 0; row < rowCount; row += 1) {
    for (let z = bounds.zMin + 2; z <= bounds.zMax - 2; z += edgeSpacing()) {
      const x = isInLightRailDistrictZ(z)
        ? backdropRowX - row * 1.1
        : bounds.xMax - 0.5 - row * rowGap;
      await tryEdgeBackdrop(x, z + jitter(), -Math.PI / 2);
    }
  }

  for (let row = 0; row < rowCount; row += 1) {
    const x = bounds.xMin + 0.5 + row * rowGap;
    for (let z = bounds.zMin + 2; z <= bounds.zMax - 2; z += edgeSpacing()) {
      await tryEdgeBackdrop(x, z + jitter(), Math.PI / 2);
    }
  }

  for (let row = 0; row < rowCount; row += 1) {
    const z = bounds.zMin + 1 + row * rowGap;
    for (let x = bounds.xMin + 3; x <= bounds.xMax + 2; x += edgeSpacing()) {
      await tryEdgeBackdrop(x + jitter(), z, Math.PI);
    }
  }

  for (let row = 0; row < rowCount; row += 1) {
    const z = bounds.zMax - 1 - row * rowGap;
    for (let x = bounds.xMin + 3; x <= bounds.xMax + 1; x += edgeSpacing()) {
      await tryEdgeBackdrop(x + jitter(), z, 0);
    }
  }
}

async function createVistaLowRise(group, collisions, curve, rand, spawn, batch) {
  const { pathAnchor } = SPACE_NEEDLE_VISTA;
  const needle = SPACE_NEEDLE_POSITION;
  const dirX = needle.x - pathAnchor.x;
  const dirZ = needle.z - pathAnchor.z;
  const len = Math.hypot(dirX, dirZ) || 1;
  const nx = -dirZ / len;
  const nz = dirX / len;

  for (let t = 0.14; t <= 0.92; t += 0.11) {
    const px = pathAnchor.x + dirX * t;
    const pz = pathAnchor.z + dirZ * t;

    for (const side of [-1, 1]) {
      const offset = 12 + rand() * 4;
      const x = px + nx * offset * side;
      const z = pz + nz * offset * side;
      if (isInSpawnClearance(x, z, spawn)) continue;
      if (isInOverpassClearance(x, z, curve)) continue;

      const w = 3.4 + rand() * 2.4;
      const d = 3.2 + rand() * 2;
      if (!canPlaceBuilding(x, z, curve, spawn, collisions, w, d)) continue;
      const vista = getVistaPlacement(x, z);
      if (!vista || vista.mode !== "short") continue;
      const h = resolveBuildingHeight(x, z, 4.2, 7.5, rand);
      if (h === null) continue;
      const tone = rand() > 0.5 ? "light" : "mid";
      const rotY = Math.atan2(dirX, dirZ) + (rand() - 0.5) * 0.4;

      await addBuildingBatched(group, collisions, x, z, w, d, h, rotY, tone, batch);
    }
  }
}

function buildingFootprintRadius(w, d) {
  return Math.hypot(w, d) * 0.38 + 1.5;
}

async function tryInfillPlace(group, collisions, x, z, curve, spawn, rand, batch, options = {}) {
  const w = options.w ?? 3.5 + rand() * 3.5;
  const d = options.d ?? 3.2 + rand() * 3;
  const minH = options.minH ?? 8;
  const maxH = options.maxH ?? 22;
  if (!canPlaceBuilding(x, z, curve, spawn, collisions, w, d)) return false;

  const h = resolveBuildingHeight(x, z, minH, maxH, rand);
  if (h === null) return false;

  const tone = rand() > 0.5 ? "dark" : rand() > 0.45 ? "mid" : "light";
  const rotY = options.rotY ?? (rand() - 0.5) * 0.4;
  await addBuildingBatched(group, collisions, x, z, w, d, h, rotY, tone, batch);
  return true;
}

/** Fill open pockets away from walkways — collision-checked, path-buffered. */
async function createSmartInfill(group, collisions, curve, bounds, rand, spawn, batch) {
  const { behindMinX, behindMaxX, perimeterRowX } = LIGHT_RAIL_DISTRICT;

  for (let t = 0.06; t <= 0.95; t += 0.034) {
    const center = curve.getPointAt(t);
    if (!isInLightRailDistrictZ(center.z)) continue;
    if (isNearLightRailStationZ(center.z)) continue;

    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const yaw = Math.atan2(tangent.x, tangent.z);

    for (const offset of [10, 13, 16, 20, 24]) {
      const x = center.x - normal.x * offset;
      const z = center.z - normal.z * offset;
      await tryInfillPlace(group, collisions, x, z, curve, spawn, rand, batch, {
        minH: 10,
        maxH: 24,
        rotY: yaw + (rand() - 0.5) * 0.25,
      });
    }
  }

  for (let z = LIGHT_RAIL_DISTRICT.zMin + 4; z <= LIGHT_RAIL_DISTRICT.zMax - 4; z += 7) {
    if (isNearLightRailStationZ(z)) continue;
    for (const x of [behindMinX + 0.4, behindMinX + 1.6, perimeterRowX, behindMaxX - 1.2, behindMaxX - 0.4]) {
      await tryInfillPlace(group, collisions, x + (rand() - 0.5) * 1.4, z + (rand() - 0.5) * 2.5, curve, spawn, rand, batch, {
        minH: 14,
        maxH: 28,
        rotY: -Math.PI / 2 + (rand() - 0.5) * 0.2,
      });
    }
  }

  const cell = 9;
  for (let x = bounds.xMin + 8; x <= bounds.xMax - 8; x += cell) {
    for (let z = bounds.zMin + 10; z <= bounds.zMax - 8; z += cell) {
      if (isInLightRailDistrictZ(z) && x > behindMinX - 3) continue;

      const jx = x + (rand() - 0.5) * 3.5;
      const jz = z + (rand() - 0.5) * 3.5;
      if (distToPath(jx, jz, curve) < CITY.walkwayClearance + 1) continue;

      await tryInfillPlace(group, collisions, jx, jz, curve, spawn, rand, batch, {
        minH: 8,
        maxH: 20,
      });
    }
  }

  for (let t = 0.15; t <= 0.9; t += 0.085) {
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const yaw = Math.atan2(tangent.x, tangent.z);

    if (isInLightRailDistrictZ(center.z)) continue;

    for (const side of [-1, 1]) {
      for (const offset of [11.5, 14.5, 17.5]) {
        const x = center.x + normal.x * offset * side;
        const z = center.z + normal.z * offset * side;
        await tryInfillPlace(group, collisions, x, z, curve, spawn, rand, batch, {
          minH: 9,
          maxH: 22,
          rotY: yaw + (rand() - 0.5) * 0.3,
        });
      }
    }
  }
}

function collectProceduralSpots(curve, spawn, rand) {
  const bounds = CITY.bounds;
  const spots = [];

  let attempts = 0;
  while (spots.length < CITY.proceduralCount && attempts < CITY.maxPlacementAttempts) {
    attempts += 1;
    const x = bounds.xMin + rand() * (bounds.xMax - bounds.xMin);
    const z = bounds.zMin + rand() * (bounds.zMax - bounds.zMin);

    if (distToPath(x, z, curve) < CITY.pathClearance) continue;
    if (shouldSkipProceduralSpot(x, z, spawn, curve)) continue;

    const distEdgeX = Math.min(x - bounds.xMin, bounds.xMax - x);
    const distEdgeZ = Math.min(z - bounds.zMin, bounds.zMax - z);
    if (distEdgeX < CITY.edgePadding || distEdgeZ < CITY.edgePadding) continue;

    const w = 2.2 + rand() * 3.8;
    const d = 2.2 + rand() * 3.8;
    if (blocksSpaceNeedlePlacement(x, z, spaceNeedleBuildingPad(w, d))) continue;

    const h = resolveBuildingHeight(x, z, 4, 20, rand);
    if (h === null) continue;
    const tone = rand() > 0.55 ? "dark" : rand() > 0.5 ? "mid" : "light";
    const rotY = (rand() - 0.5) * 0.35;

    const dx = x - spawn.x;
    const dz = z - spawn.z;
    spots.push({ x, z, w, d, h, rotY, tone, distSq: dx * dx + dz * dz });
  }

  spots.sort((a, b) => a.distSq - b.distSq);
  return spots;
}

export async function createCityAsync(curve, options = {}) {
  pathSampleCache = null;
  overpassFrameCache = null;
  const group = new THREE.Group();
  const collisions = [];
  const bounds = CITY.bounds;
  const spawn = getPlayerSpawnPoint(curve);
  const proceduralSpots = collectProceduralSpots(curve, spawn, seededRandom(42));
  const batch = {
    count: 0,
    size: options.batchSize ?? 5,
    total: proceduralSpots.length + 460,
    onProgress: options.onProgress,
  };

  await createPathFlankBuildings(group, collisions, curve, seededRandom(19), spawn, batch);
  await createPerimeterBuildings(group, collisions, curve, bounds, seededRandom(7), spawn, batch);
  await createOverpassFlankBuildings(group, collisions, curve, seededRandom(17), spawn, batch);
  await createOverpassPerimeterSkyline(group, collisions, curve, bounds, seededRandom(23), spawn, batch);
  await createLightRailDistrict(group, collisions, curve, seededRandom(31), spawn, batch);
  await createLightRailCorridorFill(group, collisions, curve, seededRandom(37), spawn, batch);
  await createVistaLowRise(group, collisions, curve, seededRandom(11), spawn, batch);

  for (const spot of proceduralSpots) {
    if (!canPlaceBuilding(spot.x, spot.z, curve, spawn, collisions, spot.w, spot.d)) continue;
    await addBuildingBatched(group, collisions, spot.x, spot.z, spot.w, spot.d, spot.h, spot.rotY, spot.tone, batch);
  }

  await createSmartInfill(group, collisions, curve, bounds, seededRandom(61), spawn, batch);

  await createOutskirtsFlank(group, collisions, curve, bounds, seededRandom(47), spawn, batch);
  await createMapEdgeBackdrop(group, bounds, curve, seededRandom(53), spawn, batch);
  batch.onProgress?.(batch.total, batch.total);

  return { group, collisions };
}

export function createGround() {
  const geo = new THREE.PlaneGeometry(200, 220, 96, 108);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const groundZ = -60;
  const colors = new Float32Array(pos.count * 3);
  const low = new THREE.Color(0xf2eef2);
  const high = new THREE.Color(0xd8d2ce);
  const shade = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + groundZ;
    const h = worldHeight(x, z);
    pos.setY(i, h);

    // Tint by elevation so the slope reads even under soft light / fog.
    const t = THREE.MathUtils.clamp(h / 36, 0, 1);
    shade.copy(low).lerp(high, t);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.97,
    metalness: 0,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.position.set(0, 0, groundZ);
  ground.receiveShadow = true;
  ground.frustumCulled = false;
  return ground;
}

export function createPathCurve() {
  return new THREE.CatmullRomCurve3(PATH_POINTS, false, "catmullrom", 0.42);
}

export function checkCollision(x, z, radius, collisions) {
  for (const box of collisions) {
    const dx = x - box.cx;
    const dz = z - box.cz;
    const localX = dx * box.cos + dz * box.sin;
    const localZ = -dx * box.sin + dz * box.cos;
    if (Math.abs(localX) < box.hx + radius && Math.abs(localZ) < box.hz + radius) {
      return true;
    }
  }
  return false;
}
