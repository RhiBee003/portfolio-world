export const WORLD_CONFIG = {
  city: {
    bounds: { xMin: -42, xMax: 48, zMin: -148, zMax: 28 },
    proceduralCount: 80,
    maxPlacementAttempts: 1600,
    pathClearance: 7.8,
    edgePadding: 6,
    perimeterSpacing: 9,
    perimeterInset: 2.8,
    perimeterRows: 1,
    perimeterPathClearance: 8.5,
    walkwayClearance: 7.8,
    overpassFlank: { zMin: 12, zMax: 32, xMax: 14 },
    startCorridor: { zMin: 0, absXMax: 12 },
    midCorridor: { zMin: 10, absXMax: 11 },
    endPlaza: { zMax: -125, absXMax: 22 },
    overpassExclusion: { zMin: 16, zMax: 32, absXMin: 4, absXMax: 32 },
  },
};
