import * as THREE from "three";

/** Dedicated east-perimeter line — separate from the walking path. */
export const LIGHT_RAIL_TRACK_POINTS = [
  new THREE.Vector3(34, 0, 27),
  new THREE.Vector3(34.5, 0, 10),
  new THREE.Vector3(34, 0, -8),
  new THREE.Vector3(33.5, 0, -34),
  new THREE.Vector3(33, 0, -60),
  new THREE.Vector3(33.5, 0, -86),
  new THREE.Vector3(33, 0, -112),
  new THREE.Vector3(32.5, 0, -135),
];

export function createLightRailCurve() {
  return new THREE.CatmullRomCurve3(LIGHT_RAIL_TRACK_POINTS, false, "catmullrom", 0.35);
}

export const LIGHT_RAIL_START_T = 0.02;
export const LIGHT_RAIL_END_T = 0.98;
export const LIGHT_RAIL_TRACK_Y = 0.1;
export const LIGHT_RAIL_PLATFORM_Y = 0.22;
export const LIGHT_RAIL_GUIDEWAY_WIDTH = 2.5;
export const LIGHT_RAIL_RIDE_DURATION = 28;
export const LIGHT_RAIL_PLATFORM_RADIUS = 5.5;
export const LIGHT_RAIL_BOARD_RADIUS = 5;
export const LIGHT_RAIL_APPROACH_RADIUS = 14;
export const LIGHT_RAIL_BOARD_COOLDOWN = 2.2;

/** Rails sit on the guideway; train origin is the track bed. */
export const LIGHT_RAIL_RAIL = {
  gaugeHalf: 0.78,
  topAboveBed: 0.065,
  height: 0.09,
};

export const LIGHT_RAIL_CAR = {
  /** Single Series-2–scale car (game length; real S700 ~29m). */
  length: 22.4,
  width: 2.65,
  height: 3.35,
  floorY: 0.14,
  wheelRadius: 0.24,
  wheelY: LIGHT_RAIL_RAIL.topAboveBed + 0.24,
  bogieZ: [-8.2, -2.4, 2.4, 8.2],
  platformSide: -1,
  /** Cab seat — local Z is set per travel direction; Y is feet height above track. */
  seat: {
    x: 0,
    cabinOffset: 2.35,
    y: 1.05,
  },
};

/** Seattle Link–style overhead catenary: poles east of guideway, wire centered over tracks. */
export const LIGHT_RAIL_OCS = {
  poleSpacing: 38,
  poleOffset: 2.15,
  poleHeight: 5.35,
  wireHeight: 4.75,
  skipEndT: 0.045,
};

/** Walkways from the main path out to each station (keep clear of buildings). */
export const LIGHT_RAIL_CONNECTORS = [
  { x0: 0.5, x1: 24.5, z0: 23.5, z1: 29.5, y: 0.04 },
  { x0: 0.5, x1: 24.0, z0: -137.5, z1: -131.5, y: 0.04 },
];

/** Platform centers — used to keep a walkable approach and sight-line open. */
export const LIGHT_RAIL_STATION_SITES = [
  { x: 34, z: 27 },
  { x: 33, z: -135 },
];

/** Tall signs on the main path pointing east toward the light rail. */
export const LIGHT_RAIL_PATH_SIGNS = [
  { x: 2.4, z: 26.5 },
  { x: 2.4, z: -134.5 },
];

const TRACK_EXCLUSION_RADIUS = 5.8;
const BUILDING_TRACK_CLEARANCE = 7.2;
const CONNECTOR_CLEARANCE_MARGIN = 1.4;
const BUILDING_CONNECTOR_MARGIN = 6.8;
const BUILDING_STATION_VISTA_RADIUS = 15;
const BUILDING_STATION_Z_GAP = 18;

let lightRailTrackSamples = null;

function inConnectorRect(x, z, rect, margin = 0) {
  return (
    x >= rect.x0 - margin &&
    x <= rect.x1 + margin &&
    z >= rect.z0 - margin &&
    z <= rect.z1 + margin
  );
}

