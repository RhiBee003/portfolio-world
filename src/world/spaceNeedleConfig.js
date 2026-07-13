/** Shared Space Needle layout — keep free of geometry imports to avoid circular deps. */
const HEIGHT = 52;
const DECK_HEIGHT = (520 / 605) * HEIGHT;

export const SPACE_NEEDLE_DECK_Y = DECK_HEIGHT;
export const SPACE_NEEDLE_OBSERVATION_Y = DECK_HEIGHT + 1.12;
export const SPACE_NEEDLE_CAR_FLOOR_Y = 0.95;
/** Thickness of the car floor slab (mesh height); walk surface is floorY + this. */
export const SPACE_NEEDLE_CAR_FLOOR_THICKNESS = 0.1;
/** Walkable top of the elevator car floor mesh at ground. */
export const SPACE_NEEDLE_CAR_WALK_Y = SPACE_NEEDLE_CAR_FLOOR_Y + SPACE_NEEDLE_CAR_FLOOR_THICKNESS;
/** Car group Y at the observation level so the floor top sits flush with the deck. */
export const SPACE_NEEDLE_CAR_TOP_FLOOR_Y =
  SPACE_NEEDLE_OBSERVATION_Y - SPACE_NEEDLE_CAR_FLOOR_THICKNESS;
export const SPACE_NEEDLE_STAIR_AXIS_Z = 0.38;

/** Elevator shaft center in needle-local XZ (Y is always 0 at base). */
export const SPACE_NEEDLE_SHAFT = { x: 3.55, z: SPACE_NEEDLE_STAIR_AXIS_Z };
export const SPACE_NEEDLE_SHAFT_RADIUS = 1.26;
export const SPACE_NEEDLE_DOOR_WIDTH = 1.45;
export const SPACE_NEEDLE_CAR = {
  width: 1.85,
  depth: 1.85,
  height: 2.25,
};

/** East face of the cab — where stairs meet the open doorway. */
export const SPACE_NEEDLE_DOOR_X =
  SPACE_NEEDLE_SHAFT.x + SPACE_NEEDLE_CAR.width / 2 - 0.08;

/** East entry staircase — all coordinates are needle-local XZ. */
export const SPACE_NEEDLE_STAIR = {
  entryX0: 5.0,
  entryX1: 7.25,
  platformX: 7.25,
  /** Top of the climb at the elevator doorway (not shaft center). */
  topX: SPACE_NEEDLE_DOOR_X,
  width: 1.65,
};

/** Shared with walk-height logic — keep in sync with stair meshes. */
export const SPACE_NEEDLE_STAIR_FLIGHTS = [
  { startX: 5.0, endX: 7.25, y0: 0, y1: 0.14, steps: 8 },
  { startX: 7.25, endX: SPACE_NEEDLE_DOOR_X, y0: 0.14, y1: SPACE_NEEDLE_CAR_WALK_Y, steps: 14 },
];

/** West skyline beside the path — visible from the start and About stop. */
export const SPACE_NEEDLE_POSITION = { x: -36, y: 0, z: 6 };

/** Sight line from early path toward the Space Needle — keep this corridor open. */
export const SPACE_NEEDLE_VISTA = {
  pathAnchor: { x: 0, z: 22 },
  clearRadius: 6,
  shortBand: 15,
  shortMaxHeight: 7.5,
  shortMinHeight: 4.2,
  zMin: -4,
  zMax: 25,
  eastBound: 5,
};

export const SPACE_NEEDLE_HEIGHT = HEIGHT;

/** Ground footprint — keep in sync with isInSpaceNeedleCompound in spaceNeedleInterior.js */
const NEEDLE_FOUNDATION_R = 6.35;

/** Extra half-extent (m) when testing a building center against the needle footprint. */
export function spaceNeedleBuildingPad(w, d, extra = 1.4) {
  return Math.max(w, d) * 0.5 + extra;
}

/** True when a building center (plus pad) would overlap the Space Needle compound at ground level. */
export function blocksSpaceNeedlePlacement(wx, wz, pad = 0) {
  const lx = wx - SPACE_NEEDLE_POSITION.x;
  const lz = wz - SPACE_NEEDLE_POSITION.z;

  const foundationR = NEEDLE_FOUNDATION_R + pad;
  if (lx * lx + lz * lz <= foundationR * foundationR) return true;

  const stair = SPACE_NEEDLE_STAIR;
  if (
    lx >= stair.entryX0 - 3.2 - pad &&
    lx <= stair.platformX + 2.4 + pad &&
    Math.abs(lz - SPACE_NEEDLE_STAIR_AXIS_Z) <= stair.width + 1.4 + pad
  ) {
    return true;
  }

  return false;
}

/** Needle-local doorway bounds for walk surfaces (wide approach). */
export function isInElevatorDoorway(lx, lz, margin = 0) {
  const halfZ = SPACE_NEEDLE_DOOR_WIDTH / 2 + margin;
  const halfW = SPACE_NEEDLE_CAR.width / 2;
  return (
    lx >= SPACE_NEEDLE_SHAFT.x - halfW - margin &&
    lx <= SPACE_NEEDLE_DOOR_X + margin &&
    Math.abs(lz - SPACE_NEEDLE_STAIR_AXIS_Z) <= halfZ
  );
}

/** Tight bounds — cat is physically inside the car cab. */
export function isInsideElevatorCar(lx, lz, catY, carFloorY, margin = 0) {
  const halfW = SPACE_NEEDLE_CAR.width / 2;
  const halfD = SPACE_NEEDLE_CAR.depth / 2;
  const walkY = carFloorY + 0.1;
  return (
    lx >= SPACE_NEEDLE_SHAFT.x - halfW - margin &&
    lx <= SPACE_NEEDLE_SHAFT.x + halfW + margin &&
    Math.abs(lz - SPACE_NEEDLE_STAIR_AXIS_Z) <= halfD + margin &&
    Math.abs(catY - walkY) < 0.95
  );
}
