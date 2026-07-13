import * as THREE from "three";

const SKY_RADIUS = 200;
export const MOON_DISTANCE = SKY_RADIUS * 0.84;
const MOON_AZIMUTH = Math.PI * 0.22;
const MOON_ELEVATION = 0.62;

export function getMoonLocalPosition(target = new THREE.Vector3()) {
  return target.set(
    Math.cos(MOON_AZIMUTH) * MOON_DISTANCE * Math.cos(MOON_ELEVATION),
    MOON_DISTANCE * MOON_ELEVATION,
    Math.sin(MOON_AZIMUTH) * MOON_DISTANCE * Math.cos(MOON_ELEVATION)
  );
}
