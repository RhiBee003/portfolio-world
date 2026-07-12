export const WORLD_CONFIG = {
  city: {
    bounds: { xMin: -42, xMax: 42, zMin: -148, zMax: 28 },
    proceduralCount: 82,
    maxPlacementAttempts: 1600,
    pathClearance: 4.6,
    edgePadding: 6,
    perimeterSpacing: 10,
    perimeterInset: 3,
    perimeterPathClearance: 6,
    overpassFlank: { zMin: 14, zMax: 22, xMax: 10 },
    startCorridor: { zMin: 2, absXMax: 9 },
    midCorridor: { zMin: 10, absXMax: 11 },
    endPlaza: { zMax: -125, absXMax: 22 },
    overpassExclusion: { zMin: 18, zMax: 30, absXMin: 6, absXMax: 30 },
  },
};
