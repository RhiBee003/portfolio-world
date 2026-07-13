import * as THREE from "three";
import { createSkyThankYouMessage } from "./skyMessage.js";
import { getMoonLocalPosition } from "./skyMoon.js";

const SKY_GREY = new THREE.Color(0x2a2a38);
const SKY_PINK = new THREE.Color(0xefc4d6);
const SKY_RADIUS = 200;

const SKY_FRAGMENT = `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float uTime;
  varying vec3 vWorldPosition;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float starLayer(vec3 dir, float density, float size, float layer) {
    if (dir.y < 0.1) return 0.0;
    vec2 uv = dir.xz / (dir.y + 0.45);
    vec2 gv = uv * density;
    vec2 cell = floor(gv);
    vec2 f = fract(gv) - 0.5;
    float rnd = hash21(cell + layer * 17.3);
    if (rnd < 0.78) return 0.0;
    float phase = rnd * 6.28318;
    float speed = 0.9 + rnd * 2.6;
    float twinkle = 0.38 + 0.62 * (
      sin(uTime * speed + phase) * 0.55 +
      sin(uTime * speed * 2.4 + phase * 1.7) * 0.25 +
      0.2
    );
    float starSize = size * (0.75 + rnd * 0.55);
    float d = length(f);
    float core = 1.0 - smoothstep(starSize * 0.25, starSize, d);
    float glow = 1.0 - smoothstep(starSize, starSize * 2.2, d);
    return (core * 1.0 + glow * 0.35) * twinkle * (0.55 + rnd * 0.55);
  }

  float starField(vec3 dir) {
    float s = 0.0;
    s += starLayer(dir, 48.0, 0.05, 1.0);
    s += starLayer(dir, 68.0, 0.038, 2.0);
    return s;
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float height = dir.y;
    float blend = smoothstep(-0.12, 0.58, height);
    vec3 sky = mix(bottomColor, topColor, blend);

    float stars = starField(dir);
    vec3 starColor = vec3(1.0, 0.98, 0.95) * stars * 2.4;
    sky += starColor * (0.5 + blend * 0.5);

    gl_FragColor = vec4(sky, 1.0);
  }
`;

function createSkyDome() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: SKY_GREY },
      bottomColor: { value: SKY_PINK },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 32), material);
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  return dome;
}

function createMoon() {
  const moon = new THREE.Group();

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(18, 36),
    new THREE.MeshBasicMaterial({
      color: 0xfff8ee,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );

  const body = new THREE.Mesh(
    new THREE.CircleGeometry(10.5, 36),
    new THREE.MeshBasicMaterial({
      color: 0xfff3d4,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );

  const mare = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 20),
    new THREE.MeshBasicMaterial({
      color: 0xe6dcc4,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  mare.position.set(-2.4, 1.6, 0.02);

  const mareSmall = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 16),
    new THREE.MeshBasicMaterial({
      color: 0xe6dcc4,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
  );
  mareSmall.position.set(2.8, -0.8, 0.02);

  moon.add(glow, body, mare, mareSmall);

  moon.position.copy(getMoonLocalPosition());
  moon.lookAt(0, 0, 0);
  moon.frustumCulled = false;
  moon.renderOrder = -998;
  return moon;
}

export function createSky() {
  const sky = new THREE.Group();
  const dome = createSkyDome();
  sky.add(dome);
  sky.add(createMoon());
  sky.userData.thankYouMessage = createSkyThankYouMessage();
  sky.add(sky.userData.thankYouMessage);
  sky.userData.dome = dome;
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  return sky;
}

export function animateSky(sky, elapsed) {
  const dome = sky.userData.dome;
  if (dome?.material?.uniforms?.uTime) {
    dome.material.uniforms.uTime.value = elapsed;
  }
}

export function resizeSky() {
  // Stars are shader-based on the dome; no resize handling needed.
}
