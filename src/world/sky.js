import * as THREE from "three";

const SKY_GREY = new THREE.Color(0x94949c);
const SKY_PINK = new THREE.Color(0xefc4d6);
const SKY_RADIUS = 500;
const STAR_COUNT = 900;
const STAR_RADIUS = SKY_RADIUS * 0.98;
const MOON_DISTANCE = SKY_RADIUS * 0.84;

function createSkyDome() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: SKY_GREY },
      bottomColor: { value: SKY_PINK },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float height = normalize(vWorldPosition).y;
        float blend = smoothstep(-0.2, 0.72, height);
        gl_FragColor = vec4(mix(bottomColor, topColor, blend), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 20), material);
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  return dome;
}

function createStars() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const phases = new Float32Array(STAR_COUNT);
  const speeds = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 0.72 + 0.28;
    const z = Math.random() * 2 - 1;
    const len = Math.hypot(x, y, z);
    const nx = (x / len) * STAR_RADIUS;
    const ny = (y / len) * STAR_RADIUS;
    const nz = (z / len) * STAR_RADIUS;

    const i3 = i * 3;
    positions[i3] = nx;
    positions[i3 + 1] = ny;
    positions[i3 + 2] = nz;

    const tint = 0.82 + Math.random() * 0.18;
    const warmth = Math.random() * 0.08;
    colors[i3] = tint;
    colors[i3 + 1] = tint - warmth * 0.25;
    colors[i3 + 2] = tint - warmth;

    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.8 + Math.random() * 2.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("speed", new THREE.BufferAttribute(speeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 1.35 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float phase;
      attribute float speed;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;
      uniform float uSize;
      void main() {
        vColor = color;
        float pulse = sin(uTime * speed + phase);
        float shimmer = sin(uTime * speed * 2.7 + phase * 1.9) * 0.22;
        vTwinkle = 0.42 + 0.58 * (pulse * 0.72 + shimmer + 0.28);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * (0.72 + vTwinkle * 0.42);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;
        float core = smoothstep(0.5, 0.1, dist);
        gl_FragColor = vec4(vColor, core * vTwinkle * 0.95);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
  });

  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  stars.renderOrder = -999;
  return stars;
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

  const azimuth = Math.PI * 0.22;
  const elevation = 0.62;
  moon.position.set(
    Math.cos(azimuth) * MOON_DISTANCE * Math.cos(elevation),
    MOON_DISTANCE * elevation,
    Math.sin(azimuth) * MOON_DISTANCE * Math.cos(elevation)
  );
  moon.lookAt(0, 0, 0);
  moon.frustumCulled = false;
  moon.renderOrder = -998;
  return moon;
}

export function createSky() {
  const sky = new THREE.Group();
  sky.add(createSkyDome());
  const stars = createStars();
  sky.add(stars);
  sky.add(createMoon());
  sky.userData.stars = stars;
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  return sky;
}

export function animateSky(sky, elapsed) {
  const stars = sky.userData.stars;
  if (stars?.material?.uniforms?.uTime) {
    stars.material.uniforms.uTime.value = elapsed;
  }
}
