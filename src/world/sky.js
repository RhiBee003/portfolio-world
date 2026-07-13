import * as THREE from "three";

const SKY_GREY = new THREE.Color(0x94949c);
const SKY_PINK = new THREE.Color(0xefc4d6);

export function createSky() {
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

  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20), material);
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  return sky;
}