export function getLightRailTrackSamples() {
  if (!lightRailTrackSamples) {
    const curve = createLightRailCurve();
    lightRailTrackSamples = [];
    for (let i = 0; i <= 80; i += 1) {
      lightRailTrackSamples.push(curve.getPointAt(i / 80));
    }
  }
  return lightRailTrackSamples;
}

export function distToLightRailTrack(x, z) {
  let min = Infinity;
  for (const p of getLightRailTrackSamples()) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < min) min = d;
  }
  return min;
}

/** Keep buildings off the track bed, platforms, and connector walkways only. */
export function isInLightRailCorridor(x, z) {
  for (const rect of LIGHT_RAIL_CONNECTORS) {
    if (inConnectorRect(x, z, rect, CONNECTOR_CLEARANCE_MARGIN)) return true;
  }
  if (distToLightRailTrack(x, z) < TRACK_EXCLUSION_RADIUS) return true;
  return false;
}

/** Open sight-line and walk space around each station platform. */
export function isInLightRailStationVista(x, z) {
  for (const site of LIGHT_RAIL_STATION_SITES) {
    if (Math.hypot(x - site.x, z - site.z) < BUILDING_STATION_VISTA_RADIUS) return true;
    if (Math.abs(z - site.z) < 9 && x < site.x + 1 && x > -4) return true;
  }
  return false;
}

export function isNearLightRailStationZ(z) {
  for (const site of LIGHT_RAIL_STATION_SITES) {
    if (Math.abs(z - site.z) < BUILDING_STATION_Z_GAP) return true;
  }
  return false;
}

/** Wider keep-out for building placement around rail walkways and guideway. */
export function blocksWalkwayAndRailStructures(x, z) {
  for (const rect of LIGHT_RAIL_CONNECTORS) {
    if (inConnectorRect(x, z, rect, BUILDING_CONNECTOR_MARGIN)) return true;
  }
  if (distToLightRailTrack(x, z) < BUILDING_TRACK_CLEARANCE) return true;
  if (isInLightRailStationVista(x, z)) return true;
  return false;
}

/** Footprint-aware check so building edges cannot encroach on station walkways. */
export function blocksWalkwayAndRailStructuresForBuilding(x, z, w, d) {
  if (blocksWalkwayAndRailStructures(x, z)) return true;
  const pad = Math.max(w, d) * 0.52;
  for (const ox of [-pad, 0, pad]) {
    for (const oz of [-pad, 0, pad]) {
      if (ox === 0 && oz === 0) continue;
      if (blocksWalkwayAndRailStructures(x + ox, z + oz)) return true;
    }
  }
  return false;
}

/** Block building placement on rail walkways, platforms, and track bed only. */
export function blocksLightRailPlacement(x, z) {
  return blocksWalkwayAndRailStructures(x, z);
}

/** Z spans along the east light-rail line — buildings only on the east/outskirts side. */
export const LIGHT_RAIL_DISTRICT = {
  zMin: -140,
  zMax: 30,
  /** Western edge of the east-side building band (just east of guideway clearance). */
  behindMinX: 41,
  /** Eastern edge at the map boundary. */
  behindMaxX: 47.5,
  /** Primary skyline row behind the guideway. */
  perimeterRowX: 42.8,
  /** Outermost backdrop row at the map edge. */
  backdropRowX: 46.8,
};

export function isInLightRailDistrictZ(z) {
  return z >= LIGHT_RAIL_DISTRICT.zMin && z <= LIGHT_RAIL_DISTRICT.zMax;
}

/** East-side building X for a row index along the light-rail corridor. */
export function getLightRailEastBuildingX(rowIndex = 0) {
  const { perimeterRowX, backdropRowX } = LIGHT_RAIL_DISTRICT;
  if (rowIndex === 0) return perimeterRowX;
  return backdropRowX;
}
