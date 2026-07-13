import * as THREE from "three";
import { pathCenterAt } from "./pathLayout.js";
import { RESUME_ZONE } from "./resume.js";

export const RING_T_OFFSET = -0.045;
export const RING_ZONE_RADIUS = 3.1;
export const START_OVERPASS_T = 0.018;

export const WAYPOINTS = [
  {
    id: "hero",
    tag: "Start",
    title: "Rhiannon Black",
    body: "Creative developer and designer. Follow the trail to explore projects.",
    links: [
      { label: "Classic portfolio", href: "https://rhibee003.github.io" },
    ],
    pathT: 0.15,
    side: 1,
    sideOffset: 8,
    radius: 7,
  },
  {
    id: "whiskerwatch",
    tag: "Project 01",
    title: "WhiskerWatch",
    body: "Cat care app with breed guides, vet records, and daily routines.",
    links: [
      { label: "Live app", href: "https://whiskerwatch-dh13.onrender.com" },
      { label: "Design", href: "https://rhibee003.github.io/whiskerwatch-design.html" },
    ],
    pathT: 0.24,
    side: -1,
    sideOffset: 8.5,
    radius: 6,
  },
  {
    id: "cotton-elder",
    tag: "Project 02",
    title: "Cotton Elder Construction",
    body: "Renovation company site with gallery, contact intake, and admin panel.",
    links: [
      { label: "Live site", href: "https://cotton-elder-construction.onrender.com" },
      { label: "GitHub", href: "https://github.com/RhiBee003/cotton-elder-construction" },
    ],
    pathT: 0.44,
    side: 1,
    sideOffset: 8.5,
    radius: 6,
  },
  {
    id: "resume",
    tag: RESUME_ZONE.tag,
    title: RESUME_ZONE.title,
    body: RESUME_ZONE.body,
    links: RESUME_ZONE.links,
    pathT: 0.54,
    side: -1,
    sideOffset: 9.5,
    radius: 8,
  },
  {
    id: "about",
    tag: "About",
    title: "Background",
    body: "IT support and software developer. I ship polished web experiences end to end.",
    links: [
      { label: "LinkedIn", href: "https://www.linkedin.com/feed/" },
      { label: "GitHub", href: "https://github.com/RhiBee003" },
    ],
    pathT: 0.64,
    side: -1,
    sideOffset: 8.5,
    radius: 6,
  },
  {
    id: "contact",
    tag: "Contact",
    title: "Let's connect",
    body: "Interested in collaborating? Reach out anytime.",
    links: [
      { label: "Email me", href: "mailto:rhiblack0017@gmail.com" },
      { label: "GitHub", href: "https://github.com/RhiBee003" },
    ],
    floatLinks: [
      { text: "GitHub", href: "https://github.com/RhiBee003", y: 3.35 },
      { text: "Email me", href: "mailto:rhiblack0017@gmail.com", y: 2.15 },
    ],
    pathT: 0.84,
    side: 1,
    sideOffset: 8.5,
    radius: 6,
  },
];

export function getWaypointRingT(wp) {
  return THREE.MathUtils.clamp(wp.pathT + RING_T_OFFSET, 0.02, 0.98);
}

export function getWaypointRingPosition(wp, curve) {
  return pathCenterAt(curve, getWaypointRingT(wp));
}

export function getWaypointRingRadius() {
  return RING_ZONE_RADIUS;
}

export function getWaypointTriggerPosition(wp, curve) {
  return getWaypointRingPosition(wp, curve);
}

export function getWaypointSidePosition(wp, curve) {
  const center = curve.getPointAt(wp.pathT);
  const tangent = curve.getTangentAt(wp.pathT).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const offset = (wp.sideOffset ?? 6) * (wp.side ?? 1);
  return {
    x: center.x + normal.x * offset,
    z: center.z + normal.z * offset,
  };
}

export const PATH_POINTS = [
  new THREE.Vector3(0, 0, 27),
  new THREE.Vector3(0, 0, 24),
  new THREE.Vector3(0, 0, 21),
  new THREE.Vector3(0, 0, 14),
  new THREE.Vector3(0, 0, 8),
  new THREE.Vector3(0.5, 0, 0),
  new THREE.Vector3(-1, 0, -12),
  new THREE.Vector3(-2.2, 0, -26),
  new THREE.Vector3(-1.5, 0, -40),
  new THREE.Vector3(1.5, 0, -54),
  new THREE.Vector3(3.2, 0, -68),
  new THREE.Vector3(1.5, 0, -82),
  new THREE.Vector3(-1.2, 0, -96),
  new THREE.Vector3(1.8, 0, -110),
  new THREE.Vector3(2.2, 0, -124),
  new THREE.Vector3(0, 0, -136),
];
